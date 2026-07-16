import Link from "next/link";
import { TripPlanner } from "@/components/trip-planner";

export default function TripPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-8 sm:py-12 lg:px-10">
      <div className="mx-auto mb-8 flex max-w-7xl print:hidden">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-slate-300 transition hover:text-white"
        >
          ← Travel Companion Health
        </Link>
      </div>
      <TripPlanner />
    </main>
  );
}
