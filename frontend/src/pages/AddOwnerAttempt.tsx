import { Link } from 'react-router-dom'

export function AddOwnerAttempt() {
  return (
    <main className="min-h-screen bg-black text-zinc-100">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight">Try CSW owner add flow</h1>
        <p className="text-zinc-300">
          This page is a quick entry point for testing CSW owner-add behavior on Base App managed wallets.
        </p>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
          <p className="text-sm text-zinc-300">
            For production flows, continue through waitlist/account setup. For low-level debugging use the dev probe.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to="/waitlist"
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200"
            >
              Open waitlist flow
            </Link>
            <Link
              to="/dev/csw-signature-probe"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:border-zinc-500"
            >
              Open CSW signature probe
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
