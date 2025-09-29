# 🚀 AINative ZeroDB MCP Server

[![npm version](https://badge.fury.io/js/ainative-zerodb-mcp-server.svg)](https://badge.fury.io/js/ainative-zerodb-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Model Context Protocol (MCP) server that provides AI assistants with vector search and persistent memory capabilities using ZeroDB.

## Features

- 🧠 **Persistent Memory** - Store and retrieve context across sessions
- 🔍 **Vector Search** - Semantic similarity search across documents
- 📊 **Analytics** - Query insights and usage patterns
- 🔐 **Project Isolation** - Separate data by project
- ⚡ **High Performance** - Optimized for real-time AI interactions

## Quick Start

### Installation

```bash
# Install globally
npm install -g ainative-zerodb-mcp-server

# Or use with npx
npx ainative-zerodb-mcp-server
```

### Add to Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "zerodb": {
      "command": "npx",
      "args": ["-y", "ainative-zerodb-mcp-server"],
      "env": {
        "ZERODB_API_URL": "https://api.ainative.studio/api/v1",
        "ZERODB_PROJECT_ID": "your-project-id",
        "ZERODB_USERNAME": "your-username",
        "ZERODB_PASSWORD": "your-password"
      }
    }
  }
}
```

### Add to Claude Code

```bash
# Add to current project
claude mcp add project zerodb npx -- -y ainative-zerodb-mcp-server

# Or add to .mcp.json
```

## Available Tools

### `zerodb_store_memory`
Store agent memory for persistent context across sessions.

```javascript
{
  "content": "User prefers dark mode themes",
  "role": "assistant",
  "session_id": "session-123",
  "metadata": { "category": "preferences" }
}
```

### `zerodb_retrieve_memory`
Retrieve stored memories and context.

```javascript
{
  "session_id": "session-123",
  "limit": 10,
  "role": "assistant"
}
```

### `zerodb_search`
Semantic search across stored documents and memories.

```javascript
{
  "query": "user interface preferences",
  "limit": 5,
  "threshold": 0.7
}
```

### `zerodb_store_vector`
Store embeddings for vector similarity search.

```javascript
{
  "content": "Technical documentation about APIs",
  "vector": [0.1, 0.2, ...],
  "metadata": { "type": "documentation" }
}
```

### `zerodb_analytics`
Query analytics and insights.

```javascript
{
  "metric": "memory_usage",
  "period": "7d"
}
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ZERODB_API_URL` | ZeroDB API endpoint | `https://api.ainative.studio/api/v1` |
| `ZERODB_PROJECT_ID` | Your project identifier | Required |
| `ZERODB_USERNAME` | Authentication username | Required |
| `ZERODB_PASSWORD` | Authentication password | Required |
| `ZERODB_API_TOKEN` | API token (if available) | Optional |
| `MCP_CONTEXT_WINDOW` | Context window size | `8192` |
| `MCP_RETENTION_DAYS` | Data retention period | `30` |

## Usage Examples

### With Claude Desktop

Once configured, you can use natural language:

- "Remember that the user prefers dark mode"
- "What do you know about my preferences?"
- "Search for information about API documentation"
- "Show me analytics for the last week"

### Programmatic Usage

```javascript
const { ZeroDBMCPServer } = require('ainative-zerodb-mcp-server');

const server = new ZeroDBMCPServer({
  apiUrl: 'https://api.ainative.studio/api/v1',
  projectId: 'my-project',
  username: 'user@example.com',
  password: 'secure-password'
});

await server.start();
```

## Development

```bash
# Clone the repository
git clone https://github.com/AINative-Studio/ainative-zerodb-mcp-server.git
cd ainative-zerodb-mcp-server

# Install dependencies
npm install

# Run locally
npm start

# Run tests
npm test
```

## Architecture

The ZeroDB MCP Server integrates with:
- **ZeroDB API** - Vector database backend
- **MCP Protocol** - Communication with AI assistants
- **Token Management** - Automatic token renewal
- **Error Handling** - Graceful fallbacks

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Support

- 📧 Email: support@ainative.studio
- 💬 Discord: [Join our community](https://discord.gg/ainative)
- 🐛 Issues: [GitHub Issues](https://github.com/AINative-Studio/ainative-zerodb-mcp-server/issues)

## Related Projects

- [AINative Design System MCP](https://www.npmjs.com/package/ainative-design-system-mcp-server)
- [ZeroDB SDK](https://github.com/AINative-Studio/zerodb-sdk)
- [Model Context Protocol](https://modelcontextprotocol.io)

---

Made with ❤️ by [AINative Studio](https://ainative.studio)