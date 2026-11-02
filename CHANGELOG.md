# Changelog

## 0.1.0 (2026-10-27)

- Initial release.
- CLI subcommands mirror the MCP tools, plus `legislens mcp`
  and `--version`.
- MCP server (`legislens mcp`, stdio) with the full documented
  tool set: bill search, hearing testimony search, bill detail,
  speaker activity, committee hearing search, hearing
  transcripts, and the available-states listing.
- Calls go to the hosted API under the base URL from
  `LEGISLENS_API_URL`, defaulting to `https://api.gavelin.ai`.
- `GAVELIN_API_KEY` is required and a missing key errors
  before any request; it is sent as a Bearer credential.
- All HTTP goes through an injectable fetch function, so the
  test suite runs entirely on hand-written fixtures with no
  network access.
