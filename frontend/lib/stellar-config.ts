import { Networks } from "@stellar/stellar-sdk"

export const STELLAR_CONFIG = {
  network: "testnet" as const,
  networkPassphrase: Networks.TESTNET,
  rpcUrl: process.env.NEXT_PUBLIC_STELLAR_RPC_URL ?? "https://soroban-testnet.stellar.org",
  horizonUrl: process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org",
  explorerBase: "https://stellar.expert/explorer/testnet",
  friendbotUrl: "https://friendbot.stellar.org",
}

export const CONTRACT_ADDRESSES = {
  chitChain: process.env.NEXT_PUBLIC_CHIT_CHAIN_CONTRACT ?? "",
  registry: process.env.NEXT_PUBLIC_REGISTRY_CONTRACT ?? "",
}

export const XLM_TOKEN_ADDRESS =
  process.env.NEXT_PUBLIC_XLM_TOKEN_ADDRESS ??
  "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC"

export const TX_TIMEOUT_SECONDS = 30
export const POLL_INTERVAL_MS = 3000
export const EVENT_POLL_INTERVAL_MS = 5000

export function explorerTxUrl(hash: string): string {
  return `${STELLAR_CONFIG.explorerBase}/tx/${hash}`
}

export function explorerContractUrl(address: string): string {
  return `${STELLAR_CONFIG.explorerBase}/contract/${address}`
}

export function explorerAccountUrl(address: string): string {
  return `${STELLAR_CONFIG.explorerBase}/account/${address}`
}