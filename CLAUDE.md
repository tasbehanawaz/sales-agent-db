# Claude working notes — sales-agent-db

Context: this repo serves the MCP tools consumed by Vertx-hosted agents.
Every byte an endpoint returns re-enters the next agent round as input
tokens billed at the gpt-4.1-azure rate. See `TOKEN_COST_OPTIMIZATION.md`
for the full 13-item plan.

## Conventions for new or changed endpoints

- **Column selection.** Non-aggregate list endpoints MUST accept
  `select=col1,col2,...` and validate each name against the table's column
  whitelist. Default to every column only when the caller omits `select`.
  See `selectClause` in `api/apex-table-routes.js`.
- **Tight response envelope.** Do not add diagnostic metadata to responses
  beyond what the agent actually reads (today: `truncated`). Hide anything
  else behind a `verbose=1` opt-in. Every extra field is paid for on the
  next agent round.
- **Published MCP tool catalog.** Any new tool exposed via `/mcp` must be
  whitelisted into the list `mcpHandler` returns on `tools/list`. Do not
  auto-register tools that no live agent uses — the whole catalog rides
  the input tokens of every round.
- **Hard-cap `limit` server-side.** Never trust the caller's `limit`. Cap
  to a sane ceiling in the route handler; an agent mistake must not be
  able to dump hundreds of rows into the next round's context.
- **Numeric metrics as JSON numbers**, not quoted strings. Return `12.5`,
  not `"12.5"` — strings tokenize heavier and force the agent to re-parse.
- **Short, example-led tool descriptions.** Tool `description` text ships
  in the schema and is re-sent every round. State rules the schema alone
  can't express; keep examples to one per tool.

## When adding a new tool

Before registering, answer:

1. Which agent will call this? If none, don't publish it.
2. What's the smallest response that answers the question?
3. Does `limit` have a hard cap in this handler?
4. Are numeric fields returned as JSON numbers?
5. Does the description give one example and stop?
