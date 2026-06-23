import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js"
import { ClientCredentialsProvider } from "@modelcontextprotocol/sdk/client/auth-extensions.js"
import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js"

import type { RemoteAuthConfig } from "./config-types.js"
import { LoopbackOAuthReceiver } from "./oauth-loopback.js"
import { OAuthStore } from "./oauth-store.js"

export type FinishAuth = (authorizationCode: string) => Promise<void>

export type RemoteAuthSession = {
  readonly provider: OAuthClientProvider
  readonly completeAuthorization?: (finishAuth: FinishAuth) => Promise<void>
  readonly close?: () => Promise<void>
}

export function createAuthSession(config: RemoteAuthConfig): RemoteAuthSession | undefined {
  switch (config.kind) {
    case "none":
      return undefined
    case "bearer":
      return { provider: new StaticBearerProvider(config.token) }
    case "client_credentials":
      return { provider: clientCredentialsProvider(config) }
    case "browser": {
      const receiver = new LoopbackOAuthReceiver(config)
      const provider = new BrowserOAuthProvider(config, receiver)
      return {
        provider,
        completeAuthorization: async (finishAuth) => {
          const code = await receiver.waitForCode()
          await finishAuth(code)
          await receiver.close()
        },
        close: async () => {
          await receiver.close()
        },
      }
    }
    default:
      return assertNever(config)
  }
}

export function createAuthProvider(config: RemoteAuthConfig): OAuthClientProvider | undefined {
  return createAuthSession(config)?.provider
}

function clientCredentialsProvider(
  config: Extract<RemoteAuthConfig, { readonly kind: "client_credentials" }>,
): ClientCredentialsProvider {
  return new ClientCredentialsProvider({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    ...(config.scope === undefined ? {} : { scope: config.scope }),
    ...(config.clientName === undefined ? {} : { clientName: config.clientName }),
  })
}

class BrowserOAuthProvider implements OAuthClientProvider {
  private readonly store: OAuthStore

  constructor(
    private readonly config: Extract<RemoteAuthConfig, { readonly kind: "browser" }>,
    private readonly receiver: LoopbackOAuthReceiver,
  ) {
    this.store = new OAuthStore(config.storePath)
  }

  get redirectUrl(): URL {
    return this.receiver.redirectUrl
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      redirect_uris: [this.redirectUrl.href],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      client_name: this.config.clientName,
      ...(this.config.scope === undefined ? {} : { scope: this.config.scope }),
    }
  }

  state(): string {
    return this.receiver.state
  }

  async clientInformation(): Promise<OAuthClientInformationMixed | undefined> {
    return await this.store.clientInformation()
  }

  async saveClientInformation(clientInformation: OAuthClientInformationMixed): Promise<void> {
    await this.store.saveClientInformation(clientInformation)
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    return await this.store.tokens()
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    await this.store.saveTokens(tokens)
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    await this.receiver.redirectToAuthorization(authorizationUrl)
  }

  async saveCodeVerifier(codeVerifier: string): Promise<void> {
    await this.store.saveCodeVerifier(codeVerifier)
  }

  async codeVerifier(): Promise<string> {
    return await this.store.codeVerifier()
  }

  async invalidateCredentials(
    scope: "all" | "client" | "tokens" | "verifier" | "discovery",
  ): Promise<void> {
    await this.store.invalidate(scope)
  }
}

class StaticBearerProvider implements OAuthClientProvider {
  private currentTokens: OAuthTokens

  constructor(token: string) {
    this.currentTokens = { access_token: token, token_type: "Bearer" }
  }

  get redirectUrl(): undefined {
    return undefined
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      redirect_uris: [],
      grant_types: [],
      token_endpoint_auth_method: "none",
      client_name: "mcplexer-bearer-token",
    }
  }

  clientInformation(): OAuthClientInformationMixed | undefined {
    return undefined
  }

  tokens(): OAuthTokens {
    return this.currentTokens
  }

  saveTokens(tokens: OAuthTokens): void {
    this.currentTokens = tokens
  }

  redirectToAuthorization(): void {
    throw new Error("Static bearer token auth does not use authorization redirects")
  }

  saveCodeVerifier(): void {}

  codeVerifier(): string {
    throw new Error("Static bearer token auth does not use PKCE code verifiers")
  }
}

function assertNever(value: never): never {
  throw new Error(`Unexpected remote auth config: ${JSON.stringify(value)}`)
}
