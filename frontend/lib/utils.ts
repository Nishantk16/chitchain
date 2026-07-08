import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatXLM(stroops: bigint | number | string): string {
  const n = typeof stroops === "bigint" ? stroops : BigInt(String(stroops))
  const xlm = Number(n) / 10_000_000
  return xlm.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 7 })
}

export function shortenAddress(address: string, chars = 6): string {
  if (!address) return ""
  return `${address.slice(0, chars)}…${address.slice(-chars)}`
}

export function ledgerToApproxMs(ledgers: number): number {
  return ledgers * 5000
}

export function formatRelativeTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export function statusCodeToLabel(code: number): string {
  const map: Record<number, string> = {
    0: "Pending",
    1: "Active",
    2: "Payout Ready",
    3: "Completed",
    4: "Disputed",
    5: "Cancelled",
  }
  return map[code] ?? "Unknown"
}

export function statusCodeToColor(code: number): string {
  const map: Record<number, string> = {
    0: "text-amber-400",
    1: "text-emerald-400",
    2: "text-violet-400",
    3: "text-sky-400",
    4: "text-rose-400",
    5: "text-zinc-400",
  }
  return map[code] ?? "text-zinc-400"
}

export function truncateHash(hash: string): string {
  if (!hash || hash.length < 16) return hash
  return `${hash.slice(0, 8)}…${hash.slice(-8)}`
}