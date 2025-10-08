# NPM Publishing Commands

## Step 1: Login to NPM
```bash
cd /Users/aideveloper/ainative-zerodb-mcp-server
npm login --auth-type=web
```

**Credentials:**
- Username: `urbantech`
- Email: `utventures@gmail.com`
- You'll be prompted to authenticate via browser

## Step 2: Publish Package
```bash
npm publish
```

## Step 3: Verify Publication
```bash
npm view ainative-zerodb-mcp-server
```

## Package Contents Verified
✅ **Package Size**: 7.5 kB compressed, 28.8 kB unpacked
✅ **Files Included**:
  - index.js (17.3kB) - Main MCP server
  - package.json (1.1kB) - Package configuration
  - README.md (7.0kB) - Complete documentation
  - PUBLISH.md (3.3kB) - Publishing instructions

## What Changed in v1.0.2
- Fixed base URL: `https://api.ainative.studio` (removed duplicate `/api/v1`)
- Updated authentication: `/v1/admin/auth/login/json` with email/password JSON body
- Fixed API endpoints: `/v1/admin/zerodb/*` paths
- Updated environment variables: `ZERODB_API_BASE_URL`, `ZERODB_API_KEY`, `ZERODB_EMAIL`
- Updated default credentials to match production configuration
