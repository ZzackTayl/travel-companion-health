import Link from "next/link";
import { SectionHeading } from "@/components/section-heading";

const outcomes = [
  {
    title: "Check every stop",
    description:
      "Include layovers so destination, transit, and airport screening gaps remain visible.",
  },
  {
    title: "Know what to verify",
    description:
      "Missing or expired guidance is shown as unknown, never as implied permission.",
  },
  {
    title: "Keep one clear card",
    description:
      "Copy, print, or save a concise preparation card without exporting medicine names.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:px-10 lg:py-24">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl sm:p-10 lg:p-14">
          <p className="text-sm font-medium text-cyan-300">
            Private by default · Accessible · Source focused
          </p>
          <h1 className="mt-8 max-w-3xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            Travel with medicines more confidently.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Add every airport on your route to build a preparation checklist
            for destinations and transit stops. Medicine names are optional and
            stay in this browser when you save a trip.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/trip"
              className="rounded-full bg-cyan-400 px-5 py-3 font-medium text-slate-950 transition hover:bg-cyan-300"
            >
              Plan a trip
            </Link>
            <a
              href="#how-it-works"
              className="rounded-full border border-white/20 px-5 py-3 font-medium transition hover:bg-white/10"
            >
              How it works
            </a>
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="mx-auto max-w-7xl px-6 pb-16 sm:px-8 lg:px-10"
      >
        <SectionHeading
          eyebrow="How it works"
          title="Check every stop without sending medicine names"
          description="The server receives airport IDs, dates, and normalized category flags. It does not receive medicine names."
        />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {outcomes.map((outcome) => (
            <article
              key={outcome.title}
              className="rounded-2xl border border-white/10 bg-white/5 p-6"
            >
              <h2 className="text-lg font-semibold text-white">
                {outcome.title}
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">
                {outcome.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-20 sm:px-8 lg:px-10">
        <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-6 text-sm leading-7 text-amber-100">
          Local development currently uses clearly labeled prototype fixture
          data. It is informational, not legal or medical advice. Production
          guidance remains unavailable until governed, reviewer-published
          content is configured.
        </div>
      </section>
    </main>
  );
}