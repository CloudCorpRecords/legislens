#!/usr/bin/env node
/**
 * legislens CLI. Subcommands mirror the MCP tool names:
 *
 *   legislens search_bills [--query <q>] [--state CA] [--sponsor <n>] [--committee <c>] [--status <s>] [--chamber <c>]
 *   legislens search_hearing_testimony --query <q> [--speaker <n>] [--committee <c>]
 *   legislens get_bill_detail --bill-id <id>
 *   legislens get_speaker_activity --speaker <name>
 *   legislens search_committee_hearings [--topic <t>] [--committee <c>] [--chamber <c>] [--from-date YYYY-MM-DD] [--to-date YYYY-MM-DD]
 *   legislens get_hearing_transcript --hearing-id <id>
 *   legislens list_available_states
 *   legislens mcp
 *
 * Env: GAVELIN_API_KEY (required), LEGISLENS_API_URL (default
 * https://api.gavelin.ai).
 * Exit codes: 0 success, 1 API error, 2 usage error.
 */
import {
  formatPayload,
  getBillDetail,
  getHearingTranscript,
  getSpeakerActivity,
  listAvailableStates,
  resolveConfig,
  searchBills,
  searchCommitteeHearings,
  searchHearingTestimony,
  VERSION,
} from "./legislens.js";
import type { FetchFn } from "./types.js";

const TOOLS = [
  "search_bills", "search_hearing_testimony", "get_bill_detail",
  "get_speaker_activity", "search_committee_hearings",
  "get_hearing_transcript", "list_available_states",
];

function usage(): never {
  console.error(`Usage:
  legislens <tool> [flags]
  legislens mcp
  legislens --version

Tools: ${TOOLS.join(", ")}

Flags: --query <q> --state <s> --sponsor <n> --committee <c>
  --status <s> --chamber <c> --speaker <n> --bill-id <id>
  --hearing-id <id> --topic <t> --from-date <d> --to-date <d>`);
  process.exit(2);
}

function flag(rest: string[], name: string): string | undefined {
  const i = rest.indexOf(name);
  return i >= 0 ? rest[i + 1] : undefined;
}

function reqFlag(rest: string[], name: string): string {
  const v = flag(rest, name);
  if (!v) usage();
  return v;
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") {
    console.log(VERSION);
    return;
  }
  if (cmd === "mcp") {
    await import("./mcp.js");
    return;
  }
  if (!cmd || !TOOLS.includes(cmd)) usage();
  const fetchFn = globalThis.fetch as unknown as FetchFn;
  const config = resolveConfig(process.env);
  try {
    let out: unknown;
    switch (cmd) {
      case "search_bills": out = await searchBills(fetchFn, config, {
        query: flag(rest, "--query"),
        state: flag(rest, "--state"),
        sponsor: flag(rest, "--sponsor"),
        committee: flag(rest, "--committee"),
        status: flag(rest, "--status"),
        chamber: flag(rest, "--chamber"),
      }); break;
      case "search_hearing_testimony": out = await searchHearingTestimony(fetchFn, config, {
        query: reqFlag(rest, "--query"),
        speaker: flag(rest, "--speaker"),
        committee: flag(rest, "--committee"),
      }); break;
      case "get_bill_detail": out = await getBillDetail(fetchFn, config, { bill_id: reqFlag(rest, "--bill-id") }); break;
      case "get_speaker_activity": out = await getSpeakerActivity(fetchFn, config, { speaker: reqFlag(rest, "--speaker") }); break;
      case "search_committee_hearings": out = await searchCommitteeHearings(fetchFn, config, {
        topic: flag(rest, "--topic"),
        committee: flag(rest, "--committee"),
        chamber: flag(rest, "--chamber"),
        from_date: flag(rest, "--from-date"),
        to_date: flag(rest, "--to-date"),
      }); break;
      case "get_hearing_transcript": out = await getHearingTranscript(fetchFn, config, { hearing_id: reqFlag(rest, "--hearing-id") }); break;
      default: out = await listAvailableStates(fetchFn, config); break;
    }
    console.log(formatPayload(out));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

void main();
