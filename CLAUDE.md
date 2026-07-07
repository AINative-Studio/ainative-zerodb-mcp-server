# ZeroDB MCP Server

Full MCP server with 70+ tools for vectors, memory, NoSQL tables, files, events, PostgreSQL, embeddings, and RLHF. Published as `ainative-zerodb-mcp-server` on npm (v2.3.1).

## Rules
- Tests before commits (pytest)
- No AI attribution in commits
- NEVER remove or break auto-provisioning — agents rely on `zerodb-cli init` for zero-human setup
- All tools must have proper JSON schema definitions
- New tools require tests and docs-site documentation

## Key Files
- `index.js` — MCP server + all 70+ tool implementations
- `tests/` — Tool tests
- `package.json` / `pyproject.toml` — Package configs

## Testing
```bash
pytest tests/ -v
```

## Auto-Provisioning
This MCP server auto-provisions ZeroDB projects and API keys via `zerodb-cli`. The provisioning flow creates a project, generates an API key, and configures the MCP server — all without human intervention. **Do not remove or modify provisioning logic** without explicit approval.
