export type AppErrorKind = "wallet_not_found" | "user_rejected" | "contract_error"

export interface AppError {
  kind: AppErrorKind
  message: string
}

/**
 * Turns whatever a failed wallet-kit / Soroban RPC call throws (which has no
 * stable shape -- could be an Error, a plain object, or a raw string) into a
 * consistent, user-facing AppError. Classification is based on keyword
 * matching against the error's message, since neither Freighter nor the
 * Soroban RPC client expose a typed error code for these cases.
 */
export function classifyError(e: unknown): AppError {
  const err = e as { message?: string } | null | undefined
  const raw = (err?.message || String(e) || "").toLowerCase()

  if (
    raw.includes("no wallet") ||
    raw.includes("not installed") ||
    raw.includes("not available") ||
    raw.includes("please install")
  ) {
    return { kind: "wallet_not_found", message: "No compatible wallet was found. Please install Freighter, xBull, Albedo, or another supported Stellar wallet." }
  }

  if (
    raw.includes("reject") ||
    raw.includes("declin") ||
    raw.includes("cancel") ||
    raw.includes("user denied")
  ) {
    return { kind: "user_rejected", message: "The request was rejected in your wallet. No transaction was sent." }
  }

  return {
    kind: "contract_error",
    message: err?.message || "The contract call failed. This can happen if you're already a member, the circle is full, or your account doesn't have enough XLM to cover the fee.",
  }
}
