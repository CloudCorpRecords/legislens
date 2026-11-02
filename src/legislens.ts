/**
 * legislens core: US state legislative records — bills from all
 * 50 states plus DC and speaker-attributed hearing transcripts —
 * served by a hosted API.
 *
 * This rebuild is a forwarding client (labelled reconstruction
 * of wire paths): it does not hold the legislative archive
 * itself. Each tool call becomes one request to the hosted API
 * and the upstream payload is returned.
 *
 * Auth: GAVELIN_API_KEY is required; a missing or blank key is
 * an error raised BEFORE any request is made. The key is sent
 * with every request as `Authorization: Bearer <key>`. The base
 * URL comes from LEGISLENS_API_URL and defaults to
 * https://api.gavelin.ai (labelled reconstruction).
 *
 * Endpoint map (labelled reconstruction):
 *   search_bills             GET /bills?query=&state=&sponsor=&committee=&status=&chamber=
 *   search_hearing_testimony GET /hearing-testimony?query=&speaker=&committee=
 *   get_bill_detail          GET /bills/{bill_id}
 *   get_speaker_activity     GET /speakers/{speaker}/activity
 *   search_committee_hearings GET /committee-hearings?topic=&committee=&chamber=&from_date=&to_date=
 *   get_hearing_transcript   GET /hearings/{hearing_id}/transcript
 *   list_available_states    GET /states
 *
 * All HTTP goes through an injected FetchFn so everything is
 * testable offline with a fake fetch.
 */
import type {
  BillDetailOptions,
  FetchFn,
  HearingTranscriptOptions,
  LegislensConfig,
  SearchBillsOptions,
  SearchHearingsOptions,
  SearchTestimonyOptions,
  SpeakerActivityOptions,
} from "./types.js";

export const VERSION = "0.1.0";

export const DEFAULT_BASE_URL = "https://api.gavelin.ai";

export const BASE_URL_ENV = "LEGISLENS_API_URL";
export const API_KEY_ENV = "GAVELIN_API_KEY";

/** Resolve the API base URL: env value when non-blank, else default. Trailing slashes are stripped. */
export function resolveBaseUrl(value?: string): string {
  const v = typeof value === "string" ? value.trim() : "";
  return (v ? v : DEFAULT_BASE_URL).replace(/\/+$/, "");
}

/**
 * Build a config from environment-style values. The key is kept
 * as given (possibly blank); callApi rejects a blank key before
 * any request, which is the missing-key gate.
 */
export function resolveConfig(env: {
  [BASE_URL_ENV]?: string;
  [API_KEY_ENV]?: string;
}): LegislensConfig {
  return {
    baseUrl: resolveBaseUrl(env[BASE_URL_ENV]),
    apiKey: typeof env[API_KEY_ENV] === "string" ? env[API_KEY_ENV].trim() : "",
  };
}

function requireNonEmpty(value: unknown, field: string): string {
  const v = typeof value === "string" ? value.trim() : "";
  if (!v) throw new Error(`${field} must be a non-empty string`);
  return v;
}

function optionalParam(value: unknown): string | undefined {
  const v = typeof value === "string" ? value.trim() : "";
  return v ? v : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function queryFrom(entries: Record<string, string | undefined>): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(entries)) {
    const val = optionalParam(v);
    if (val) out[k] = val;
  }
  return Object.keys(out).length ? out : undefined;
}

async function callApi(
  fetchFn: FetchFn,
  config: LegislensConfig,
  method: string,
  path: string,
  opts: { query?: Record<string, string> } = {},
): Promise<unknown> {
  // Missing-key gate: errors BEFORE any request is made.
  if (!config || typeof config.apiKey !== "string" || !config.apiKey.trim()) {
    throw new Error(`${API_KEY_ENV} is required: set a Gavelin API key before making requests`);
  }
  let url = `${resolveBaseUrl(config.baseUrl)}${path}`;
  if (opts.query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) params.set(k, v);
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${config.apiKey.trim()}`,
  };
  const init: { method: string; headers: Record<string, string> } = { method, headers };
  let response;
  try {
    response = await fetchFn(url, init);
  } catch (err) {
    throw new Error(
      `Gavelin API request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  if (!response.ok) {
    let detail = "";
    try {
      const payload: unknown = await response.json();
      if (isRecord(payload)) {
        if (typeof payload.message === "string" && payload.message) {
          detail = `: ${payload.message}`;
        } else if (typeof payload.error === "string" && payload.error) {
          detail = `: ${payload.error}`;
        }
      }
    } catch {
      // A non-JSON error body still reports its HTTP status below.
    }
    throw new Error(
      `Gavelin API request failed: HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}${detail}`,
    );
  }
  try {
    return await response.json();
  } catch {
    throw new Error("Gavelin API returned a response that was not valid JSON");
  }
}

export async function searchBills(fetchFn: FetchFn, config: LegislensConfig, options: SearchBillsOptions = {}): Promise<unknown> {
  return callApi(fetchFn, config, "GET", "/bills", {
    query: queryFrom({
      query: options.query,
      state: options.state,
      sponsor: options.sponsor,
      committee: options.committee,
      status: options.status,
      chamber: options.chamber,
    }),
  });
}

export async function searchHearingTestimony(fetchFn: FetchFn, config: LegislensConfig, options: SearchTestimonyOptions): Promise<unknown> {
  const query: Record<string, string> = { query: requireNonEmpty(options.query, "query") };
  const speaker = optionalParam(options.speaker);
  const committee = optionalParam(options.committee);
  if (speaker) query.speaker = speaker;
  if (committee) query.committee = committee;
  return callApi(fetchFn, config, "GET", "/hearing-testimony", { query });
}

export async function getBillDetail(fetchFn: FetchFn, config: LegislensConfig, options: BillDetailOptions): Promise<unknown> {
  return callApi(fetchFn, config, "GET", `/bills/${encodeURIComponent(requireNonEmpty(options.bill_id, "bill_id"))}`);
}

export async function getSpeakerActivity(fetchFn: FetchFn, config: LegislensConfig, options: SpeakerActivityOptions): Promise<unknown> {
  return callApi(fetchFn, config, "GET", `/speakers/${encodeURIComponent(requireNonEmpty(options.speaker, "speaker"))}/activity`);
}

export async function searchCommitteeHearings(fetchFn: FetchFn, config: LegislensConfig, options: SearchHearingsOptions = {}): Promise<unknown> {
  return callApi(fetchFn, config, "GET", "/committee-hearings", {
    query: queryFrom({
      topic: options.topic,
      committee: options.committee,
      chamber: options.chamber,
      from_date: options.from_date,
      to_date: options.to_date,
    }),
  });
}

export async function getHearingTranscript(fetchFn: FetchFn, config: LegislensConfig, options: HearingTranscriptOptions): Promise<unknown> {
  return callApi(fetchFn, config, "GET", `/hearings/${encodeURIComponent(requireNonEmpty(options.hearing_id, "hearing_id"))}/transcript`);
}

export async function listAvailableStates(fetchFn: FetchFn, config: LegislensConfig): Promise<unknown> {
  return callApi(fetchFn, config, "GET", "/states");
}

/** Render a payload as the JSON text block MCP clients show. */
export function formatPayload(payload: unknown): string {
  return typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
}
