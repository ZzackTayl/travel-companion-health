import Link from "next/link";

export default function TripPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100 sm:px-8 lg:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-slate-950/30 backdrop-blur">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Trip planner shell</p>
          <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
            Route builder and guidance flow placeholder
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
            This page will host the route builder, medicine prompts, guidance results, and travel card experience as the MVP is built out.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-lg font-semibold text-white">Upcoming work</h2>
            <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-300">
              <li>• Airport search and route input</li>
              <li>• Optional medicine category prompts</li>
              <li>• Guidance evaluation and source panels</li>
            </ul>
          </section>
          <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
            <h2 className="text-lg font-semibold text-white">Status</h2>
            <p className="mt-4 text-sm leading-7 text-slate-300">
              The foundation is in place and ready for the real product flow. This page is intentionally a scaffold so the next implementation steps stay clear.
            </p>
          </section>
        </div>

        <Link
          href="/"
          className="inline-flex w-fit rounded-full border border-white/15 px-5 py-3 font-medium text-slate-100 transition hover:bg-white/10"
        >
          Back to overview
        </Link>
      </div>
    </main>
  );
}
