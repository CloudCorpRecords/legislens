/**
 * legislens types.
 *
 * Shapes are documented reconstructions from the public tool
 * descriptions: bill search takes optional keyword and filter
 * fields, testimony search requires a query, single records are
 * addressed by bill or hearing id, and speakers are named
 * directly. HTTP access is described by a minimal response
 * surface so tests can inject a fake fetch and never touch the
 * network.
 */

export interface LegislensConfig {
  baseUrl: string;
  apiKey: string;
}

export interface SearchBillsOptions {
  query?: string;
  state?: string;
  sponsor?: string;
  committee?: string;
  status?: string;
  chamber?: string;
}

export interface SearchTestimonyOptions {
  query: string;
  speaker?: string;
  committee?: string;
}

export interface BillDetailOptions {
  bill_id: string;
}

export interface SpeakerActivityOptions {
  speaker: string;
}

export interface SearchHearingsOptions {
  topic?: string;
  committee?: string;
  chamber?: string;
  from_date?: string;
  to_date?: string;
}

export interface HearingTranscriptOptions {
  hearing_id: string;
}

/** Minimal HTTP response surface so tests can inject fixtures. */
export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
  json(): Promise<unknown>;
}

export type FetchFn = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    redirect?: string;
  },
) => Promise<HttpResponse>;
