# Changelog

All notable changes to the ZeroDB MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.8] - 2025-11-09

### Fixed
- Fixed version string consistency across all files (package.json, index.js, README.md)
- Corrected MCP server constructor version to match package version
- All version references now consistently show 2.0.8

### Changed
- Version bump to 2.0.8 due to NPM republish restrictions (v2.0.6 and v2.0.7 had inconsistent version strings)

## [2.0.5] - 2025-10-18

### Changed
- Version bump to 2.0.5 due to NPM republish restriction (v2.0.4 was unpublished during testing)
- All functionality identical to intended v2.0.4 release

## [2.0.4] - 2025-10-18 (Unpublished)

### Fixed
- **Critical Backend Fix**: Fixed user registration endpoint returning HTTP 500
  - Backend issue prevented all new user signups
  - Removed problematic asyncio call in synchronous registration function
  - New users can now successfully create accounts via API and web interface
  - Verified complete end-to-end onboarding flow works

### Testing
- Comprehensive rigorous testing performed as brand new user
- Validated complete workflow: registration → login → project creation → MCP operations
- All README onboarding instructions now functional
- End-to-end test artifacts available in repository

### Impact
This release unblocks new user onboarding. Users on v2.0.3 can continue using the MCP server with existing accounts, but new users should use v2.0.4 for successful account creation.

## [2.0.3] - 2025-10-18

### Fixed
- **Critical Fix**: Corrected API endpoint path from `/api/v1/public/zerodb/mcp/execute` to `/v1/public/zerodb/mcp/execute`
  - Removes non-existent `/api` prefix that was causing all operations to fail with 404
  - All 60 operations now functional
  - Backend endpoint properly mounted in public router

### Changed
- Updated API base URL structure to match production API routing
- Improved error messages for endpoint connection failures

## [2.0.2] - 2025-10-18

### Fixed
- **Critical Authentication Fix**: Updated login endpoint from `/api/v1/admin/auth/login` to `/v1/public/auth/login-json`
  - Changed from form-encoded to JSON payload for authentication
  - Fixes 401/405 errors preventing server initialization
  - All users should update to this version immediately

### Changed
- Authentication now uses the correct public API endpoint with JSON content type
- Improved error handling for authentication failures

## [2.0.0] - 2025-10-14

### Major Release - Enterprise-Ready MCP Server

This is a major release that transforms the ZeroDB MCP Server into a production-ready, enterprise-grade integration for AI agents and frameworks.

### Added

#### Core Features
- **Unified Tool Naming Convention**: All tools now use `zerodb_` prefix for better namespace management
- **Enhanced Authentication System**: Automatic token renewal with 25-minute refresh interval
- **Robust Error Handling**: Detailed error messages with proper error state propagation
- **Vector Validation**: Strict 1536-dimension validation with helpful error messages
- **Configuration Management**: Environment-based configuration with sensible defaults

#### New Operations
- `zerodb_store_memory` - Store agent memory with session/agent tracking
- `zerodb_search_memory` - Semantic search across stored memories
- `zerodb_get_context` - Retrieve conversation context with token management
- `zerodb_store_vector` - Store 1536-dimensional vector embeddings
- `zerodb_search_vectors` - Semantic vector search with similarity thresholds
- `zerodb_renew_token` - Manual token renewal for debugging

#### Developer Experience
- **Automatic Token Management**: Background token renewal prevents authentication failures
- **Context Window Building**: Smart token counting and message windowing
- **Namespace Support**: Vector namespaces for multi-project isolation
- **Metadata Support**: Rich metadata for vectors and memories
- **Session Tracking**: Automatic session/agent ID generation

#### Infrastructure
- **Timeout Handling**: 10s auth timeout, 15s operation timeout
- **Logging**: Comprehensive stderr logging for debugging
- **Error Recovery**: Graceful error handling with informative messages

### Changed

#### Breaking Changes
- **Tool Names**: All operations now prefixed with `zerodb_` instead of direct names
  - `store_memory` → `zerodb_store_memory`
  - `search_memory` → `zerodb_search_memory`
  - `get_context` → `zerodb_get_context`
  - `store_vector` → `zerodb_store_vector`
  - `search_vectors` → `zerodb_search_vectors`

- **Vector Dimensions**: Strict enforcement of 1536 dimensions (OpenAI ada-002 standard)
  - Previously: No validation
  - Now: Hard requirement with validation errors

- **Authentication Flow**: Token-based authentication with automatic renewal
  - Previously: Manual token management
  - Now: Automatic renewal every 25 minutes

- **Error Response Format**: Structured error responses with `isError` flag
  ```json
  {
    "content": [{"type": "text", "text": "Error message"}],
    "isError": true
  }
  ```

- **Default Namespace**: Vector namespace defaults to `windsurf` instead of `default`

### Fixed

- **Token Expiry Issues**: Automatic token renewal prevents mid-operation authentication failures
- **Vector Dimension Validation**: Clear error messages for dimension mismatches
- **Memory Query Parameters**: Proper parameter passing for session/agent filtering
- **Error Message Clarity**: Detailed error messages including API response details
- **URL Path Construction**: Proper API URL normalization for different base URLs

### Security

- **Zero HIGH/CRITICAL Vulnerabilities**: Clean npm audit with updated dependencies
- **Token Expiry Management**: 5-minute buffer before token expiration
- **Timeout Protection**: All network requests have timeout limits
- **Error Message Sanitization**: Safe error message handling without exposing internals

### Performance

- **Token Caching**: Reduced authentication overhead with token reuse
- **Async Operations**: Full async/await support for better concurrency
- **Efficient Context Building**: Smart token estimation (4 chars = 1 token)
- **Connection Pooling**: Axios HTTP client with connection reuse

### Documentation

- Added comprehensive README (if exists)
- Environment variable documentation
- Tool usage examples
- Error handling guidelines
- Migration guide for v1.x users

## [1.0.7] - 2025-10-08

### Initial Release

- Basic memory operations (store, search, context)
- Vector operations (store, search)
- Simple authentication
- Initial MCP protocol implementation

---

## Migration Guide

See [MIGRATION.md](./MIGRATION.md) for detailed migration instructions from v1.x to v2.0.0.

## Planned Features

### [2.1.0] - Planned
- Batch vector operations
- Vector deletion and updates
- Memory deletion operations
- Advanced filtering options

### [3.0.0] - Under Consideration
- 54 additional operations (60 total)
- Quantum-enhanced vector operations
- NoSQL table operations
- File storage operations
- Event streaming
- Project management
- RLHF feedback collection
- Admin operations

See [ZERODB_MCP_ENHANCEMENT_PLAN.md](./docs/ZERODB_MCP_ENHANCEMENT_PLAN.md) for details.

---

## Support

- **Issues**: https://github.com/AINative-Studio/ainative-zerodb-mcp-server/issues
- **Documentation**: https://github.com/AINative-Studio/ainative-zerodb-mcp-server#readme
- **Email**: support@ainative.studio

## License

MIT License - see [LICENSE](./LICENSE) for details.
