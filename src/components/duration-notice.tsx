import { getDurationWarning, getTripDuration } from "@/lib/dates";

interface DurationNoticeProps {
  departureDate: string;
  returnDate: string;
}

export function DurationNotice({
  departureDate,
  returnDate,
}: DurationNoticeProps) {
  if (!departureDate || !returnDate) return null;

  let duration: number | null = null;
  let errorMessage = "";
  try {
    duration = getTripDuration(departureDate, returnDate);
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Check the trip dates";
  }

  if (errorMessage) {
    return (
      <p role="alert" className="text-sm text-rose-300">
        {errorMessage}
      </p>
    );
  }

  const warning = getDurationWarning(duration);
  return (
    <div
      role="status"
      className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-3 text-sm"
    >
      <p>{duration}-day trip</p>
      {warning ? <p className="mt-1 text-amber-200">{warning}</p> : null}
    </div>
  );
}
