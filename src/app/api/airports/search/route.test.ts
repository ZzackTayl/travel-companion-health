import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/airports/search/route";

describe("GET /api/airports/search", () => {
  it("returns ranked airport results", async () => {
    const response = GET(
      new Request("http://localhost/api/airports/search?q=JFK"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.results[0]).toMatchObject({
      id: "airport_jfk",
      iataCode: "JFK",
    });
  });

  it("validates query and result limit", async () => {
    const emptyResponse = GET(
      new Request("http://localhost/api/airports/search?q="),
    );
    const limitResponse = GET(
      new Request("http://localhost/api/airports/search?q=London&limit=50"),
    );

    expect(emptyResponse.status).toBe(400);
    expect(limitResponse.status).toBe(400);
  });
});
