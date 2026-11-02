import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getBillDetail,
  getHearingTranscript,
  getSpeakerActivity,
  listAvailableStates,
  resolveBaseUrl,
  resolveConfig,
  searchBills,
  searchCommitteeHearings,
  searchHearingTestimony,
} from "../src/legislens.js";
import type { FetchFn, HttpResponse, LegislensConfig } from "../src/types.js";

function jsonResponse(body: unknown, status = 200, statusText = "OK"): HttpResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: { get: () => "application/json" },
    text: async () => JSON.stringify(body),
    json: async () => body,
  };
}

interface Captured {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  calls: number;
}

function fakeFetch(body: unknown = {}): { fetchFn: FetchFn; captured: Captured } {
  const captured: Captured = { calls: 0 };
  const fetchFn: FetchFn = async (url, init) => {
    captured.calls += 1;
    captured.url = url;
    captured.method = init?.method;
    captured.headers = init?.headers;
    captured.body = init?.body;
    return jsonResponse(body);
  };
  return { fetchFn, captured };
}

const BASE = "https://api.gavelin.ai";
const CFG: LegislensConfig = { baseUrl: BASE, apiKey: "test-key" };

describe("config resolution", () => {
  it("defaults base URL, strips trailing slashes, trims key", () => {
    assert.equal(resolveBaseUrl(undefined), BASE);
    assert.equal(resolveBaseUrl("  "), BASE);
    assert.equal(resolveBaseUrl("https://example.test/api/"), "https://example.test/api");
    const cfg = resolveConfig({ GAVELIN_API_KEY: " key " });
    assert.equal(cfg.apiKey, "key");
    assert.equal(cfg.baseUrl, BASE);
    const custom = resolveConfig({ GAVELIN_API_KEY: "k", LEGISLENS_API_URL: "https://example.test/" });
    assert.equal(custom.baseUrl, "https://example.test");
  });
});

describe("missing key gate", () => {
  it("errors BEFORE any request when the key is missing (spy)", async () => {
    let called = false;
    const spy: FetchFn = async () => { called = true; return jsonResponse({}); };
    const noKey: LegislensConfig = { baseUrl: BASE, apiKey: "" };
    await assert.rejects(() => listAvailableStates(spy, noKey), /GAVELIN_API_KEY is required/);
    await assert.rejects(() => searchBills(spy, noKey, { query: "x" }), /GAVELIN_API_KEY is required/);
    await assert.rejects(() => getBillDetail(spy, noKey, { bill_id: "b1" }), /GAVELIN_API_KEY is required/);
    assert.equal(called, false);
  });

  it("sends Bearer key header with requests", async () => {
    const { fetchFn, captured } = fakeFetch({ ok: true });
    await listAvailableStates(fetchFn, CFG);
    assert.equal(captured.headers?.Authorization, "Bearer test-key");
  });
});

describe("search_bills", () => {
  it("hits /bills with all filters as query params", async () => {
    const payload = [{ id: "CA-AB1", title: "Housing" }];
    const { fetchFn, captured } = fakeFetch(payload);
    const out = await searchBills(fetchFn, CFG, {
      query: "housing", state: "CA", sponsor: "Lee", committee: "Housing", status: "passed", chamber: "assembly",
    });
    assert.deepEqual(out, payload);
    assert.equal(captured.method, "GET");
    const url = new URL(captured.url ?? "");
    assert.equal(url.pathname, "/bills");
    assert.equal(url.searchParams.get("query"), "housing");
    assert.equal(url.searchParams.get("state"), "CA");
    assert.equal(url.searchParams.get("sponsor"), "Lee");
    assert.equal(url.searchParams.get("committee"), "Housing");
    assert.equal(url.searchParams.get("status"), "passed");
    assert.equal(url.searchParams.get("chamber"), "assembly");
  });

  it("with no filters has no query string", async () => {
    const { fetchFn, captured } = fakeFetch([]);
    await searchBills(fetchFn, CFG, {});
    assert.equal(captured.url, `${BASE}/bills`);
  });
});

describe("search_hearing_testimony", () => {
  it("hits /hearing-testimony with query, speaker and committee", async () => {
    const { fetchFn, captured } = fakeFetch([{ text: "segment" }]);
    await searchHearingTestimony(fetchFn, CFG, { query: "rent control", speaker: "Lee", committee: "Housing" });
    const url = new URL(captured.url ?? "");
    assert.equal(url.pathname, "/hearing-testimony");
    assert.equal(url.searchParams.get("query"), "rent control");
    assert.equal(url.searchParams.get("speaker"), "Lee");
    assert.equal(url.searchParams.get("committee"), "Housing");
  });

  it("blank query is rejected before any request", async () => {
    const { fetchFn, captured } = fakeFetch({});
    await assert.rejects(() => searchHearingTestimony(fetchFn, CFG, { query: "  " }), /query/);
    assert.equal(captured.calls, 0);
  });
});

describe("bill detail and speaker activity", () => {
  it("get_bill_detail hits /bills/{id} with encoding", async () => {
    const { fetchFn, captured } = fakeFetch({ id: "CA AB 1" });
    await getBillDetail(fetchFn, CFG, { bill_id: "CA AB 1" });
    assert.equal(captured.url, `${BASE}/bills/CA%20AB%201`);
  });

  it("blank bill_id is rejected before any request", async () => {
    const { fetchFn, captured } = fakeFetch({});
    await assert.rejects(() => getBillDetail(fetchFn, CFG, { bill_id: "" }), /bill_id/);
    assert.equal(captured.calls, 0);
  });

  it("get_speaker_activity hits /speakers/{speaker}/activity", async () => {
    const { fetchFn, captured } = fakeFetch({ speaker: "Jane Lee" });
    await getSpeakerActivity(fetchFn, CFG, { speaker: "Jane Lee" });
    assert.equal(captured.url, `${BASE}/speakers/Jane%20Lee/activity`);
  });

  it("blank speaker is rejected before any request", async () => {
    const { fetchFn, captured } = fakeFetch({});
    await assert.rejects(() => getSpeakerActivity(fetchFn, CFG, { speaker: " " }), /speaker/);
    assert.equal(captured.calls, 0);
  });
});

describe("committee hearings and transcripts", () => {
  it("search_committee_hearings hits /committee-hearings with filters", async () => {
    const { fetchFn, captured } = fakeFetch([]);
    await searchCommitteeHearings(fetchFn, CFG, {
      topic: "housing", committee: "Housing", chamber: "senate", from_date: "2026-01-01", to_date: "2026-02-01",
    });
    const url = new URL(captured.url ?? "");
    assert.equal(url.pathname, "/committee-hearings");
    assert.equal(url.searchParams.get("topic"), "housing");
    assert.equal(url.searchParams.get("from_date"), "2026-01-01");
    assert.equal(url.searchParams.get("to_date"), "2026-02-01");
    assert.equal(url.searchParams.get("chamber"), "senate");
  });

  it("get_hearing_transcript hits /hearings/{id}/transcript", async () => {
    const { fetchFn, captured } = fakeFetch({ segments: [] });
    await getHearingTranscript(fetchFn, CFG, { hearing_id: "h-9" });
    assert.equal(captured.url, `${BASE}/hearings/h-9/transcript`);
  });

  it("blank hearing_id is rejected before any request", async () => {
    const { fetchFn, captured } = fakeFetch({});
    await assert.rejects(() => getHearingTranscript(fetchFn, CFG, { hearing_id: "" }), /hearing_id/);
    assert.equal(captured.calls, 0);
  });
});

describe("states and base URL", () => {
  it("list_available_states hits /states", async () => {
    const payload = [{ state: "CA", data_types: ["bills", "transcripts"] }];
    const { fetchFn, captured } = fakeFetch(payload);
    const out = await listAvailableStates(fetchFn, CFG);
    assert.deepEqual(out, payload);
    assert.equal(captured.url, `${BASE}/states`);
  });

  it("honours a custom base URL", async () => {
    const { fetchFn, captured } = fakeFetch({});
    await listAvailableStates(fetchFn, { baseUrl: "https://example.test/api/", apiKey: "k" });
    assert.equal(captured.url, "https://example.test/api/states");
  });
});

describe("errors", () => {
  it("HTTP 401 surfaces status and upstream message", async () => {
    const failing: FetchFn = async () => jsonResponse({ message: "bad key" }, 401, "Unauthorized");
    await assert.rejects(() => listAvailableStates(failing, CFG), /HTTP 401.*bad key/);
  });

  it("network failure is wrapped with context", async () => {
    const failing: FetchFn = async () => { throw new Error("socket hang up"); };
    await assert.rejects(() => listAvailableStates(failing, CFG), /Gavelin API request failed: socket hang up/);
  });
});
