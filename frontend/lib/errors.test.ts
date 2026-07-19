import { describe, it, expect } from "vitest"
import { classifyError } from "./errors"

describe("classifyError", () => {
  it("classifies a missing-wallet error", () => {
    const result = classifyError(new Error("Freighter is not installed"))
    expect(result.kind).toBe("wallet_not_found")
    expect(result.message).toMatch(/wallet/i)
  })

  it("classifies a user-rejected signing error", () => {
    const result = classifyError(new Error("User declined access"))
    expect(result.kind).toBe("user_rejected")
  })

  it("classifies a cancelled request the same way as a rejection", () => {
    const result = classifyError(new Error("Request cancelled by user"))
    expect(result.kind).toBe("user_rejected")
  })

  it("falls back to contract_error for an unrecognized failure, keeping the original message", () => {
    const result = classifyError(new Error("Error(Contract, #4)"))
    expect(result.kind).toBe("contract_error")
    expect(result.message).toBe("Error(Contract, #4)")
  })

  it("handles a plain string thrown instead of an Error object", () => {
    const result = classifyError("not installed")
    expect(result.kind).toBe("wallet_not_found")
  })

  it("handles null/undefined without throwing, defaulting to contract_error", () => {
    expect(classifyError(null).kind).toBe("contract_error")
    expect(classifyError(undefined).kind).toBe("contract_error")
  })

  it("is case-insensitive when matching keywords", () => {
    expect(classifyError(new Error("USER REJECTED the request")).kind).toBe("user_rejected")
  })
})
