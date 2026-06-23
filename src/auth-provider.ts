import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js"
import { ClientCredentialsProvider } from "@modelcontextprotocol/sdk/client/auth-extensions.js"
import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js"

import type { RemoteAuthConfig } from "./config-types.js"

export function createAuthProvider(config: RemoteAuthConfig): OAuthClientProvider | undefined {
  switch (config.kind) {
    case "none":
      return undefined
    case "bearer":
      return new StaticBearerProvider(config.token)
    case "client_credentials":
      return new ClientCredentialsProvider({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        ...(config.scope === undefined ? {} : { scope: config.scope }),
        ...(config.clientName === undefined ? {} : { clientName: config.clientName }),
      })
    default:
      return assertNever(config)
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
