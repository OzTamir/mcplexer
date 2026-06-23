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
})
