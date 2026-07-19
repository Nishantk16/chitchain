import { describe, it, expect } from "vitest"
import {
  formatXLM,
  shortenAddress,
  ledgerToApproxMs,
  formatRelativeTime,
  statusCodeToLabel,
  statusCodeToColor,
  truncateHash,
  eventLabel,
  eventDotColor,
} from "./utils"

describe("formatXLM", () => {
  it("converts stroops (7 decimal places) to XLM", () => {
    expect(formatXLM(BigInt(10_000_000))).toBe("1.00")
    expect(formatXLM(BigInt(1_000_000_000))).toBe("100.00")
  })

  it("accepts numbers and strings, not just bigint", () => {
    expect(formatXLM(10_000_000)).toBe("1.00")
    expect(formatXLM("10000000")).toBe("1.00")
  })

  it("handles zero and fractional amounts", () => {
    expect(formatXLM(BigInt(0))).toBe("0.00")
    expect(formatXLM(BigInt(15_000_000))).toBe("1.50")
    expect(formatXLM(BigInt(1_234_567))).toBe("0.1234567")
  })
})

describe("shortenAddress", () => {
  const address = "GBWPYBKJDHCNIZZ6KUJPOOCCOJPAN2UIKGXVJLN4ZPOZMNRZMIN4IUT4"

  it("keeps the first and last N characters, ellipsis in between", () => {
    expect(shortenAddress(address)).toBe(`${address.slice(0, 6)}…${address.slice(-6)}`)
  })

  it("returns an empty string for falsy input instead of throwing", () => {
    expect(shortenAddress("")).toBe("")
  })

  it("respects a custom character count", () => {
    expect(shortenAddress(address, 4)).toBe(`${address.slice(0, 4)}…${address.slice(-4)}`)
  })
})

describe("ledgerToApproxMs", () => {
  it("estimates ~5s per ledger", () => {
    expect(ledgerToApproxMs(1)).toBe(5000)
    expect(ledgerToApproxMs(12)).toBe(60_000)
  })
})

describe("formatRelativeTime", () => {
  it("shows seconds under a minute", () => {
    expect(formatRelativeTime(45_000)).toBe("45s")
  })
  it("shows minutes under an hour", () => {
    expect(formatRelativeTime(5 * 60_000)).toBe("5m")
  })
  it("shows hours under a day", () => {
    expect(formatRelativeTime(3 * 3_600_000)).toBe("3h")
  })
  it("shows days beyond that", () => {
    expect(formatRelativeTime(2 * 86_400_000)).toBe("2d")
  })
})

describe("statusCodeToLabel / statusCodeToColor", () => {
  it("maps every known on-chain status code", () => {
    expect(statusCodeToLabel(0)).toBe("Pending")
    expect(statusCodeToLabel(1)).toBe("Active")
    expect(statusCodeToLabel(2)).toBe("Payout Ready")
    expect(statusCodeToLabel(3)).toBe("Completed")
    expect(statusCodeToLabel(4)).toBe("Disputed")
    expect(statusCodeToLabel(5)).toBe("Cancelled")
  })

  it("falls back to Unknown / a neutral color for an unrecognized code", () => {
    expect(statusCodeToLabel(99)).toBe("Unknown")
    expect(statusCodeToColor(99)).toBe("text-zinc-400")
  })

  it("gives Active a distinct color from Pending", () => {
    expect(statusCodeToColor(1)).not.toBe(statusCodeToColor(0))
  })
})

describe("truncateHash", () => {
  it("shortens a full 64-char tx hash", () => {
    const hash = "66b85eedd2e6f72e388f87c240f2d2c6ed274c477f5c4797fe8a3387530c12c8"
    expect(truncateHash(hash)).toBe(`${hash.slice(0, 8)}…${hash.slice(-8)}`)
  })

  it("leaves short strings untouched", () => {
    expect(truncateHash("abc123")).toBe("abc123")
  })

  it("handles empty input without throwing", () => {
    expect(truncateHash("")).toBe("")
  })
})

describe("eventLabel / eventDotColor", () => {
  it("maps every contract event topic to a human-readable label", () => {
    expect(eventLabel("joined")).toBe("Member Joined")
    expect(eventLabel("active")).toBe("Circle Activated")
    expect(eventLabel("rndst")).toBe("Round Started")
    expect(eventLabel("payout")).toBe("Payout Sent")
  })

  it("falls back to the raw topic string for an unrecognized event", () => {
    expect(eventLabel("mystery_event")).toBe("mystery_event")
  })

  it("gives every mapped event topic a color, unknown topics a neutral default", () => {
    expect(eventDotColor("joined")).toMatch(/^bg-/)
    expect(eventDotColor("mystery_event")).toBe("bg-zinc-400")
  })
})
