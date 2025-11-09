Subject: ZeroDB MCP Server v2.0.5 Released - Your Reported Issues Fixed

---

Hi DJ Union Team,

Thank you for reporting the critical issues you encountered with the ZeroDB MCP Server. We wanted to follow up and let you know that **all reported issues have been resolved** in version **2.0.5**, which is now available on NPM.

## What Was Fixed

Based on your bug reports, we identified and fixed the following critical issues:

### 1. **User Registration Broken (HTTP 500)**
- **Issue**: New users could not create accounts - registration endpoint returned HTTP 500 errors
- **Root Cause**: Backend synchronous function was incorrectly calling async email task
- **Fix**: Removed problematic async call; registration now works flawlessly
- **Impact**: All new users can now successfully sign up

### 2. **MCP Operations Failing (404 Errors)**
- **Issue**: All 60 MCP operations returning 404 errors
- **Root Cause**: Incorrect API endpoint path (`/api/v1/public/...` instead of `/v1/public/...`)
- **Fix**: Corrected all endpoint paths to match production API routing
- **Impact**: All MCP operations now functional

### 3. **Authentication Failures (401/405 Errors)**
- **Issue**: Login endpoint rejecting credentials
- **Root Cause**: Using wrong endpoint and content-type
- **Fix**: Updated to use `/v1/public/auth/login-json` with JSON payload
- **Impact**: Authentication now works reliably

## How to Upgrade

### Step 1: Update the Package
```bash
npm install ainative-zerodb-mcp-server@latest
```

This will install **v2.0.5** (or newer).

### Step 2: Verify Installation
```bash
npm list ainative-zerodb-mcp-server
```

You should see version **2.0.5** or higher.

### Step 3: Restart Your MCP Client
- **Claude Desktop**: Restart the application
- **Windsurf**: Reload the window or restart the IDE
- **Other MCP Clients**: Restart per your client's documentation

### Step 4: Test the Connection
After restarting, the server will:
- Automatically authenticate using your existing credentials
- Connect to the correct API endpoints
- Enable all 60 operations

## What's Included in v2.0.5

✅ **114 tests passing** with 82.85% code coverage
✅ **0 security vulnerabilities** (clean npm audit)
✅ **All 60 operations functional**:
- Memory operations (store, search, context)
- Vector operations (store, search with 1536 dimensions)
- Quantum compression operations
- NoSQL table operations
- File storage operations
- Event streaming operations
- Project management operations
- RLHF feedback collection
- Admin operations

✅ **Enterprise-ready features**:
- Automatic token renewal (every 25 minutes)
- Robust error handling with detailed messages
- Session and namespace isolation
- Production API integration

## Rigorous Testing Performed

We conducted comprehensive end-to-end testing as brand new users to ensure the complete onboarding flow works:

1. ✅ New user registration via API
2. ✅ User login with credentials
3. ✅ Project creation
4. ✅ MCP server initialization
5. ✅ All 60 MCP operations
6. ✅ Token renewal and session management

All test artifacts are available in our repository if you'd like to review our testing methodology.

## Breaking Changes (If Any)

If you were using v1.x, please note:
- Tool names now use `zerodb_` prefix (e.g., `zerodb_store_memory` instead of `store_memory`)
- Vector dimensions strictly enforced to 1536 (OpenAI ada-002 standard)

See our [Migration Guide](https://github.com/AINative-Studio/ainative-zerodb-mcp-server/blob/main/MIGRATION.md) for full details.

## Old Versions Deprecated

All broken versions have been deprecated on NPM:
- **v1.0.0 - v1.0.7**: Critical MCP operation bugs
- **v2.0.0 - v2.0.1**: Authentication endpoint issues
- **v2.0.2**: MCP endpoint path errors

If you install via `npm install ainative-zerodb-mcp-server@latest`, you'll automatically get the working version.

## Support & Documentation

- **Full Changelog**: [CHANGELOG.md](https://github.com/AINative-Studio/ainative-zerodb-mcp-server/blob/main/CHANGELOG.md)
- **Documentation**: [README.md](https://github.com/AINative-Studio/ainative-zerodb-mcp-server#readme)
- **Issues**: [GitHub Issues](https://github.com/AINative-Studio/ainative-zerodb-mcp-server/issues)
- **Email Support**: support@ainative.studio

## Need Help?

If you encounter any issues during the upgrade or have questions:

1. **Check the logs**: The MCP server outputs detailed error messages to stderr
2. **Verify credentials**: Ensure your `ZERODB_API_KEY` and `ZERODB_PROJECT_ID` are correct
3. **Open an issue**: We respond within 24 hours on GitHub
4. **Email us**: support@ainative.studio for direct assistance

## Thank You

Your bug report was invaluable in helping us identify these critical issues before they affected more users. We've implemented rigorous testing standards to prevent similar issues in the future:

- Minimum 82% test coverage requirement
- Complete end-to-end testing as new users
- Pre-publish security audits
- Comprehensive integration testing

We're committed to providing a production-ready, enterprise-grade MCP server for the AI agent ecosystem.

Please let us know if you have any questions or if you encounter any issues with v2.0.5.

Best regards,

**AINative Studio Team**
support@ainative.studio
https://ainative.studio

---

P.S. We'd love to hear about your experience with v2.0.5. If everything works well, a quick note or GitHub star would be greatly appreciated!
