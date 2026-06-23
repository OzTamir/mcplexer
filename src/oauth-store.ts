import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

import {
  OAuthClientInformationFullSchema,
  type OAuthClientInformationMixed,
  OAuthClientInformationSchema,
  type OAuthTokens,
  OAuthTokensSchema,
} from "@modelcontextprotocol/sdk/shared/auth.js"
import { z } from "zod"

const StoredOAuthSchema = z.object({
  clientInformation: z
    .union([OAuthClientInformationSchema, OAuthClientInformationFullSchema])
    .optional(),
  tokens: OAuthTokensSchema.optional(),
  codeVerifier: z.string().optional(),
})

type StoredOAuth = z.infer<typeof StoredOAuthSchema>

export class OAuthStore {
  constructor(readonly filePath: string) {}

  async clientInformation(): Promise<OAuthClientInformationMixed | undefined> {
    return (await this.read()).clientInformation
  }

  async saveClientInformation(clientInformation: OAuthClientInformationMixed): Promise<void> {
    await this.write({ ...(await this.read()), clientInformation })
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    return (await this.read()).tokens
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    await this.write({ ...(await this.read()), tokens })
  }

  async codeVerifier(): Promise<string> {
    const codeVerifier = (await this.read()).codeVerifier
    if (codeVerifier === undefined) {
      throw new Error("OAuth code verifier was not saved")
    }

    return codeVerifier
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    await this.write({ ...(await this.read()), codeVerifier })
  }

  async invalidate(scope: "all" | "client" | "tokens" | "verifier" | "discovery"): Promise<void> {
    if (scope === "all") {
      await rm(this.filePath, { force: true })
      return
    }

    const current = await this.read()
    const next = { ...current }
    switch (scope) {
      case "client":
        delete next.clientInformation
        break
      case "tokens":
        delete next.tokens
        break
      case "verifier":
        delete next.codeVerifier
        break
      case "discovery":
        break
      default:
        assertNever(scope)
    }

    await this.write(next)
  }

  private async read(): Promise<StoredOAuth> {
    try {
      const raw = await readFile(this.filePath, "utf8")
      return StoredOAuthSchema.parse(JSON.parse(raw))
    } catch (error) {
      if (isMissingFile(error)) {
        return {}
      }

      throw error
    }
  }

  private async write(value: StoredOAuth): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 })
    await writeFile(this.filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  }
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT"
}

function assertNever(value: never): never {
  throw new Error(`Unexpected OAuth invalidation scope: ${value}`)
}
