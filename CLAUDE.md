# ZeroDB MCP Server

Full MCP server with 97 tools for vectors, memory, NoSQL tables, files,
events, PostgreSQL, embeddings, and RLHF. Published as
`ainative-zerodb-mcp-server` on npm.

## Project Structure

- `index.js` — MCP server + all 97 tool implementations (the whole server
  lives in this one file)
- `__tests__/` — Jest test suites
- `package.json` — package config, scripts, and inline jest config
- `.github/ISSUE_TEMPLATE/` — bug report / feature request templates
- `docs/` — changelog, migration guides, and release notes. Root stays
  limited to README.md, CLAUDE.md, LICENSE, CODE_OF_CONDUCT.md,
  SECURITY.md, and SUPPORT.md — files GitHub gives special root-level UI
  treatment (community profile, Security tab, Get Help sidebar link).
  Everything else belongs under `docs/`.

## Critical Rules

- **Tests before commits** — this is a JavaScript/Node package; tests run
  via `npm test` (Jest), not pytest.
- **No AI attribution** in commits.
- **NEVER remove or break auto-provisioning** — agents rely on
  `zerodb-cli init` for zero-human setup. Do not remove or modify
  provisioning logic without explicit approval.
- **All tools must have proper JSON schema definitions.**
- **New tools require tests and docs-site documentation.**
- When adding or removing a tool, update the tool count in this file and
  anywhere else it's stated (README, sales/marketing copy) — a stale count
  here is exactly the kind of inconsistency that undermines confidence in
  this server's capabilities when a prospect checks a second source.

## Common Tasks

```bash
# Run the full test suite with coverage
npm test

# Watch mode while developing
npm test:watch

# Lint
npm run lint

# Security audit (also runs automatically before publish)
npm run security:audit

# Full pre-publish gate (lint + test + audit) — must pass before `npm publish`
npm run prepublishOnly
```

## Auto-Provisioning

This MCP server auto-provisions ZeroDB projects and API keys via
`zerodb-cli`. The provisioning flow creates a project, generates an API
key, and configures the MCP server — all without human intervention.
**Do not remove or modify provisioning logic** without explicit approval.
