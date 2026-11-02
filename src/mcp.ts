/**
 * legislens MCP server.
 *
 * Why the low-level Server instead of McpServer: the high-level
 * helper converts zod schemas to JSON Schema and injects keys
 * that are not in this tool's public spec ("$schema" and
 * "additionalProperties"), which breaks exact tool-list/schema
 * parity with the spec. This file serves tools/list with the
 * spec's exact input schemas as explicit literals, while zod still
 * validates every tools/call argument set.
 *
 * Config is read from the environment at call time:
 * GAVELIN_API_KEY (required; a missing key errors before any
 * request), LEGISLENS_API_URL (optional, default
 * https://api.gavelin.ai — labelled reconstruction).
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
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

const SearchBillsArgs = z.object({
  query: z.string().optional(),
  state: z.string().optional(),
  sponsor: z.string().optional(),
  committee: z.string().optional(),
  status: z.string().optional(),
  chamber: z.string().optional(),
});
const SearchTestimonyArgs = z.object({
  query: z.string(),
  speaker: z.string().optional(),
  committee: z.string().optional(),
});
const BillDetailArgs = z.object({ bill_id: z.string() });
const SpeakerArgs = z.object({ speaker: z.string() });
const SearchHearingsArgs = z.object({
  topic: z.string().optional(),
  committee: z.string().optional(),
  chamber: z.string().optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
});
const TranscriptArgs = z.object({ hearing_id: z.string() });
const NoArgs = z.object({});

const TOOLS = [
  {
    name: "search_bills",
    description: "Search bills by keyword, sponsor, committee, status, or chamber across US state legislatures.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Keyword query matched against bill titles and text." },
        state: { type: "string", description: "US state filter, such as a two-letter state code." },
        sponsor: { type: "string", description: "Sponsor name filter." },
        committee: { type: "string", description: "Committee name filter." },
        status: { type: "string", description: "Bill status filter." },
        chamber: { type: "string", description: "Chamber filter, such as house or senate." },
      },
    },
  },
  {
    name: "search_hearing_testimony",
    description: "Search speaker-attributed hearing testimony segments by query, with optional speaker and committee filters.",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Keyword query matched against testimony segments." },
        speaker: { type: "string", description: "Speaker name filter." },
        committee: { type: "string", description: "Committee name filter." },
      },
      required: ["query"],
    },
  },
  {
    name: "get_bill_detail",
    description: "Get full detail for a bill, including its history and hearing mentions.",
    inputSchema: {
      type: "object" as const,
      properties: { bill_id: { type: "string", description: "Bill id, from search_bills results." } },
      required: ["bill_id"],
    },
  },
  {
    name: "get_speaker_activity",
    description: "Get everything a legislator or witness has said across hearings.",
    inputSchema: {
      type: "object" as const,
      properties: { speaker: { type: "string", description: "Legislator or witness name to collect hearing statements for." } },
      required: ["speaker"],
    },
  },
  {
    name: "search_committee_hearings",
    description: "Browse committee hearings by topic, committee, chamber, and date range.",
    inputSchema: {
      type: "object" as const,
      properties: {
        topic: { type: "string", description: "Hearing topic filter." },
        committee: { type: "string", description: "Committee name filter." },
        chamber: { type: "string", description: "Chamber filter, such as house or senate." },
        from_date: { type: "string", description: "Earliest hearing date to include, YYYY-MM-DD." },
        to_date: { type: "string", description: "Latest hearing date to include, YYYY-MM-DD." },
      },
    },
  },
  {
    name: "get_hearing_transcript",
    description: "Get the full transcript of a hearing with speakers labelled.",
    inputSchema: {
      type: "object" as const,
      properties: { hearing_id: { type: "string", description: "Hearing id, from search_committee_hearings results." } },
      required: ["hearing_id"],
    },
  },
  {
    name: "list_available_states",
    description: "List states with available data and the data types available for each.",
    inputSchema: { type: "object" as const, properties: {} },
  },
];

function textResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function errorResult(err: unknown) {
  return {
    content: [
      { type: "text" as const, text: err instanceof Error ? err.message : String(err) },
    ],
    isError: true,
  };
}

const server = new Server(
  { name: "legislens", version: VERSION },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const fetchFn = globalThis.fetch as unknown as FetchFn;
  const config = resolveConfig(process.env);
  try {
    let out: unknown;
    switch (name) {
      case "search_bills": out = await searchBills(fetchFn, config, SearchBillsArgs.parse(args ?? {})); break;
      case "search_hearing_testimony": out = await searchHearingTestimony(fetchFn, config, SearchTestimonyArgs.parse(args ?? {})); break;
      case "get_bill_detail": out = await getBillDetail(fetchFn, config, BillDetailArgs.parse(args ?? {})); break;
      case "get_speaker_activity": out = await getSpeakerActivity(fetchFn, config, SpeakerArgs.parse(args ?? {})); break;
      case "search_committee_hearings": out = await searchCommitteeHearings(fetchFn, config, SearchHearingsArgs.parse(args ?? {})); break;
      case "get_hearing_transcript": out = await getHearingTranscript(fetchFn, config, TranscriptArgs.parse(args ?? {})); break;
      case "list_available_states": NoArgs.parse(args ?? {}); out = await listAvailableStates(fetchFn, config); break;
      default: throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return textResult(formatPayload(out));
  } catch (err) {
    if (err instanceof McpError) throw err;
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}

void main();
