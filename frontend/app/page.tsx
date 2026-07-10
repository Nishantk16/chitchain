"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { Horizon } from "@stellar/stellar-sdk"
import { StellarWalletsKit, Networks } from "@creit.tech/stellar-wallets-kit"
import { FreighterModule, FREIGHTER_ID } from "@creit.tech/stellar-wallets-kit/modules/freighter"
import { xBullModule } from "@creit.tech/stellar-wallets-kit/modules/xbull"
import { AlbedoModule } from "@creit.tech/stellar-wallets-kit/modules/albedo"
import { LobstrModule } from "@creit.tech/stellar-wallets-kit/modules/lobstr"
import { CONTRACT_ADDRESSES, STELLAR_CONFIG, explorerTxUrl } from "@/lib/stellar-config"
import { statusCodeToLabel, statusCodeToColor, formatXLM } from "@/lib/utils"

const horizon = new Horizon.Server(STELLAR_CONFIG.horizonUrl)

let kitInitialized = false
function ensureKitInit() {
  if (kitInitialized) return
  StellarWalletsKit.init({
    modules: [new FreighterModule(), new xBullModule(), new AlbedoModule(), new LobstrModule()],
    selectedWalletId: FREIGHTER_ID,
    network: Networks.TESTNET,
  })
  kitInitialized = true
}

// ── Error categories ────────────────────────────────────────────────────────
// We surface exactly 3 distinct, user-actionable error types, each with its
// own message + icon, rather than one generic catch-all.
type AppErrorKind = "wallet_not_found" | "user_rejected" | "contract_error"

interface AppError {
  kind: AppErrorKind
  message: string
}

function classifyError(e: any): AppError {
  const raw = (e?.message || String(e) || "").toLowerCase()

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
    message: e?.message || "The contract call failed. This can happen if you're already a member, the circle is full, or your account doesn't have enough XLM to cover the fee.",
  }
}

// ── Transaction status stepper ──────────────────────────────────────────────
type TxStep = "idle" | "building" | "simulating" | "signing" | "submitting" | "confirming" | "success" | "failed"

const STEP_LABELS: Record<TxStep, string> = {
  idle: "",
  building: "Building transaction…",
  simulating: "Simulating on Soroban…",
  signing: "Waiting for wallet signature…",
  submitting: "Submitting to network…",
  confirming: "Confirming on ledger…",
  success: "Confirmed!",
  failed: "Failed",
}

interface CircleState {
  status: number
  member_count: number
  max_members: number
  total_rounds: number
  current_round: number
  total_pool: string
  name: string
}

function statusTagToCode(tag: string): number {
  const map: Record<string, number> = {
    Pending: 0, Active: 1, PayoutReady: 2, Completed: 3, Disputed: 4, Cancelled: 5,
  }
  return map[tag] ?? 0
}

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

  const [circleState, setCircleState] = useState<CircleState | null>(null)
  const [circleLoading, setCircleLoading] = useState(false)
  const [txStep, setTxStep] = useState<TxStep>("idle")
  const [circleTxHash, setCircleTxHash] = useState("")
  const [appError, setAppError] = useState<AppError | null>(null)

  useEffect(() => {
    ensureKitInit()
  }, [])

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
    setAppError(null)
    ensureKitInit()
    try {
      const { address: addr } = await StellarWalletsKit.authModal()
      setAddress(addr)
    } catch (e: any) {
      setAppError(classifyError(e))
    }
  }

  const disconnect = () => {
    StellarWalletsKit.disconnect().catch(() => {})
    setAddress(""); setBalance(""); setTxHash(""); setTxError("")
    setCircleState(null); setCircleTxHash(""); setTxStep("idle"); setAppError(null)
  }

  useEffect(() => {
    if (!address) return
    horizon.loadAccount(address).then((acc: any) => {
      const xlm = acc.balances.find((b: any) => b.asset_type === "native")
      setBalance(xlm ? parseFloat(xlm.balance).toFixed(2) : "0.00")
    }).catch(() => setBalance("0.00"))
  }, [address])

  const sendTx = async () => {
    if (!address || !toAddress || !amount) return
    setLoading(true); setTxHash(""); setTxError("")
    try {
      const S = await import("@stellar/stellar-sdk")
      const account = await horizon.loadAccount(address)
      const tx = new S.TransactionBuilder(account, { fee: S.BASE_FEE, networkPassphrase: S.Networks.TESTNET })
        .addOperation(S.Operation.payment({ destination: toAddress, asset: S.Asset.native(), amount }))
        .setTimeout(30).build()
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(tx.toXDR(), { networkPassphrase: S.Networks.TESTNET, address })
      const result = await horizon.submitTransaction(S.TransactionBuilder.fromXDR(signedTxXdr, S.Networks.TESTNET))
      setTxHash(result.hash)
    } catch (e: any) {
      const classified = classifyError(e)
      setTxError(classified.message)
    }
    setLoading(false)
  }

  const loadCircleState = useCallback(async () => {
    if (!address || !CONTRACT_ADDRESSES.chitChain) return
    setCircleLoading(true)
    setAppError(null)
    try {
      const S = await import("@stellar/stellar-sdk")
      const server = new S.rpc.Server(STELLAR_CONFIG.rpcUrl)
      const account = await server.getAccount(address)
      const contract = new S.Contract(CONTRACT_ADDRESSES.chitChain)
      const tx = new S.TransactionBuilder(account, { fee: S.BASE_FEE, networkPassphrase: STELLAR_CONFIG.networkPassphrase })
        .addOperation(contract.call("get_circle_state"))
        .setTimeout(30)
        .build()

      const sim = await server.simulateTransaction(tx)
      if (S.rpc.Api.isSimulationError(sim)) {
        throw new Error(sim.error)
      }
      if (!sim.result?.retval) {
        setCircleState(null)
        return
      }
      const native: any = S.scValToNative(sim.result.retval)
      if (!native) { setCircleState(null); return }

      const rawStatus = native.status
      let statusTag: string | undefined
      if (Array.isArray(rawStatus)) statusTag = rawStatus[0]
      else if (rawStatus?.tag) statusTag = rawStatus.tag
      else if (typeof rawStatus === "string") statusTag = rawStatus

      setCircleState({
        status: statusTag !== undefined ? statusTagToCode(statusTag) : 0,
        member_count: Number(native.member_count ?? 0),
        max_members: Number(native.config?.max_members ?? 0),
        total_rounds: Number(native.config?.total_rounds ?? 0),
        current_round: Number(native.current_round ?? 0),
        total_pool: String(native.total_pool ?? "0"),
        name: native.config?.name ?? "",
      })
    } catch (e: any) {
      setAppError(classifyError(e))
      setCircleState(null)
    } finally {
      setCircleLoading(false)
    }
  }, [address])

  useEffect(() => {
    if (address) loadCircleState()
  }, [address, loadCircleState])

  const joinCircle = async () => {
    if (!address || !CONTRACT_ADDRESSES.chitChain) return
    setAppError(null)
    setCircleTxHash("")
    setTxStep("building")
    try {
      const S = await import("@stellar/stellar-sdk")
      const server = new S.rpc.Server(STELLAR_CONFIG.rpcUrl)
      const account = await server.getAccount(address)
      const contract = new S.Contract(CONTRACT_ADDRESSES.chitChain)

      const tx = new S.TransactionBuilder(account, { fee: S.BASE_FEE, networkPassphrase: STELLAR_CONFIG.networkPassphrase })
        .addOperation(contract.call("join_circle", S.nativeToScVal(address, { type: "address" })))
        .setTimeout(60)
        .build()

      setTxStep("simulating")
      const prepared = await server.prepareTransaction(tx)

      setTxStep("signing")
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(prepared.toXDR(), {
        networkPassphrase: STELLAR_CONFIG.networkPassphrase,
        address,
      })

      setTxStep("submitting")
      const signedTx = S.TransactionBuilder.fromXDR(signedTxXdr, STELLAR_CONFIG.networkPassphrase)
      const sendResult = await server.sendTransaction(signedTx)

      if (sendResult.status === "ERROR") {
        throw new Error("Transaction was rejected by the network before submission.")
      }

      setTxStep("confirming")
      setCircleTxHash(sendResult.hash)

      let getResult = await server.getTransaction(sendResult.hash)
      let attempts = 0
      while (getResult.status === "NOT_FOUND" && attempts < 15) {
        await new Promise((r) => setTimeout(r, 2000))
        getResult = await server.getTransaction(sendResult.hash)
        attempts++
      }

      if (getResult.status === "SUCCESS") {
        setTxStep("success")
        loadCircleState()
      } else {
        throw new Error(`Transaction ${getResult.status.toLowerCase()}. It may have already been processed, or the circle may be full.`)
      }
    } catch (e: any) {
      setTxStep("failed")
      setAppError(classifyError(e))
    }
  }

  return (
    <main className="min-h-screen bg-[#030308] text-white overflow-hidden relative">
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" />
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-30%] left-[-20%] w-[800px] h-[800px] bg-violet-700/15 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute bottom-[-30%] right-[-20%] w-[800px] h-[800px] bg-indigo-700/15 rounded-full blur-[140px] animate-pulse" style={{animationDelay: '1s'}} />
        <div className="absolute top-[40%] left-[50%] w-[400px] h-[400px] bg-fuchsia-700/10 rounded-full blur-[100px] animate-pulse" style={{animationDelay: '2s'}} />
      </div>
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.03]"
        style={{backgroundImage: 'linear-gradient(rgba(139,92,246,1) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,1) 1px, transparent 1px)', backgroundSize: '60px 60px'}} />

      <nav className="relative z-10 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-lg flex items-center justify-center shadow-lg shadow-violet-500/40">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-bold text-lg bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">ChitChain</span>
        </div>
        <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
          <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-xs text-emerald-400 font-medium">Testnet Live</span>
        </div>
      </nav>

      <div className="relative z-10 flex flex-col items-center justify-center px-4 pt-8 pb-20">
        <div className="text-center mb-12 max-w-2xl">
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-xs text-violet-300 mb-6 backdrop-blur-sm">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
            Built on Stellar Blockchain
          </div>
          <h1 className="text-6xl md:text-7xl font-black mb-4 leading-none">
            <span className="text-white">Save Together,</span>
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">Trust No One</span>
          </h1>
          <p className="text-zinc-400 text-lg mb-2">The world&apos;s first trustless group savings protocol.</p>
          <p className="text-zinc-500 text-sm mb-8">Powered by Soroban smart contracts.</p>
          <div className="flex items-center justify-center gap-8 text-center">
            <div><p className="text-2xl font-bold text-violet-400">100%</p><p className="text-xs text-zinc-500">On-chain</p></div>
            <div><p className="text-2xl font-bold text-violet-400">0</p><p className="text-xs text-zinc-500">Middlemen</p></div>
            <div><p className="text-2xl font-bold text-violet-400">Instant</p><p className="text-xs text-zinc-500">Payouts</p></div>
            <div><p className="text-2xl font-bold text-violet-400">Stellar</p><p className="text-xs text-zinc-500">Powered</p></div>
          </div>
        </div>

        {!address ? (
          <div className="w-full max-w-md">
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-3xl blur opacity-30 group-hover:opacity-50 transition duration-500" />
              <div className="relative bg-[#0d0d1a] border border-white/5 rounded-3xl p-8 backdrop-blur-xl text-center">
                <div className="w-16 h-16 mx-auto mb-5 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-2xl flex items-center justify-center shadow-xl shadow-violet-500/30">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold mb-2">Connect Wallet</h2>
                <p className="text-sm text-zinc-500 mb-6">Start your trustless savings journey on Stellar testnet</p>
                <button
                  onClick={connect}
                  className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-bold py-4 rounded-xl transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] shadow-xl shadow-violet-500/20"
                >
                  Connect Wallet
                </button>
                <p className="text-xs text-zinc-600 mt-3">Supports Freighter, xBull, Albedo, Lobstr, and more</p>

                <div className="mt-6 grid grid-cols-3 gap-3">
                  {[["Secure"], ["Fast"], ["Trustless"]].map(([label]) => (
                    <div key={label} className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
                      <p className="text-xs text-zinc-400 font-medium">{label}</p>
                    </div>
                  ))}
                </div>

                {appError && (
                  <div className="mt-4 bg-rose-500/5 border border-rose-500/20 rounded-xl p-4 text-left">
                    <p className="text-xs font-bold text-rose-400 mb-1">
                      {appError.kind === "wallet_not_found" && "Wallet Not Found"}
                      {appError.kind === "user_rejected" && "Request Rejected"}
                      {appError.kind === "contract_error" && "Connection Failed"}
                    </p>
                    <p className="text-xs text-rose-700">{appError.message}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-lg space-y-4">
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

            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-fuchsia-600 to-violet-600 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-500" />
              <div className="relative bg-[#0d0d1a] border border-white/5 rounded-3xl p-6 backdrop-blur-xl">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <div className="w-7 h-7 bg-fuchsia-500/20 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-fuchsia-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-4.13a4 4 0 10-4-4 4 4 0 004 4zm6 0a4 4 0 10-4-4" />
                      </svg>
                    </div>
                    Savings Circle
                  </h3>
                  <button onClick={loadCircleState} disabled={circleLoading} className="text-xs text-zinc-500 hover:text-zinc-300 transition disabled:opacity-40">
                    {circleLoading ? "Loading…" : "Refresh"}
                  </button>
                </div>

                {circleState ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-white/3 rounded-xl p-3">
                      <span className="text-xs text-zinc-500">Status</span>
                      <span className={`text-xs font-bold ${statusCodeToColor(circleState.status)}`}>
                        {statusCodeToLabel(circleState.status)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-white/3 rounded-xl p-3">
                      <span className="text-xs text-zinc-500">Members</span>
                      <span className="text-xs font-bold text-zinc-200">{circleState.member_count} / {circleState.max_members}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white/3 rounded-xl p-3">
                      <span className="text-xs text-zinc-500">Round</span>
                      <span className="text-xs font-bold text-zinc-200">{circleState.current_round} / {circleState.total_rounds}</span>
                    </div>
                    <div className="flex items-center justify-between bg-white/3 rounded-xl p-3">
                      <span className="text-xs text-zinc-500">Pool</span>
                      <span className="text-xs font-bold text-zinc-200">{formatXLM(circleState.total_pool)} XLM</span>
                    </div>

                    <button
                      onClick={joinCircle}
                      disabled={txStep !== "idle" && txStep !== "success" && txStep !== "failed"}
                      className="relative w-full overflow-hidden bg-gradient-to-r from-fuchsia-600 to-violet-600 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-600 text-white font-bold py-4 rounded-xl transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] shadow-xl shadow-fuchsia-500/20 mt-2"
                    >
                      {txStep !== "idle" && txStep !== "success" && txStep !== "failed" ? (
                        <span className="flex items-center justify-center gap-2">
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          {STEP_LABELS[txStep]}
                        </span>
                      ) : "Join Circle"}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-600 text-center py-4">
                    {circleLoading ? "Reading circle state from the contract…" : "No circle data yet. Tap Refresh."}
                  </p>
                )}
              </div>
            </div>

            {circleTxHash && (txStep === "confirming" || txStep === "success") && (
              <div className="relative">
                <div className={`absolute -inset-0.5 rounded-3xl blur opacity-30 ${txStep === "success" ? "bg-gradient-to-r from-emerald-500 to-teal-500 animate-pulse" : "bg-gradient-to-r from-amber-500 to-yellow-500 animate-pulse"}`} />
                <div className={`relative rounded-3xl p-5 border ${txStep === "success" ? "bg-[#0a1a0f] border-emerald-500/20" : "bg-[#1a1508] border-amber-500/20"}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${txStep === "success" ? "bg-emerald-500/20" : "bg-amber-500/20"}`}>
                      {txStep === "success" ? (
                        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      ) : (
                        <svg className="animate-spin w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      )}
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${txStep === "success" ? "text-emerald-400" : "text-amber-400"}`}>
                        {txStep === "success" ? "Joined Circle!" : "Confirming on ledger…"}
                      </p>
                      <p className={`text-xs ${txStep === "success" ? "text-emerald-700" : "text-amber-700"}`}>
                        {txStep === "success" ? "Contract call confirmed on Stellar testnet" : "Waiting for ledger close"}
                      </p>
                    </div>
                  </div>
                  <div className={`rounded-xl p-3 ${txStep === "success" ? "bg-emerald-500/5" : "bg-amber-500/5"}`}>
                    <a href={explorerTxUrl(circleTxHash)} target="_blank" rel="noreferrer"
                      className={`font-mono text-xs break-all underline decoration-dotted ${txStep === "success" ? "text-emerald-400/80 hover:text-emerald-300" : "text-amber-400/80 hover:text-amber-300"}`}>
                      {circleTxHash}
                    </a>
                  </div>
                </div>
              </div>
            )}

            {appError && (
              <div className="bg-rose-500/5 border border-rose-500/20 rounded-3xl p-5">
                <p className="text-sm font-bold text-rose-400 mb-1">
                  {appError.kind === "wallet_not_found" && "Wallet Not Found"}
                  {appError.kind === "user_rejected" && "Request Rejected"}
                  {appError.kind === "contract_error" && "Contract Call Failed"}
                </p>
                <p className="text-xs text-rose-700">{appError.message}</p>
              </div>
            )}

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
