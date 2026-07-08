"use client"
import { useState, useEffect, useRef } from "react"
import { Horizon } from "@stellar/stellar-sdk"

const server = new Horizon.Server("https://horizon-testnet.stellar.org")

export default function Home() {
  const [address, setAddress] = useState("")
  const [balance, setBalance] = useState("")
  const [toAddress, setToAddress] = useState("")
  const [amount, setAmount] = useState("")
  const [txHash, setTxHash] = useState("")
  const [txError, setTxError] = useState("")
  const [loading, setLoading] = useState(false)
  const [particles, setParticles] = useState<{x:number,y:number,size:number,speed:number,opacity:number}[]>([])
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const pts = Array.from({length: 60}, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 0.4 + 0.1,
      opacity: Math.random() * 0.6 + 0.2
    }))
    setParticles(pts)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || particles.length === 0) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    let animId: number
    let pts = [...particles]

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      pts.forEach((p, i) => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(139, 92, 246, ${p.opacity})`
        ctx.fill()
        pts[i].y -= p.speed
        if (pts[i].y < -5) pts[i].y = canvas.height + 5
        // Draw lines between close particles
        pts.forEach((p2, j) => {
          if (i === j) return
          const dist = Math.sqrt((p.x - p2.x)**2 + (p.y - p2.y)**2)
          if (dist < 120) {
            ctx.beginPath()
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.strokeStyle = `rgba(139, 92, 246, ${0.15 * (1 - dist/120)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        })
      })
      animId = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(animId)
  }, [particles])

  const connect = async () => {
    try {
      const freighter = await import("@stellar/freighter-api")
      const { isConnected } = await freighter.isConnected()
      if (!isConnected) { alert("Please install Freighter wallet extension"); return }
      await freighter.setAllowed()
      const { address: addr } = await freighter.getAddress()
      setAddress(addr)
    } catch (e: any) { alert("Could not connect: " + e.message) }
  }

  const disconnect = () => { setAddress(""); setBalance(""); setTxHash(""); setTxError("") }

  useEffect(() => {
    if (!address) return
    server.loadAccount(address).then((acc: any) => {
      const xlm = acc.balances.find((b: any) => b.asset_type === "native")
      setBalance(xlm ? parseFloat(xlm.balance).toFixed(2) : "0.00")
    }).catch(() => setBalance("0.00"))
  }, [address])

  const sendTx = async () => {
    if (!address || !toAddress || !amount) return
    setLoading(true); setTxHash(""); setTxError("")
    try {
      const S = await import("@stellar/stellar-sdk")
      const freighter = await import("@stellar/freighter-api")
      const account = await server.loadAccount(address)
      const tx = new S.TransactionBuilder(account, { fee: S.BASE_FEE, networkPassphrase: S.Networks.TESTNET })
        .addOperation(S.Operation.payment({ destination: toAddress, asset: S.Asset.native(), amount }))
        .setTimeout(30).build()
      const { signedTxXdr } = await freighter.signTransaction(tx.toXDR(), { networkPassphrase: S.Networks.TESTNET })
      const result = await server.submitTransaction(S.TransactionBuilder.fromXDR(signedTxXdr, S.Networks.TESTNET))
      setTxHash(result.hash)
    } catch (e: any) { setTxError(e?.message || "Transaction failed") }
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-[#030308] text-white overflow-hidden relative">
      {/* Animated particle canvas */}
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />

      {/* Glow orbs */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-30%] left-[-20%] w-[800px] h-[800px] bg-violet-700/15 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute bottom-[-30%] right-[-20%] w-[800px] h-[800px] bg-indigo-700/15 rounded-full blur-[140px] animate-pulse" style={{animationDelay: '1s'}} />
        <div className="absolute top-[40%] left-[50%] w-[400px] h-[400px] bg-fuchsia-700/10 rounded-full blur-[100px] animate-pulse" style={{animationDelay: '2s'}} />
      </div>

      {/* Grid overlay */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.03]"
        style={{backgroundImage: 'linear-gradient(rgba(139,92,246,1) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,1) 1px, transparent 1px)', backgroundSize: '60px 60px'}} />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-lg flex items-center justify-center shadow-lg shadow-violet-500/40">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-bold text-lg bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">ChitChain</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">Testnet Live</span>
          </div>
        </div>
      </nav>

      <div className="relative z-10 flex flex-col items-center justify-center px-4 pt-8 pb-20">
        {/* Hero */}
        <div className="text-center mb-12 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-xs text-violet-300 mb-6 backdrop-blur-sm">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
            Built on Stellar Blockchain
          </div>
          <h1 className="text-6xl md:text-7xl font-black mb-4 leading-none">
            <span className="bg-gradient-to-r from-white via-violet-200 to-white bg-clip-text text-transparent">Save Together,</span>
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">Trust No One</span>
          </h1>
          <p className="text-zinc-400 text-xl leading-relaxed">
            The world first trustless group savings protocol.<br />
            Powered by Soroban smart contracts.
          </p>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-8 mb-12 flex-wrap justify-center">
          {[["100%", "On-chain"], ["0", "Middlemen"], ["Instant", "Payouts"], ["Stellar", "Powered"]].map(([val, label]) => (
            <div key={label} className="text-center">
              <p className="text-2xl font-black bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">{val}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {!address ? (
          <div className="w-full max-w-md">
            {/* Glowing border card */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-3xl blur opacity-30 group-hover:opacity-60 transition duration-500" />
              <div className="relative bg-[#0d0d1a] border border-white/5 rounded-3xl p-8 backdrop-blur-xl">
                <div className="text-center mb-8">
                  <div className="relative mx-auto w-20 h-20 mb-4">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-2xl blur-md opacity-60" />
                    <div className="relative w-20 h-20 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-2xl flex items-center justify-center shadow-2xl">
                      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Connect Wallet</h2>
                  <p className="text-zinc-500 text-sm">Start your trustless savings journey on Stellar testnet</p>
                </div>

                <button onClick={connect} className="relative w-full group/btn overflow-hidden bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold py-4 rounded-2xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-violet-500/30">
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-400 to-fuchsia-400 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300" />
                  <span className="relative flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Connect Freighter Wallet
                  </span>
                </button>

                <div className="mt-6 grid grid-cols-3 gap-3">
                  {[["Secure", "Shield"], ["Fast", "Zap"], ["Trustless", "Lock"]].map(([label, icon]) => (
                    <div key={label} className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
                      <p className="text-xs text-zinc-400 font-medium">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-lg space-y-4">
            {/* Wallet card */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
              <div className="relative bg-[#0d0d1a] border border-white/5 rounded-3xl p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping absolute" />
                      <div className="w-2.5 h-2.5 bg-emerald-400 rounded-full" />
                    </div>
                    <span className="text-sm font-semibold text-emerald-400">Wallet Connected</span>
                  </div>
                  <button onClick={disconnect} className="text-xs text-zinc-600 hover:text-zinc-400 transition border border-zinc-800 rounded-lg px-3 py-1 hover:border-zinc-600">
                    Disconnect
                  </button>
                </div>
                <div className="bg-white/3 rounded-2xl p-3 mb-5">
                  <p className="font-mono text-xs text-zinc-400 break-all">{address}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-zinc-600 uppercase tracking-widest mb-2">Portfolio Balance</p>
                  <div className="relative inline-block">
                    <p className="text-5xl font-black bg-gradient-to-r from-emerald-300 via-teal-300 to-cyan-300 bg-clip-text text-transparent">
                      {balance || "..."}
                    </p>
                    <span className="text-xl font-bold text-zinc-500 ml-2">XLM</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Send card */}
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
              <div className="relative bg-[#0d0d1a] border border-white/5 rounded-3xl p-6 backdrop-blur-xl">
                <h3 className="text-base font-bold text-white mb-5 flex items-center gap-2">
                  <div className="w-7 h-7 bg-violet-500/20 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </div>
                  Transfer XLM
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block">Destination</label>
                    <input
                      value={toAddress}
                      onChange={e => setToAddress(e.target.value)}
                      placeholder="G... (Stellar address)"
                      className="w-full bg-white/3 border border-white/8 hover:border-violet-500/30 focus:border-violet-500/60 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none transition-all duration-200 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 uppercase tracking-wider mb-2 block">Amount</label>
                    <div className="relative">
                      <input
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        placeholder="0.00"
                        type="number"
                        className="w-full bg-white/3 border border-white/8 hover:border-violet-500/30 focus:border-violet-500/60 rounded-xl px-4 py-3 pr-16 text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none transition-all duration-200"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-500">XLM</span>
                    </div>
                  </div>
                  <button
                    onClick={sendTx}
                    disabled={loading || !toAddress || !amount}
                    className="relative w-full overflow-hidden group/btn bg-gradient-to-r from-violet-600 to-indigo-600 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-white font-bold py-4 rounded-xl transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] shadow-xl shadow-violet-500/20"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-400 to-fuchsia-400 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300" />
                    <span className="relative flex items-center justify-center gap-2">
                      {loading ? (
                        <>
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          Processing on Stellar...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Send Transaction
                        </>
                      )}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {txHash && (
              <div className="relative">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-3xl blur opacity-30 animate-pulse" />
                <div className="relative bg-[#0a1a0f] border border-emerald-500/20 rounded-3xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-emerald-400">Transaction Confirmed!</p>
                      <p className="text-xs text-emerald-700">Successfully broadcast to Stellar testnet</p>
                    </div>
                  </div>
                  <div className="bg-emerald-500/5 rounded-xl p-3">
                    <a href={"https://stellar.expert/explorer/testnet/tx/" + txHash} target="_blank" rel="noreferrer"
                      className="font-mono text-xs text-emerald-400/80 break-all hover:text-emerald-300 transition underline decoration-dotted">
                      {txHash}
                    </a>
                  </div>
                  <p className="text-xs text-emerald-700 mt-2 text-right">View on Stellar Expert Explorer</p>
                </div>
              </div>
            )}

            {txError && (
              <div className="bg-rose-500/5 border border-rose-500/20 rounded-3xl p-5">
                <p className="text-sm font-bold text-rose-400 mb-1">Transaction Failed</p>
                <p className="text-xs text-rose-700">{txError}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
