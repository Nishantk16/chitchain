"use client"
import { useState, useEffect } from "react"
import { StellarWalletsKit } from "@creit.tech/stellar-wallets-kit"
import { Horizon } from "@stellar/stellar-sdk"

const kit = new StellarWalletsKit({
  selectedNetwork: "TESTNET",
  modules: [],
})

const server = new Horizon.Server("https://horizon-testnet.stellar.org")

export default function Home() {
  const [address, setAddress] = useState("")
  const [balance, setBalance] = useState("")
  const [toAddress, setToAddress] = useState("")
  const [amount, setAmount] = useState("")
  const [txHash, setTxHash] = useState("")
  const [txError, setTxError] = useState("")
  const [loading, setLoading] = useState(false)

  const connect = async () => {
    await kit.openModal({
      onWalletSelected: async (option: any) => {
        kit.setWallet(option.id)
        const result = await kit.getAddress()
        setAddress(result.address)
      },
    })
  }

  const disconnect = () => {
    setAddress("")
    setBalance("")
    setTxHash("")
    setTxError("")
  }

  useEffect(() => {
    if (!address) return
    server.loadAccount(address).then((acc: any) => {
      const xlm = acc.balances.find((b: any) => b.asset_type === "native")
      setBalance(xlm ? parseFloat(xlm.balance).toFixed(2) : "0.00")
    }).catch(() => setBalance("0.00"))
  }, [address])

  const sendTx = async () => {
    if (!address || !toAddress || !amount) return
    setLoading(true)
    setTxHash("")
    setTxError("")
    try {
      const S = await import("@stellar/stellar-sdk")
      const account = await server.loadAccount(address)
      const tx = new S.TransactionBuilder(account, {
        fee: S.BASE_FEE,
        networkPassphrase: S.Networks.TESTNET,
      })
        .addOperation(S.Operation.payment({
          destination: toAddress,
          asset: S.Asset.native(),
          amount: amount,
        }))
        .setTimeout(30)
        .build()
      const signed = await kit.signTransaction(tx.toXDR(), {
        address,
        networkPassphrase: S.Networks.TESTNET,
      })
      const result = await server.submitTransaction(
        S.TransactionBuilder.fromXDR(signed.signedTxXdr, S.Networks.TESTNET)
      )
      setTxHash(result.hash)
    } catch (e: any) {
      setTxError(e?.message || "Transaction failed")
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-violet-400">ChitChain</h1>
          <p className="text-zinc-400 text-sm mt-1">Trustless savings on Stellar</p>
        </div>

        {!address ? (
          <button onClick={connect} className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium py-3 rounded-xl transition">
            Connect Wallet
          </button>
        ) : (
          <div className="space-y-4">
            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
              <p className="text-xs text-zinc-500 mb-1">Connected</p>
              <p className="font-mono text-sm text-zinc-200 break-all">{address}</p>
            </div>

            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 text-center">
              <p className="text-xs text-zinc-500 mb-1">XLM Balance</p>
              <p className="text-3xl font-bold text-emerald-400">{balance || "..."} XLM</p>
            </div>

            <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 space-y-3">
              <p className="text-sm font-medium text-zinc-300">Send XLM</p>
              <input
                value={toAddress}
                onChange={e => setToAddress(e.target.value)}
                placeholder="Destination address (G...)"
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
              />
              <input
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Amount (XLM)"
                type="number"
                className="w-full bg-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
              />
              <button
                onClick={sendTx}
                disabled={loading}
                className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition"
              >
                {loading ? "Sending..." : "Send Transaction"}
              </button>
            </div>

            {txHash && (
              <div className="bg-emerald-950 border border-emerald-800 rounded-xl p-4">
                <p className="text-xs text-emerald-400 font-medium mb-1">Transaction Confirmed!</p>
                <a href={"https://stellar.expert/explorer/testnet/tx/" + txHash} target="_blank" rel="noreferrer" className="font-mono text-xs text-emerald-300 break-all underline">
                  {txHash}
                </a>
              </div>
            )}

            {txError && (
              <div className="bg-rose-950 border border-rose-800 rounded-xl p-4">
                <p className="text-xs text-rose-400 font-medium mb-1">Failed</p>
                <p className="text-xs text-rose-300">{txError}</p>
              </div>
            )}

            <button onClick={disconnect} className="w-full border border-zinc-700 text-zinc-400 hover:text-zinc-200 py-2.5 rounded-xl text-sm transition">
              Disconnect
            </button>
          </div>
        )}
      </div>
    </main>
  )
}