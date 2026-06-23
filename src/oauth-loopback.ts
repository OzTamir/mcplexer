import { spawn } from "node:child_process"
import { randomBytes } from "node:crypto"
import { createServer, type Server } from "node:http"

type OAuthCallbackResult =
  | { readonly ok: true; readonly code: string }
  | { readonly ok: false; readonly message: string }

export type LoopbackOAuthReceiverConfig = {
  readonly callbackPort: number
  readonly openBrowser: boolean
}

export class LoopbackOAuthReceiver {
  readonly state = randomBytes(24).toString("base64url")
  private server: Server | undefined
  private callbackPromise: Promise<string> | undefined
  private resolveCallback: ((code: string) => void) | undefined
  private rejectCallback: ((error: Error) => void) | undefined

  constructor(private readonly config: LoopbackOAuthReceiverConfig) {}

  get redirectUrl(): URL {
    return new URL(`http://127.0.0.1:${this.config.callbackPort}/oauth/callback`)
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    await this.start()
    process.stderr.write(`Open this URL to authorize MCPlexer:\n${authorizationUrl.href}\n`)

    if (this.config.openBrowser) {
      openBrowser(authorizationUrl)
    }
  }

  async waitForCode(): Promise<string> {
    if (this.callbackPromise === undefined) {
      throw new Error("OAuth callback server was not started")
    }

    return await this.callbackPromise
  }

  async close(): Promise<void> {
    const server = this.server
    this.server = undefined
    if (server === undefined) {
      return
    }

    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error === undefined) {
          resolve()
          return
        }

        reject(error)
      })
    })
  }

  private async start(): Promise<void> {
    if (this.server !== undefined) {
      return
    }

    this.callbackPromise = new Promise<string>((resolve, reject) => {
      this.resolveCallback = resolve
      this.rejectCallback = reject
    })
    this.server = createServer((request, response) => {
      const result = this.readCallback(request.url)
      response.writeHead(result.ok ? 200 : 400, { "content-type": "text/html; charset=utf-8" })
      response.end(result.ok ? successHtml() : failureHtml(result.message))

      if (result.ok) {
        this.resolveCallback?.(result.code)
        return
      }

      this.rejectCallback?.(new Error(result.message))
    })

    await new Promise<void>((resolve, reject) => {
      const server = this.server
      if (server === undefined) {
        reject(new Error("OAuth callback server was not created"))
        return
      }

      server.once("error", reject)
      server.listen(this.config.callbackPort, "127.0.0.1", () => {
        server.off("error", reject)
        resolve()
      })
    })
  }

  private readCallback(requestUrl: string | undefined): OAuthCallbackResult {
    if (requestUrl === undefined) {
      return { ok: false, message: "OAuth callback is missing a URL" }
    }

    const url = new URL(requestUrl, this.redirectUrl)
    const state = url.searchParams.get("state")
    if (state !== this.state) {
      return { ok: false, message: "OAuth callback state did not match" }
    }

    const error = url.searchParams.get("error")
    if (error !== null) {
      return { ok: false, message: `OAuth authorization failed: ${error}` }
    }

    const code = url.searchParams.get("code")
    if (code === null || code.length === 0) {
      return { ok: false, message: "OAuth callback did not include a code" }
    }

    return { ok: true, code }
  }
}

function openBrowser(url: URL): void {
  const command = browserCommand(process.platform)
  const child = spawn(command.command, [...command.args, url.href], {
    detached: true,
    stdio: "ignore",
  })
  child.unref()
}

function browserCommand(platform: NodeJS.Platform): {
  readonly command: string
  readonly args: readonly string[]
} {
  switch (platform) {
    case "darwin":
      return { command: "open", args: [] }
    case "win32":
      return { command: "cmd", args: ["/c", "start", ""] }
    default:
      return { command: "xdg-open", args: [] }
  }
}

function successHtml(): string {
  return "<html><body><h1>MCPlexer authorization complete</h1><p>You can close this tab.</p></body></html>"
}

function failureHtml(message: string): string {
  return `<html><body><h1>MCPlexer authorization failed</h1><p>${escapeHtml(message)}</p></body></html>`
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}
