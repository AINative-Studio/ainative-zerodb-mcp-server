# Migration Guide: Password Auth → API Key Auth

> **Password auth (`ZERODB_USERNAME`/`ZERODB_PASSWORD`) is deprecated and will be removed in v3.0.**
> The server will print a deprecation warning on startup if password auth is detected.

## Step 1: Get Your API Key

1. Go to **https://ainative.studio/settings**
2. Navigate to the **API Keys** section
3. Click **Create API Key**
4. Copy the key (it starts with `zdb_`)

## Step 2: Update Your Configuration

**Old config (deprecated):**
```json
{
  "mcpServers": {
    "zerodb": {
      "command": "npx",
      "args": ["ainative-zerodb-mcp-server"],
      "env": {
        "ZERODB_API_URL": "https://api.ainative.studio",
        "ZERODB_PROJECT_ID": "your-project-id",
        "ZERODB_USERNAME": "your-email@example.com",
        "ZERODB_PASSWORD": "YourPassword123!"
      }
    }
  }
}
```

**New config (recommended):**
```json
{
  "mcpServers": {
    "zerodb": {
      "command": "npx",
      "args": ["ainative-zerodb-mcp-server"],
      "env": {
        "ZERODB_API_URL": "https://api.ainative.studio",
        "ZERODB_PROJECT_ID": "your-project-id",
        "ZERODB_API_KEY": "zdb_your-api-key-here"
      }
    }
  }
}
```

## Why Switch?

- **No plaintext passwords** — API keys don't require storing your account password
- **No token renewal** — API keys are used directly as Bearer tokens, no login/refresh flow
- **Revocable** — Rotate or revoke individual keys without changing your password
- **Scoped** — Future support for project-scoped and read-only keys
