import Link from "next/link";
import { TripPlanner } from "@/components/trip-planner";

export default function TripPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/"
          className="no-print inline-flex min-h-11 items-center rounded-full border border-white/15 px-5 font-medium text-slate-100 transition hover:bg-white/10"
        >
          ← Back to overview
        </Link>
        <div className="my-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
            Private-by-default trip check
          </p>
          <h1 className="mt-3 max-w-4xl text-3xl font-semibold text-white sm:text-5xl">
            Resolve every stop before you travel with medicine.
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">
            Search the airport catalog, include every layover, and see both
            available preparation guidance and explicit coverage gaps for each
            jurisdiction on your route.
          </p>
        </div>
        <TripPlanner />
      </div>
    </main>
  );
}
