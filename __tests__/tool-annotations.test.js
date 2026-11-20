const { ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js')
const ZeroDBMCPServer = require('../index')

// Mock console.error to reduce noise in tests
global.console.error = jest.fn()

const TEST_CONFIG = {
  apiUrl: 'https://api.ainative.studio',
  projectId: 'test-project-123',
  apiToken: 'test-token-abc',
  username: 'test@ainative.studio',
  password: 'TestPassword123!'
}

const createMockedServer = () => {
  process.env.ZERODB_API_URL = TEST_CONFIG.apiUrl
  process.env.ZERODB_PROJECT_ID = TEST_CONFIG.projectId
  process.env.ZERODB_USERNAME = TEST_CONFIG.username
  process.env.ZERODB_PASSWORD = TEST_CONFIG.password

  const server = new ZeroDBMCPServer()
  server.apiToken = TEST_CONFIG.apiToken
  server.tokenExpiry = Date.now() + 30 * 60 * 1000

  return server
}

// MCP tool annotations (readOnlyHint, destructiveHint, idempotentHint,
// openWorldHint) are advisory hints some clients use to decide whether to
// prompt the user before running a tool. Codex CLI skips its confirmation
// when readOnlyHint is true, or when destructiveHint is false and
// openWorldHint is false; VS Code/Copilot and Goose (Smart Approve) skip it
// when readOnlyHint is true. A wrong hint silently removes the user's only
// safety checkpoint before a write runs against the hosted database.
//
// Reported by an external security researcher: zerodb_update_rows accepts an
// unbounded MongoDB-style filter + $set/$inc update and can overwrite every
// matching row in a table (no row limit, unlike zerodb_delete_rows which has
// one) -- but was labeled destructiveHint: false, readOnlyHint: false, which
// is exactly the combination several clients treat as safe-to-auto-run.
describe('MCP tool annotations - destructiveHint/readOnlyHint accuracy', () => {
  let tools

  beforeAll(async () => {
    const server = createMockedServer()
    let listToolsHandler
    const originalSetRequestHandler = server.server.setRequestHandler.bind(server.server)
    server.server.setRequestHandler = (schema, handler) => {
      if (schema === ListToolsRequestSchema) {
        listToolsHandler = handler
      }
      return originalSetRequestHandler(schema, handler)
    }
    server.setupTools()
    const result = await listToolsHandler()
    tools = result.tools
  })

  const getTool = (name) => tools.find((t) => t.name === name)

  test('zerodb_update_rows is labeled destructiveHint: true', () => {
    const tool = getTool('zerodb_update_rows')
    expect(tool).toBeDefined()
    expect(tool.annotations.destructiveHint).toBe(true)
  })

  test('zerodb_update_rows is labeled readOnlyHint: false', () => {
    const tool = getTool('zerodb_update_rows')
    expect(tool.annotations.readOnlyHint).toBe(false)
  })

  test('every delete_* tool and update_rows consistently signal destructiveHint: true', () => {
    const mustBeDestructive = tools.filter((t) => /^zerodb_(delete_|update_rows$)/.test(t.name))
    expect(mustBeDestructive.length).toBeGreaterThan(0)
    const mislabeled = mustBeDestructive.filter((t) => t.annotations.destructiveHint !== true)
    expect(mislabeled.map((t) => t.name)).toEqual([])
  })

  test('no tool with destructiveHint: true is also marked readOnlyHint: true', () => {
    const contradictory = tools.filter(
      (t) => t.annotations.destructiveHint === true && t.annotations.readOnlyHint === true
    )
    expect(contradictory.map((t) => t.name)).toEqual([])
  })
})
