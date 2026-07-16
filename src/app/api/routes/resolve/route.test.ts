import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/routes/resolve/route";

function request(body: unknown) {
  return new Request("http://localhost/api/routes/resolve", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/routes/resolve", () => {
  it("resolves an ordered route and its jurisdictions", async () => {
    const response = await POST(
      request({ routeStopIds: ["airport_jfk", "airport_lhr", "airport_dxb"] }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.stops.map(({ role }: { role: string }) => role)).toEqual([
      "origin",
      "transit",
      "destination",
    ]);
    expect(body.countries[1]).toMatchObject({
      countryCode: "GB",
      transitOnly: true,
    });
  });

  it("rejects malformed and unknown routes", async () => {
    const shortResponse = await POST(
      request({ routeStopIds: ["airport_jfk"] }),
    );
    const unknownResponse = await POST(
      request({ routeStopIds: ["airport_jfk", "airport_missing"] }),
    );

    expect(shortResponse.status).toBe(400);
    expect(unknownResponse.status).toBe(422);
  });
});
