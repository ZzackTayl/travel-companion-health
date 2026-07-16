import Link from "next/link";
import { overviewCards, milestoneItems, workflowSteps } from "@/lib/content";
import { SectionHeading } from "@/components/section-heading";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-16 sm:px-8 lg:px-10 lg:py-24">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl shadow-slate-950/30 backdrop-blur sm:p-10 lg:p-14">
          <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-cyan-300">
            <span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1">
              MVP foundation
            </span>
            <span>Privacy-first • Accessible • Official-source focused</span>
          </div>
          <div className="mt-8 grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Know how to travel with your medicines before you fly.
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
                This starter app captures the core product direction from the planning docs: itinerary-based guidance, local-first privacy, accessibility, and a simple route-to-card experience.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/trip"
                  className="rounded-full bg-cyan-400 px-5 py-3 font-medium text-slate-950 transition hover:bg-cyan-300"
                >
                  Open trip planner
                </Link>
                <Link
                  href="/admin"
                  className="rounded-full border border-white/15 px-5 py-3 font-medium text-slate-100 transition hover:bg-white/10"
                >
                  Review admin shell
                </Link>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-400">
                Planned MVP flow
              </p>
              <ol className="mt-4 space-y-3 text-sm text-slate-300">
                {workflowSteps.map((step) => (
                  <li key={step} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-16 sm:px-8 lg:px-10">
        <SectionHeading
          eyebrow="Product foundation"
          title="A clear MVP blueprint, ready for implementation"
          description="The app skeleton is intentionally simple so you can build the real experience incrementally without losing the product vision."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {overviewCards.map((card) => (
            <article key={card.title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-lg font-semibold text-white">{card.title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-300">{card.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20 sm:px-8 lg:px-10">
        <SectionHeading
          eyebrow="Implementation milestones"
          title="The repo is structured around the documented build plan"
          description="You can pick up the work in the same order the product docs describe: data model, route flow, guidance evaluation, cards, and admin workflow."
        />
        <div className="mt-8 space-y-3">
          {milestoneItems.map((item) => (
            <div key={item.title} className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
                {item.title}
              </p>
              <p className="mt-2 text-sm leading-7 text-slate-300">{item.description}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
