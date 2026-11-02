# legislens — Build Report

MCP Rebuild 1000. Clean-room rebuild of gavelin-ai/mcp
(MCP Registry rank 235, 1 star), built from the public README
spec captured in
`harness/fixtures/gavelin-mcp-tools-original.json`. That
fixture is docs-derived: the tools are the full documented
set of 7 and the argument schemas are documented
reconstructions from the tool descriptions — no original
server was probed. Parity proves the rebuild matches this
program's defined spec, labelled docs-derived. Local build
only — nothing pushed or published.

Identity: repo `legislens`, npm `@reneturcios/legislens`,
MCP name `io.github.CloudCorpRecords/legislens`, version `0.1.0`.

## Files created (19/19 per TEMPLATE.md checklist)

- `package.json` — bin `legislens: dist/cli.js`, `mcpName` set,
  scripts build=`tsc` / dev=`tsx src/cli.ts` / test=`tsx --test test/*.test.ts`
- `server.json` — description "US state bills and hearing
  transcripts: search bills, testimony, speakers, hearings."
  = **84 chars** (≤100 ✓); npm entry carries `version: 0.1.0`;
  OCI entry `ghcr.io/cloudcorprecords/legislens:0.1.0` carries
  **no** `version` field (verified programmatically)
- `Dockerfile` — node:20-alpine two-stage, ENTRYPOINT
  `node /app/dist/cli.js`, CMD `mcp`, label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/legislens"`
- `tsconfig.json` (identical to the fleet template), `.gitignore`,
  `LICENSE` (MIT, Copyright (c) 2026 Rene Turcios), `README.md`
  (fresh text), `CHANGELOG.md` (single 0.1.0 entry, 2026-10-27)
- `src/index.ts`, `src/cli.ts` (subcommands mirror the tool
  names, plus `mcp` and `--version`; exit 2 usage / 1 API error),
  `src/mcp.ts`, `src/types.ts`, `src/legislens.ts` (core logic,
  `VERSION = "0.1.0"`)
- `test/legislens.test.ts`
- `.github/workflows/{ci,publish,publish-container,registry-publish}.yml`
  (from the fleet template; image name and smoke-test server name
  changed to legislens)

## Tools implemented (7)

`search_bills`, `search_hearing_testimony`, `get_bill_detail`,
`get_speaker_activity`, `search_committee_hearings`,
`get_hearing_transcript`, `list_available_states` — the full
documented set as enumerated in the task spec, as recorded in
the fixture `_source`.

| Tool | Required | Optional |
| --- | --- | --- |
| `search_bills` | — | `query`, `state`, `sponsor`, `committee`, `status`, `chamber` |
| `search_hearing_testimony` | `query` | `speaker`, `committee` |
| `get_bill_detail` | `bill_id` | — |
| `get_speaker_activity` | `speaker` | — |
| `search_committee_hearings` | — | `topic`, `committee`, `chamber`, `from_date`, `to_date` |
| `get_hearing_transcript` | `hearing_id` | — |
| `list_available_states` | — | — |

All arguments are strings.

## Implementation notes

- `src/mcp.ts` uses the SDK's low-level `Server` with explicit
  inputSchema literals, per the standing fleet rule: `McpServer`'s
  zod-to-JSON-Schema conversion injects `$schema` /
  `additionalProperties` keys that are absent from the defined spec
  and break exact schema parity. Zod still validates every
  `tools/call`.
- This rebuild is a forwarding client (labelled reconstruction
  of wire paths), following the linkguard hosted-forwarding
  pattern adapted to a Bearer-key REST API like sociallens:
  it does not reproduce the upstream legislative archive.
- Endpoints under the base URL (env `LEGISLENS_API_URL`, default
  `https://api.gavelin.ai`, trailing slashes stripped) follow the
  map in the `src/legislens.ts` header: `GET /bills` (search),
  `GET /bills/{bill_id}`, `GET /hearing-testimony`,
  `GET /speakers/{speaker}/activity`, `GET /committee-hearings`,
  `GET /hearings/{hearing_id}/transcript`, `GET /states`.
  Path and method choices are reconstructions, labelled as such.
- Auth: `GAVELIN_API_KEY` is required. A missing or blank key
  raises an error **before any request is made** (the call gate
  sits ahead of the fetch invocation; a spy test proves the
  fetch is never called). The key is sent as
  `Authorization: Bearer <key>`.
- HTTP failures surface the status plus the upstream `message`
  or `error` string when present.
- All HTTP flows through an injectable `FetchFn` (types.ts). The
  test suite uses a fake fetch returning hand-written
  Gavelin-shaped JSON fixtures; no live call is made in tests.

## Verification (foreground, exact outputs)

### 1. Build
```
$ npm run build ; tsc exit=0
```
`dist/` produced, including `dist/cli.js`.

### 2. Tests
```
$ npm test (tsx --test test/*.test.ts)
tests 18, pass 18, fail 0
```
Covers: base-URL default/custom/trailing-slash handling and
key trimming; the missing-key-before-request spy test (fetch
never called) and the Bearer header on a real (fake) request;
search_bills path with all six filters and with no filters;
testimony path with query/speaker/committee and blank-query
rejection before any request; bill detail path with URL
encoding and blank-id rejection; speaker activity path and
blank-speaker rejection; committee-hearings filters;
transcript path and blank-id rejection; states path; custom
base URL; HTTP 401 surfacing the upstream message; network
failure wrapping.

### 3. CLI / MCP smoke
`--version` → `0.1.0` (exit 0); unknown command exits 2 with
Usage. Parity run (below) exercised MCP `initialize` +
`tools/list` over stdio against the built server.

### 4. Parity (harness, from ~/workspace/mcp-rebuild-100/harness/)
```
$ python3 parity.py --original fixtures/gavelin-mcp-tools-original.json \
    --rebuild "stdio:node .../builds/legislens/dist/cli.js mcp" \
    --out /tmp/legislens-parity
verdict=PASS parity_pct=100.0 original_tools=7 rebuild_tools=7 missing=[] extra=[] schema_diffs=[]
(exit 0)
```
(parity.json: identical_tools 7/7.) Output copied into
`parity-out/parity.json` + `parity-out/parity.md` and verified
non-empty (1243 / 966 bytes). Original side is tools-file
mode, so `fixture_results` records `SKIPPED-TOOLS-FILE-MODE` —
expected harness semantics, not an error.

## Lockfile status

`package-lock.json` was generated clean via Route 3: a temp copy
holding only `package.json` (no `node_modules`), offline
`npm install --package-lock-only --ignore-scripts` (exit 0),
verified after generation — parses as JSON, top-level `name` is
`@reneturcios/legislens`, version `0.1.0`, `lockfileVersion` 3,
128 package entries — then only the lockfile was copied back.
Local `node_modules` is a sibling copy (sociallens) used only for
the local build/test; it is not part of the lockfile generation.

## Gaps / honest notes

- **Hosted dependency / forwarding client:** legislens is only
  a client. The data and archive — bills from all 50 states + DC,
  hearing transcripts, speaker attribution, and coverage — are
  the upstream service's; this client forwards requests to it.
  Availability, coverage, and data quality are entirely the
  upstream service's.
- Docs-derived spec: the argument schemas, endpoint paths and
  methods, and the base URL default (`https://api.gavelin.ai`)
  are documented reconstructions from the tool descriptions,
  per the task spec — no original gavelin-ai/mcp server was
  probed, so parity proves the rebuild matches this program's
  defined spec, not a hand-probed original.
- No live call was made: every endpoint is fake-fetch tested
  only, so live payload/response-shape drift against
  api.gavelin.ai is unverified until the publish wave.
- Container build not exercised locally; the publish-container
  workflow smoke-tests the image at publish time.
- mcpaudit / mcpvet / shipcheck pre-publish gate not run
  (belongs to the publish wave).
