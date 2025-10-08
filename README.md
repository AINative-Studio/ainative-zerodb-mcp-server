# AINative ZeroDB MCP Server

Vector search and persistent memory for AI agents using the Model Context Protocol (MCP).

## Features

- 🧠 **Persistent Memory** - Store and retrieve agent memory across sessions
- 🔍 **Vector Search** - Semantic similarity search using 1536-dimensional embeddings
- 📊 **Context Windows** - Build conversation context with token management
- 🔐 **Authentication** - Automatic token renewal and session management
- ⚡ **Fast & Reliable** - Built on the official MCP SDK

## Installation

```bash
npm install -g ainative-zerodb-mcp-server
```

## Configuration

### Claude Desktop/Code

Add to your Claude configuration file (`~/.claude.json` or project-specific `.claude/config.json`):

```json
{
  "mcpServers": {
    "ainative-zerodb": {
      "type": "stdio",
      "command": "npx",
      "args": ["ainative-zerodb-mcp-server"],
      "env": {
        "ZERODB_EMAIL": "your@email.com",
        "ZERODB_PASSWORD": "your_password",
        "ZERODB_API_KEY": "your_api_key",
        "ZERODB_API_BASE_URL": "https://api.ainative.studio"
      }
    }
  }
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ZERODB_API_BASE_URL` | AINative API base URL | `https://api.ainative.studio` |
| `ZERODB_EMAIL` | User email for authentication | - |
| `ZERODB_PASSWORD` | User password | - |
| `ZERODB_API_KEY` | Optional: Pre-generated API key | - |
| `ZERODB_PROJECT_ID` | Project ID for scoped operations | - |
| `MCP_CONTEXT_WINDOW` | Max tokens for context window | `8192` |
| `MCP_RETENTION_DAYS` | Memory retention period | `30` |

## Available Tools

### 1. `zerodb_store_memory`
Store agent memory for persistent context across sessions.

**Parameters:**
- `content` (string, required): Memory content to store
- `role` (string, required): Message role (`user`, `assistant`, `system`)
- `session_id` (string, optional): Session identifier (auto-generated)
- `agent_id` (string, optional): Agent identifier (auto-generated)
- `metadata` (object, optional): Additional metadata

**Example:**
```javascript
{
  "content": "User prefers concise responses",
  "role": "system",
  "session_id": "session-123",
  "agent_id": "claude-code"
}
```

### 2. `zerodb_search_memory`
Search stored memories using filters.

**Parameters:**
- `query` (string, required): Search query
- `session_id` (string, optional): Filter by session
- `agent_id` (string, optional): Filter by agent
- `role` (string, optional): Filter by role
- `limit` (number, optional): Max results (default: 10)

**Example:**
```javascript
{
  "query": "user preferences",
  "session_id": "session-123",
  "limit": 5
}
```

### 3. `zerodb_get_context`
Get agent context window for the current session.

**Parameters:**
- `session_id` (string, required): Session identifier
- `agent_id` (string, optional): Agent identifier
- `max_tokens` (number, optional): Max tokens in context

**Example:**
```javascript
{
  "session_id": "session-123",
  "max_tokens": 8192
}
```

### 4. `zerodb_store_vector`
Store vector embedding with metadata (must be exactly 1536 dimensions).

**Parameters:**
- `vector_embedding` (array, required): 1536-dimensional vector
- `document` (string, required): Source document
- `metadata` (object, optional): Document metadata
- `namespace` (string, optional): Vector namespace (default: `windsurf`)

**Example:**
```javascript
{
  "vector_embedding": [0.1, 0.2, ...], // 1536 dimensions
  "document": "Important code snippet",
  "metadata": { "language": "python", "file": "main.py" },
  "namespace": "codebase"
}
```

### 5. `zerodb_search_vectors`
Search vectors using semantic similarity.

**Parameters:**
- `query_vector` (array, required): 1536-dimensional query vector
- `namespace` (string, optional): Vector namespace
- `limit` (number, optional): Max results (default: 10)
- `threshold` (number, optional): Similarity threshold (default: 0.7)

**Example:**
```javascript
{
  "query_vector": [0.1, 0.2, ...], // 1536 dimensions
  "namespace": "codebase",
  "limit": 5,
  "threshold": 0.8
}
```

### 6. `zerodb_renew_token`
Manually renew authentication token.

**Parameters:** None

## Usage Examples

### In Claude Desktop

Once configured, you can use natural language commands:

```
"Remember that I prefer Python over JavaScript"
"What are my coding preferences?"
"Store this code snippet in the vector database"
"Find similar code examples"
```

### Programmatic Usage

```javascript
const ZeroDBMCPServer = require('ainative-zerodb-mcp-server');

// Start the MCP server
const server = new ZeroDBMCPServer();
server.start();
```

## Authentication

The server automatically:
1. Authenticates with the AINative public API using user email/password
2. Retrieves a JWT access token
3. Renews tokens automatically before expiry (every 25 minutes)
4. Retries failed requests with fresh tokens

**Important**: Use your regular user credentials, not admin credentials. All ZeroDB operations are scoped to your user account.

## API Endpoints Used

The MCP server connects to these AINative public API endpoints:

- `POST /v1/auth/login` - User authentication
- `POST /v1/zerodb/memory/` - Store memory
- `GET /v1/zerodb/memory/` - Search memory
- `GET /v1/zerodb/context` - Get context window
- `POST /v1/zerodb/vectors/` - Store vectors
- `POST /v1/zerodb/vectors/search` - Search vectors

## Troubleshooting

### Authentication Failed
- Verify your `ZERODB_EMAIL` and `ZERODB_PASSWORD` are correct
- Check that the API base URL is accessible
- Ensure you're using your user credentials (not admin credentials)

### Vector Dimension Error
- All vectors must be exactly 1536 dimensions
- Use OpenAI's `text-embedding-ada-002` or equivalent model

### Connection Timeout
- Check your network connection
- Verify the API base URL is correct
- Ensure firewall allows HTTPS connections

### No Memories Found
- Verify you're using the correct `session_id` or `agent_id`
- Check that memories were stored successfully
- Try searching without filters

## Development

### Local Testing

```bash
# Clone the repository
git clone https://github.com/AINative-Studio/ainative-zerodb-mcp-server.git
cd ainative-zerodb-mcp-server

# Install dependencies
npm install

# Run locally
node index.js
```

### Publishing Updates

```bash
# Update version in package.json
npm version patch  # or minor, or major

# Publish to NPM
npm publish
```

## Support

- **Documentation**: [https://api.ainative.studio/docs-enhanced#/](https://api.ainative.studio/docs-enhanced#/)
- **Issues**: [GitHub Issues](https://github.com/AINative-Studio/ainative-zerodb-mcp-server/issues)
- **Email**: support@ainative.studio

## License

MIT License - Copyright (c) 2025 AINative Studio

## Links

- **NPM**: [https://www.npmjs.com/package/ainative-zerodb-mcp-server](https://www.npmjs.com/package/ainative-zerodb-mcp-server)
- **GitHub**: [https://github.com/AINative-Studio/ainative-zerodb-mcp-server](https://github.com/AINative-Studio/ainative-zerodb-mcp-server)
- **Model Context Protocol**: [https://modelcontextprotocol.io](https://modelcontextprotocol.io)
- **AINative Studio**: [https://ainative.studio](https://ainative.studio)
