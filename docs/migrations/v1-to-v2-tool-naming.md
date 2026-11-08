# Migration Guide: v1.0.7 → v2.0.0

This guide will help you migrate from ZeroDB MCP Server v1.0.7 to v2.0.0.

## Overview

Version 2.0.0 introduces breaking changes primarily in tool naming conventions and authentication management. The migration is straightforward but requires configuration and code updates.

**Estimated Migration Time**: 15-30 minutes

---

## Breaking Changes Summary

### 1. Tool Naming Convention (BREAKING)

All MCP tools now use the `zerodb_` prefix for better namespace isolation.

| v1.0.7 Tool Name | v2.0.0 Tool Name | Status |
|------------------|------------------|---------|
| `store_memory` | `zerodb_store_memory` | ⚠️ Changed |
| `search_memory` | `zerodb_search_memory` | ⚠️ Changed |
| `get_context` | `zerodb_get_context` | ⚠️ Changed |
| `store_vector` | `zerodb_store_vector` | ⚠️ Changed |
| `search_vectors` | `zerodb_search_vectors` | ⚠️ Changed |
| N/A | `zerodb_renew_token` | ✅ New |

### 2. Vector Dimension Validation (BREAKING)

Vector embeddings now require **exactly 1536 dimensions** (OpenAI ada-002 standard).

**Before (v1.0.7)**:
```javascript
// Any dimension accepted
const vector = new Array(768).fill(0);  // ✅ Accepted
```

**After (v2.0.0)**:
```javascript
// Exactly 1536 dimensions required
const vector = new Array(1536).fill(0);  // ✅ Accepted
const vector = new Array(768).fill(0);   // ❌ Rejected with error
```

### 3. Authentication Management (BREAKING)

Token management is now automatic with background renewal.

**Before (v1.0.7)**:
- Manual token management required
- Tokens expire after 30 minutes
- No automatic renewal

**After (v2.0.0)**:
- Automatic token renewal every 25 minutes
- 5-minute buffer before expiry
- Manual renewal available via `zerodb_renew_token`

### 4. Error Response Format (BREAKING)

Error responses now include an `isError` flag.

**Before (v1.0.7)**:
```json
{
  "content": [{"type": "text", "text": "Error message"}]
}
```

**After (v2.0.0)**:
```json
{
  "content": [{"type": "text", "text": "Error message"}],
  "isError": true
}
```

### 5. Default Namespace Change (BREAKING)

Vector namespace defaults changed from `default` to `windsurf`.

**Before (v1.0.7)**:
```javascript
// Default namespace: "default"
```

**After (v2.0.0)**:
```javascript
// Default namespace: "windsurf"
// Specify explicitly if you want a different namespace
{
  namespace: "my-namespace"
}
```

---

## Step-by-Step Migration

### Step 1: Update Package Version

Update your `package.json` or install the latest version:

```bash
npm install ainative-zerodb-mcp-server@2.0.0
```

Or update in `package.json`:
```json
{
  "dependencies": {
    "ainative-zerodb-mcp-server": "^2.0.0"
  }
}
```

Then run:
```bash
npm install
```

### Step 2: Update Configuration

Ensure your environment variables are set correctly. v2.0.0 uses the same environment variables as v1.0.7:

**Required Variables**:
```bash
# ZeroDB API Configuration
ZERODB_API_URL=https://api.ainative.studio/api/v1
ZERODB_PROJECT_ID=your-project-id

# Authentication (choose one method)
ZERODB_API_TOKEN=your-api-token        # Option 1: Pre-generated token
ZERODB_USERNAME=admin@ainative.studio   # Option 2: Username/password
ZERODB_PASSWORD=your-password

# Optional Configuration
MCP_CONTEXT_WINDOW=8192                # Default: 8192 tokens
MCP_RETENTION_DAYS=30                  # Default: 30 days
```

**Claude Desktop Configuration** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "zerodb": {
      "command": "npx",
      "args": [
        "-y",
        "ainative-zerodb-mcp-server@2.0.0"
      ],
      "env": {
        "ZERODB_API_URL": "https://api.ainative.studio/api/v1",
        "ZERODB_PROJECT_ID": "your-project-id",
        "ZERODB_USERNAME": "admin@ainative.studio",
        "ZERODB_PASSWORD": "your-password"
      }
    }
  }
}
```

### Step 3: Update Tool Names in Code

If you have integration code that calls MCP tools, update the tool names:

**Before (v1.0.7)**:
```javascript
// Example with MCP SDK
await client.callTool('store_memory', {
  content: 'User prefers dark mode',
  role: 'system',
  session_id: 'session-123'
});

await client.callTool('search_vectors', {
  query_vector: embedding,
  limit: 10
});
```

**After (v2.0.0)**:
```javascript
// Updated tool names with zerodb_ prefix
await client.callTool('zerodb_store_memory', {
  content: 'User prefers dark mode',
  role: 'system',
  session_id: 'session-123'
});

await client.callTool('zerodb_search_vectors', {
  query_vector: embedding,
  limit: 10
});
```

### Step 4: Update Vector Embeddings

Ensure all vector embeddings are exactly 1536 dimensions (OpenAI ada-002 standard).

**Before (v1.0.7)**:
```javascript
// Any dimension worked
const embedding = await generateEmbedding(text);  // Could be 768, 1024, etc.
```

**After (v2.0.0)**:
```javascript
// Must be 1536 dimensions
const embedding = await generateEmbedding(text);  // Must be 1536D

// Validate before sending
if (embedding.length !== 1536) {
  throw new Error(`Expected 1536 dimensions, got ${embedding.length}`);
}

// Use with MCP
await client.callTool('zerodb_store_vector', {
  vector_embedding: embedding,
  document: text,
  namespace: 'my-namespace'
});
```

**If you're using different embedding models**:

| Model | Dimensions | Compatible? | Action Required |
|-------|------------|-------------|-----------------|
| OpenAI ada-002 | 1536 | ✅ Yes | None |
| OpenAI text-embedding-3-small | 1536 | ✅ Yes | None |
| OpenAI text-embedding-3-large | 3072 | ❌ No | Reduce dimensions to 1536 |
| Cohere embed-english-v3.0 | 1024 | ❌ No | Switch to OpenAI or pad to 1536 |
| BERT base | 768 | ❌ No | Switch to OpenAI or pad to 1536 |

**Dimension Reduction Example** (if using 3072D model):
```javascript
// OpenAI embedding-3-large returns 3072D by default
const embedding = await openai.embeddings.create({
  model: "text-embedding-3-large",
  input: text,
  dimensions: 1536  // Specify 1536D output
});
```

### Step 5: Update Error Handling

Update error handling to check for the `isError` flag:

**Before (v1.0.7)**:
```javascript
const result = await client.callTool('store_memory', params);
// Check for errors by parsing content
if (result.content[0].text.includes('Error')) {
  // Handle error
}
```

**After (v2.0.0)**:
```javascript
const result = await client.callTool('zerodb_store_memory', params);

// Check the isError flag
if (result.isError) {
  console.error('Operation failed:', result.content[0].text);
  // Handle error
} else {
  console.log('Success:', result.content[0].text);
}
```

### Step 6: Update Namespace References

If you were using the default namespace, explicitly specify it:

**Before (v1.0.7)**:
```javascript
// Default namespace was "default"
await client.callTool('store_vector', {
  vector_embedding: embedding,
  document: text
  // namespace: "default" (implicit)
});
```

**After (v2.0.0)**:
```javascript
// Default namespace is now "windsurf"
// Option 1: Use new default
await client.callTool('zerodb_store_vector', {
  vector_embedding: embedding,
  document: text
  // namespace: "windsurf" (implicit)
});

// Option 2: Explicitly use old default
await client.callTool('zerodb_store_vector', {
  vector_embedding: embedding,
  document: text,
  namespace: "default"  // Explicit to maintain compatibility
});
```

### Step 7: Test Migration

Run comprehensive tests to ensure everything works:

```bash
# 1. Test authentication
curl -X POST https://api.ainative.studio/api/v1/admin/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=your-username&password=your-password"

# 2. Test MCP server startup
npx ainative-zerodb-mcp-server

# 3. Expected output:
# ZeroDB MCP Server v2.0.0 running on stdio
# API URL: https://api.ainative.studio/api/v1
# Project ID: your-project-id
# Token expires: 2025-10-14T...
```

---

## Compatibility Matrix

| Component | v1.0.7 | v2.0.0 | Compatible? |
|-----------|--------|--------|-------------|
| MCP Protocol | 1.0.0 | 1.0.0 | ✅ Yes |
| Node.js | ≥18.0.0 | ≥18.0.0 | ✅ Yes |
| npm | ≥9.0.0 | ≥9.0.0 | ✅ Yes |
| ZeroDB API | v1 | v1 | ✅ Yes |
| Tool Names | Old | New | ❌ No (breaking) |
| Vector Dims | Any | 1536 | ❌ No (breaking) |
| Auth Flow | Manual | Auto | ⚠️ Different |

---

## Rollback Procedure

If you need to rollback to v1.0.7:

### Step 1: Downgrade Package

```bash
npm install ainative-zerodb-mcp-server@1.0.7
```

Or in `package.json`:
```json
{
  "dependencies": {
    "ainative-zerodb-mcp-server": "1.0.7"
  }
}
```

### Step 2: Revert Tool Names

Change all `zerodb_` prefixed tools back to their original names:
- `zerodb_store_memory` → `store_memory`
- `zerodb_search_memory` → `search_memory`
- etc.

### Step 3: Revert Namespace (if needed)

If you were using the implicit default namespace:
```javascript
// Remove explicit namespace specification
await client.callTool('store_vector', {
  vector_embedding: embedding,
  document: text
  // namespace no longer needed
});
```

### Step 4: Restart Services

```bash
# Restart your application
pm2 restart your-app  # or equivalent
```

---

## Common Migration Issues

### Issue 1: "vector must have exactly 1536 dimensions"

**Cause**: Vector embedding has wrong dimensions

**Solution**:
```javascript
// Check your embedding model output
console.log('Embedding dimensions:', embedding.length);

// Use OpenAI ada-002 or text-embedding-3-small/large
const embedding = await openai.embeddings.create({
  model: "text-embedding-ada-002",  // 1536D output
  input: text
});
```

### Issue 2: "Unknown tool: store_memory"

**Cause**: Using old tool name without `zerodb_` prefix

**Solution**:
```javascript
// Change to new tool name
await client.callTool('zerodb_store_memory', params);
```

### Issue 3: "Authentication failed"

**Cause**: Token expired or invalid credentials

**Solution**:
```javascript
// Manually renew token
await client.callTool('zerodb_renew_token', {});

// Or verify environment variables
console.log('Username:', process.env.ZERODB_USERNAME);
console.log('API URL:', process.env.ZERODB_API_URL);
```

### Issue 4: Vectors not found after migration

**Cause**: Namespace change from `default` to `windsurf`

**Solution**:
```javascript
// Explicitly specify the old namespace
await client.callTool('zerodb_search_vectors', {
  query_vector: embedding,
  namespace: 'default',  // Use old namespace
  limit: 10
});
```

### Issue 5: "Project ID not found"

**Cause**: Missing or incorrect `ZERODB_PROJECT_ID`

**Solution**:
```bash
# Verify project ID in environment
echo $ZERODB_PROJECT_ID

# Get project ID from ZeroDB dashboard or API
curl -X GET https://api.ainative.studio/api/v1/projects \
  -H "Authorization: Bearer your-token"
```

---

## Testing Checklist

After migration, verify these operations:

- [ ] MCP server starts without errors
- [ ] Token authentication succeeds
- [ ] `zerodb_store_memory` stores memories successfully
- [ ] `zerodb_search_memory` retrieves memories
- [ ] `zerodb_get_context` returns context window
- [ ] `zerodb_store_vector` stores 1536D vectors
- [ ] `zerodb_search_vectors` performs semantic search
- [ ] `zerodb_renew_token` refreshes authentication
- [ ] Error responses include `isError` flag
- [ ] Automatic token renewal works (wait 25 minutes)
- [ ] Existing data is accessible (if applicable)
- [ ] Performance is acceptable (< 100ms avg response time)

---

## Performance Considerations

### v2.0.0 Performance Improvements

| Metric | v1.0.7 | v2.0.0 | Improvement |
|--------|--------|--------|-------------|
| Token Renewal | Manual | Automatic | ✅ 100% reduction in auth failures |
| Error Handling | Generic | Detailed | ✅ Better debugging |
| Vector Validation | None | Strict | ✅ Prevents invalid data |
| Timeout Handling | None | 10s/15s | ✅ Better reliability |

### Expected Response Times

| Operation | p50 | p95 | p99 |
|-----------|-----|-----|-----|
| store_memory | 50ms | 150ms | 300ms |
| search_memory | 100ms | 300ms | 500ms |
| store_vector | 75ms | 200ms | 400ms |
| search_vectors | 150ms | 400ms | 800ms |
| get_context | 100ms | 250ms | 500ms |

---

## Getting Help

If you encounter issues during migration:

1. **Check the logs**:
   ```bash
   # MCP server logs to stderr
   npx ainative-zerodb-mcp-server 2> mcp-errors.log
   ```

2. **Verify configuration**:
   ```bash
   # Check environment variables
   env | grep ZERODB
   ```

3. **Test API connectivity**:
   ```bash
   curl -X GET https://api.ainative.studio/health
   ```

4. **Contact support**:
   - GitHub Issues: https://github.com/AINative-Studio/ainative-zerodb-mcp-server/issues
   - Email: support@ainative.studio
   - Include: Version numbers, error messages, environment info

---

## FAQ

### Q: Can I run v1.0.7 and v2.0.0 side-by-side?

**A**: Yes, but they must use different project IDs or namespaces to avoid conflicts.

### Q: Will my existing data be lost during migration?

**A**: No, the migration only affects client code and tool names. Your stored data (vectors, memories) remains unchanged.

### Q: Do I need to re-generate all my vector embeddings?

**A**: Only if they're not 1536 dimensions. OpenAI ada-002 embeddings are already compatible.

### Q: How long does automatic token renewal take?

**A**: Token renewal happens in the background every 25 minutes and takes ~100-300ms.

### Q: Can I disable automatic token renewal?

**A**: No, automatic renewal is built-in. However, you can manually renew tokens using `zerodb_renew_token`.

### Q: What happens if I use the wrong namespace?

**A**: Vectors are isolated by namespace. Using the wrong namespace means you won't find existing vectors. Always specify namespaces explicitly if migrating existing data.

### Q: Is there a migration script?

**A**: Not currently. Migration is manual but straightforward (primarily updating tool names).

---

## Next Steps

After completing migration:

1. **Monitor performance**: Track response times and error rates
2. **Update documentation**: Update internal docs with new tool names
3. **Train team**: Ensure developers know about breaking changes
4. **Plan for v3.0**: Review [ZERODB_MCP_ENHANCEMENT_PLAN.md](./docs/ZERODB_MCP_ENHANCEMENT_PLAN.md) for upcoming features

---

**Last Updated**: 2025-10-14
**Version**: 2.0.0
**Status**: Production Ready
