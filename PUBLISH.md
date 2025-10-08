# Publishing Instructions

## Package Ready for NPM Publication

The package has been updated with:
- ✅ Fixed base URL: `https://api.ainative.studio` (no duplicate `/api/v1`)
- ✅ Updated credentials to match global config
- ✅ Fixed authentication endpoint: `/v1/admin/auth/login/json`
- ✅ Fixed API endpoints to use `/v1/admin/zerodb/*` paths
- ✅ Updated to version 1.0.2
- ✅ Dependencies installed (0 vulnerabilities)
- ✅ README.md created with complete documentation
- ✅ index.js properly configured

## Changes Made

### Configuration Updates
- Changed `ZERODB_API_URL` → `ZERODB_API_BASE_URL`
- Changed `ZERODB_API_TOKEN` → `ZERODB_API_KEY`
- Changed `ZERODB_USERNAME` → `ZERODB_EMAIL`
- Updated default password: `AINative2024Admin!` → `Admin2025!Secure`

### API Endpoint Updates
- Authentication: `/v1/admin/auth/login/json` (using JSON body with email/password)
- Memory Store: `/v1/admin/zerodb/memory/store`
- Memory Search: `/v1/admin/zerodb/memory`
- Vector Upsert: `/v1/admin/zerodb/vectors/upsert`
- Vector Search: `/v1/admin/zerodb/vectors/search`

### Base URL Fix
- Old: `https://api.ainative.studio/api/v1` (caused `/api/v1/api/v1` duplication)
- New: `https://api.ainative.studio` (clean, no duplication)

## To Publish to NPM

1. **Login to NPM** (if not already logged in as urbantech):
```bash
npm login
# Username: urbantech
# Email: toby@rely.ventures
```

2. **Navigate to package directory**:
```bash
cd /Users/aideveloper/ainative-zerodb-mcp-server
```

3. **Verify package contents**:
```bash
npm pack --dry-run
```

4. **Publish to NPM**:
```bash
npm publish
```

5. **Verify publication**:
```bash
npm view ainative-zerodb-mcp-server
```

## Testing After Publication

1. **Install globally**:
```bash
npm install -g ainative-zerodb-mcp-server@1.0.2
```

2. **Update Claude config** (`~/.claude.json`):
```json
{
  "mcpServers": {
    "ainative-zerodb": {
      "type": "stdio",
      "command": "npx",
      "args": ["ainative-zerodb-mcp-server"],
      "env": {
        "ZERODB_EMAIL": "admin@ainative.studio",
        "ZERODB_PASSWORD": "Admin2025!Secure",
        "ZERODB_API_KEY": "kLPiP0bzgKJ0CnNYVt1wq3qxbs2QgDeF2XwyUnxBEOM",
        "ZERODB_API_BASE_URL": "https://api.ainative.studio"
      }
    }
  }
}
```

3. **Restart Claude Desktop/Code**

4. **Test MCP tools**:
```
"Store this in memory: Testing updated MCP server"
"Search my memories"
```

## Package Location

**Directory**: `/Users/aideveloper/ainative-zerodb-mcp-server/`

**Files**:
- `index.js` - Main MCP server (568 lines)
- `package.json` - Package configuration (v1.0.2)
- `README.md` - Complete documentation
- `.gitignore` - Git ignore rules
- `PUBLISH.md` - This file

## Version History

- **1.0.0** - Initial release (2025-09-22)
- **1.0.1** - Previous version (2025-09-29)
- **1.0.2** - Previous version (2025-10-08)
  - Fixed base URL configuration
  - Updated authentication to use email instead of username
  - Fixed API endpoints to use `/v1/admin/zerodb/*` paths
  - Updated default credentials to match production
- **1.0.3** - Previous version (2025-10-08)
  - **BREAKING CHANGE**: Switched from admin endpoints to public endpoints
  - Authentication now uses `/v1/auth/login` (public user auth)
  - All ZeroDB endpoints now use `/v1/zerodb/*` (public access)
  - Users now use their own credentials instead of admin credentials
  - All operations scoped to authenticated user account
  - Updated response parsing to match public API format
- **1.0.4** - Current version (2025-10-08)
  - Fixed documentation link to correct enhanced API docs URL

## Next Steps

After publishing:
1. Update global Claude config with new package version
2. Test all MCP tools (memory store, search, vector operations)
3. Verify authentication works correctly
4. Create GitHub repository if needed
5. Consider creating a changelog for future updates
