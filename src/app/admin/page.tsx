import Link from "next/link";

export default function AdminPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100 sm:px-8 lg:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-slate-950/30 backdrop-blur">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">Admin shell</p>
          <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">
            Content workflow placeholder
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
            This area will eventually host guidance editing, source review, publish workflow, and QA controls for the admin experience.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-lg font-semibold text-white">Planned admin modules</h2>
          <ul className="mt-4 space-y-2 text-sm leading-7 text-slate-300">
            <li>• Guidance editor with draft and reviewed statuses</li>
            <li>• Source evidence and confidence scoring</li>
            <li>• Publish workflow and content QA dashboard</li>
          </ul>
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
