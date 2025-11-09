# Security Policy

## Overview

The AINative ZeroDB MCP Server v2.0.0 is designed with security as a top priority. This document outlines our security practices, features, and how to report vulnerabilities.

## Security Features

### 1. Authentication & Authorization

- **No Hardcoded Credentials**: All credentials must be provided via environment variables
- **Automatic Token Renewal**: JWT tokens are automatically renewed before expiry (every 25 minutes)
- **Token Expiration Management**: Tokens expire after 30 minutes with automatic refresh 5 minutes before expiry
- **Bearer Token Authentication**: All API requests use secure Bearer token authentication

### 2. Data Protection

- **No PII Logging**: The server does not log personally identifiable information (PII)
- **Sanitized Error Messages**: Error responses do not expose internal system details or sensitive data
- **Secure Password Handling**: Passwords are only transmitted over HTTPS and never logged
- **Environment Variable Security**: All sensitive configuration is loaded from environment variables

### 3. Input Validation

- **Schema Validation**: All tool inputs are validated against JSON schemas
- **Vector Dimension Validation**: Strict validation ensures vectors are exactly 1536 dimensions
- **Type Checking**: All parameters are type-checked before processing
- **Error Boundary Protection**: Comprehensive error handling prevents information leakage

### 4. Network Security

- **HTTPS Only**: Default API URL uses HTTPS (api.ainative.studio)
- **Request Timeouts**: All requests have timeout limits to prevent hanging connections
  - Authentication: 10 seconds
  - Operations: 30 seconds
  - Standard requests: 15 seconds
- **Rate Limiting Ready**: Compatible with backend rate limiting and security headers

### 5. Dependency Security

- **Zero Known Vulnerabilities**: All dependencies are audited and free from HIGH/CRITICAL vulnerabilities
- **Regular Updates**: Dependencies are kept up-to-date with security patches
- **Minimal Dependencies**: Only essential packages are included:
  - `@modelcontextprotocol/sdk`: ^1.0.0
  - `axios`: ^1.7.7 (latest secure version)
  - `uuid`: ^11.0.3

## Security Audit Results

**Last Audit Date**: 2025-10-14

### NPM Audit Results
```
Total Vulnerabilities: 0
  - Critical: 0
  - High: 0
  - Moderate: 0
  - Low: 0
```

### Code Security Checks

✅ **PASSED**: No hardcoded credentials
✅ **PASSED**: No PII in logs
✅ **PASSED**: Sanitized error messages
✅ **PASSED**: Input validation on all operations
✅ **PASSED**: Secure credential management
✅ **PASSED**: No known dependency vulnerabilities

## Configuration Security Best Practices

### Required Environment Variables

```bash
# REQUIRED - Never hardcode these values
export ZERODB_USERNAME="your-email@example.com"
export ZERODB_PASSWORD="your-secure-password"
export ZERODB_PROJECT_ID="your-project-id"

# OPTIONAL - Secure defaults provided
export ZERODB_API_URL="https://api.ainative.studio/api/v1"
export MCP_CONTEXT_WINDOW="8192"
export MCP_RETENTION_DAYS="30"
```

### Security Recommendations

1. **Never commit credentials**: Use environment variables or secret management systems
2. **Use strong passwords**: Minimum 12 characters with complexity requirements
3. **Rotate credentials regularly**: Change passwords and tokens every 90 days
4. **Limit project access**: Use project-specific credentials with minimal required permissions
5. **Monitor logs**: Regularly review server logs for suspicious activity
6. **Keep updated**: Always use the latest version for security patches

### Claude Desktop Configuration

When configuring the MCP server in Claude Desktop's `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "zerodb": {
      "command": "npx",
      "args": ["-y", "ainative-zerodb-mcp-server"],
      "env": {
        "ZERODB_USERNAME": "your-email@example.com",
        "ZERODB_PASSWORD": "your-secure-password",
        "ZERODB_PROJECT_ID": "your-project-id"
      }
    }
  }
}
```

**Security Note**: The `claude_desktop_config.json` file should be protected with appropriate file permissions (e.g., `chmod 600` on Unix systems).

### Windsurf Configuration

For Windsurf IDE:

```json
{
  "mcp": {
    "servers": {
      "zerodb": {
        "type": "node",
        "command": "npx",
        "args": ["-y", "ainative-zerodb-mcp-server"],
        "env": {
          "ZERODB_USERNAME": "your-email@example.com",
          "ZERODB_PASSWORD": "your-secure-password",
          "ZERODB_PROJECT_ID": "your-project-id"
        }
      }
    }
  }
}
```

## Supported Versions

| Version | Supported          | Security Updates |
| ------- | ------------------ | ---------------- |
| 2.0.x   | ✅ Yes             | Active           |
| 1.x.x   | ❌ No              | Deprecated       |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please follow our responsible disclosure process:

### How to Report

1. **Email**: Send details to [support@ainative.studio](mailto:support@ainative.studio)
2. **Subject**: Use "SECURITY: [Brief Description]"
3. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if available)

### What to Expect

- **Initial Response**: Within 24-48 hours
- **Status Update**: Every 3-5 business days
- **Resolution Timeline**:
  - Critical vulnerabilities: 24-72 hours
  - High vulnerabilities: 1-2 weeks
  - Medium/Low vulnerabilities: 2-4 weeks

### Disclosure Policy

- **Embargo Period**: We request a 90-day embargo before public disclosure
- **Credit**: Security researchers will be credited in release notes (unless requested otherwise)
- **CVE Assignment**: We will work with you to assign CVEs for significant vulnerabilities

### Do NOT

- Publicly disclose the vulnerability before we've had a chance to fix it
- Test vulnerabilities on production systems without permission
- Access, modify, or delete data belonging to other users
- Perform DoS attacks or spam

## Security Hall of Fame

We recognize security researchers who help improve our security:

*No submissions yet - be the first!*

## Compliance

This package follows security best practices aligned with:

- OWASP Top 10 for API Security
- CWE/SANS Top 25 Most Dangerous Software Errors
- NPM Security Best Practices
- Node.js Security Best Practices

## Security Updates

Subscribe to security updates:

- **GitHub**: Watch the repository for releases
- **NPM**: `npm outdated ainative-zerodb-mcp-server`
- **Email**: Contact support@ainative.studio to join our security mailing list

## Additional Resources

- [README.md](./README.md) - General documentation
- [CHANGELOG.md](./CHANGELOG.md) - Version history and security fixes
- [GitHub Issues](https://github.com/AINative-Studio/ainative-zerodb-mcp-server/issues) - Bug reports
- [AINative Documentation](https://docs.ainative.studio) - Full platform documentation

## License

This security policy is part of the AINative ZeroDB MCP Server, licensed under MIT License.

---

**Last Updated**: 2025-10-14
**Version**: 2.0.0
**Security Audit Status**: ✅ PASSED (0 vulnerabilities)
