import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DurationNotice } from "@/components/duration-notice";

describe("DurationNotice", () => {
  it("renders a duration and long-trip warning", () => {
    render(
      <DurationNotice departureDate="2026-05-01" returnDate="2026-06-15" />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("46-day trip");
    expect(screen.getByRole("status")).toHaveTextContent(
      "quantity-limit verification",
    );
  });

  it("renders an accessible date range error", () => {
    render(
      <DurationNotice departureDate="2026-05-12" returnDate="2026-05-11" />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Return date must be on or after departure date",
    );
  });
});
