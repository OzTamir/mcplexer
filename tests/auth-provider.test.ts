import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { createAuthProvider } from "../src/auth-provider.js"

describe("createAuthProvider", () => {
  it("returns undefined when remote auth is disabled", () => {
    expect(createAuthProvider({ kind: "none" })).toBeUndefined()
  })

  it("creates a bearer-token OAuth provider", async () => {
    const provider = createAuthProvider({ kind: "bearer", token: "token-123" })
    if (provider === undefined) {
      throw new Error("Expected bearer auth provider")
    }

    expect(await provider.tokens()).toMatchObject({
      access_token: "token-123",
      token_type: "Bearer",
    })
  })

  it("creates a client-credentials OAuth provider", () => {
    const provider = createAuthProvider({
      kind: "client_credentials",
      clientId: "client-id",
      clientSecret: "secret",
      scope: "calendar.read",
      clientName: "MCPlexer Work",
    })

    expect(provider?.clientMetadata).toMatchObject({
      client_name: "MCPlexer Work",
      grant_types: ["client_credentials"],
      scope: "calendar.read",
    })
  })

  it("creates a persistent browser OAuth provider", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mcplexer-oauth-"))
    const provider = createAuthProvider({
      kind: "browser",
      callbackPort: 49887,
      openBrowser: false,
      storePath: join(directory, "tokens.json"),
      clientName: "MCPlexer Notion",
      clientId: "public-client-id",
      scope: "read write",
    })
    if (provider === undefined) {
      throw new Error("Expected browser auth provider")
    }

    expect(provider.redirectUrl?.toString()).toBe("http://127.0.0.1:49887/oauth/callback")
    expect(provider.clientMetadata).toMatchObject({
      client_name: "MCPlexer Notion",
      redirect_uris: ["http://127.0.0.1:49887/oauth/callback"],
      scope: "read write",
    })
    await expect(provider.clientInformation()).resolves.toEqual({ client_id: "public-client-id" })

    await provider.saveCodeVerifier("verifier")
    await provider.saveTokens({ access_token: "token-123", token_type: "Bearer" })

    await expect(provider.codeVerifier()).resolves.toBe("verifier")
    await expect(provider.tokens()).resolves.toMatchObject({ access_token: "token-123" })
  })
})
