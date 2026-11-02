# legislens

legislens gives you a window onto US state lawmaking: bills
moving through legislatures in all 50 states and DC, and what
was actually said about them in committee hearings, attributed
to the person who said it. One binary serves a command-line
interface and a stdio MCP server.

legislens does not hold the archive itself. It is a forwarding
client for a hosted API: each request is sent to that service
and its answer is returned. The bills, testimony segments,
transcripts, and coverage are the hosted service's; if it is
unavailable or its coverage changes, legislens reflects that.

An API key is required. Set `GAVELIN_API_KEY` before use;
when it is missing or blank, every tool fails with an error
naming it before any request is made. The key is sent as
`Authorization: Bearer <key>`. The API base URL can be
overridden with `LEGISLENS_API_URL`; when it is not set, calls
go to `https://api.gavelin.ai` (a reconstruction of the wire
address, labelled as such).

## Install

```bash
npx @reneturcios/legislens list_available_states
```

Or run the container image:

```bash
docker run -i ghcr.io/cloudcorprecords/legislens
```

The container defaults to the MCP server (see below). Pass CLI
arguments to use it as a CLI instead.

## CLI

The subcommands mirror the MCP tool names:

```bash
export GAVELIN_API_KEY=<your key>

legislens search_bills --query housing --state CA --status passed
legislens search_bills --sponsor Lee --committee Housing --chamber assembly
legislens search_hearing_testimony --query "rent control" --speaker Lee
legislens get_bill_detail --bill-id CA-AB1
legislens get_speaker_activity --speaker "Jane Lee"
legislens search_committee_hearings --topic housing --from-date 2026-01-01 --to-date 2026-02-01
legislens get_hearing_transcript --hearing-id h-9
legislens list_available_states

legislens --version
```

Results print the upstream JSON payload. Exit codes: `0` on
success, `1` when a call fails (including a missing key or an
upstream API error), `2` for usage errors.

## MCP server

One bin serves both faces. The `mcp` subcommand starts a stdio
MCP server:

```bash
npx -y @reneturcios/legislens mcp
```

MCP client configuration:

```json
{
  "mcpServers": {
    "legislens": {
      "command": "npx",
      "args": ["-y", "@reneturcios/legislens", "mcp"],
      "env": { "GAVELIN_API_KEY": "..." }
    }
  }
}
```

### Tools

| Tool | Input | What it does |
| --- | --- | --- |
| `search_bills` | `query`, `state`, `sponsor`, `committee`, `status`, `chamber` (all optional) | Search bills by keyword, sponsor, committee, status, or chamber. |
| `search_hearing_testimony` | `query` (required), `speaker`, `committee` | Search speaker-attributed testimony segments. |
| `get_bill_detail` | `bill_id` (required) | Full bill detail, including history and hearing mentions. |
| `get_speaker_activity` | `speaker` (required) | Everything a legislator or witness has said. |
| `search_committee_hearings` | `topic`, `committee`, `chamber`, `from_date`, `to_date` (all optional) | Browse committee hearings. |
| `get_hearing_transcript` | `hearing_id` (required) | Full hearing transcript with speakers labelled. |
| `list_available_states` | (none) | States with data and the data types available for each. |

Dates use `YYYY-MM-DD` form as `from_date` / `to_date`. All
inputs are strings.

## Development

```bash
npm install
npm run build   # tsc -> dist/
npm test        # node test runner over test/*.test.ts, no network (fake fetch fixtures)
npm run dev     # run the CLI from source via tsx
```

## License

MIT — see `LICENSE`.
