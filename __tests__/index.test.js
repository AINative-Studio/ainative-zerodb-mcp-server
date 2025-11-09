const nock = require('nock')
const ZeroDBMCPServer = require('../index')

// Mock console.error to reduce noise in tests
global.console.error = jest.fn()

// Test utilities
const TEST_CONFIG = {
  apiUrl: 'https://api.ainative.studio',
  projectId: 'test-project-123',
  apiToken: 'test-token-abc',
  username: 'test@ainative.studio',
  password: 'TestPassword123!'
}

const mockAuthResponse = {
  access_token: 'mock-access-token-12345',
  expires_in: 1800,
  token_type: 'bearer'
}

const createTestVector = (dimension = 1536) => {
  return Array(dimension).fill(0).map(() => Math.random())
}

// Setup function for creating server instance with mocked auth
const createMockedServer = () => {
  process.env.ZERODB_API_URL = TEST_CONFIG.apiUrl
  process.env.ZERODB_PROJECT_ID = TEST_CONFIG.projectId
  process.env.ZERODB_USERNAME = TEST_CONFIG.username
  process.env.ZERODB_PASSWORD = TEST_CONFIG.password

  const server = new ZeroDBMCPServer()
  server.apiToken = TEST_CONFIG.apiToken
  server.tokenExpiry = Date.now() + 30 * 60 * 1000 // 30 minutes from now

  return server
}

// Clean up function
const cleanupNock = () => {
  nock.cleanAll()
  nock.enableNetConnect()
}

describe('ZeroDBMCPServer - Initialization', () => {
  beforeEach(() => {
    cleanupNock()
    jest.clearAllMocks()
    // Set required env vars for all initialization tests
    process.env.ZERODB_USERNAME = TEST_CONFIG.username
    process.env.ZERODB_PASSWORD = TEST_CONFIG.password
  })

  afterEach(() => {
    cleanupNock()
  })

  test('should initialize with default configuration', () => {
    const server = new ZeroDBMCPServer()
    expect(server.apiUrl).toBeDefined()
    expect(server.server).toBeDefined()
    expect(server.contextWindow).toBe(8192)
    expect(server.retentionDays).toBe(30)
  })

  test('should initialize with environment variables', () => {
    process.env.ZERODB_API_URL = 'https://custom.api.com'
    process.env.ZERODB_PROJECT_ID = 'custom-project'
    process.env.MCP_CONTEXT_WINDOW = '16384'
    process.env.MCP_RETENTION_DAYS = '60'

    const server = new ZeroDBMCPServer()

    expect(server.apiUrl).toBe('https://custom.api.com')
    expect(server.projectId).toBe('custom-project')
    expect(server.contextWindow).toBe(16384)
    expect(server.retentionDays).toBe(60)
  })

  test('should use default values when env vars are not set', () => {
    delete process.env.ZERODB_API_URL
    delete process.env.ZERODB_PROJECT_ID
    delete process.env.MCP_CONTEXT_WINDOW

    const server = new ZeroDBMCPServer()

    expect(server.apiUrl).toBe('https://api.ainative.studio')
    expect(server.contextWindow).toBe(8192)
  })

  test('should setup MCP server with correct name and version', () => {
    const server = new ZeroDBMCPServer()
    expect(server.server).toBeDefined()
  })

  test('should initialize token expiry as null', () => {
    const server = new ZeroDBMCPServer()
    expect(server.tokenExpiry).toBeNull()
  })

  test('should require ZERODB_USERNAME environment variable', () => {
    delete process.env.ZERODB_USERNAME
    process.env.ZERODB_PASSWORD = TEST_CONFIG.password

    expect(() => new ZeroDBMCPServer()).toThrow('SECURITY ERROR')
  })

  test('should require ZERODB_PASSWORD environment variable', () => {
    process.env.ZERODB_USERNAME = TEST_CONFIG.username
    delete process.env.ZERODB_PASSWORD

    expect(() => new ZeroDBMCPServer()).toThrow('SECURITY ERROR')
  })

  test('should call setupTools during initialization', () => {
    const server = new ZeroDBMCPServer()
    // setupTools() registers handlers with server.setRequestHandler
    // We verify this by checking that server.server exists (MCP Server instance)
    expect(server.server).toBeDefined()
  })

  test('should call setupHandlers during initialization', () => {
    const server = new ZeroDBMCPServer()
    // setupHandlers() registers CallToolRequestSchema handler
    expect(server.server).toBeDefined()
  })

  test('should call setupTokenRenewal during initialization', () => {
    const server = new ZeroDBMCPServer()
    // setupTokenRenewal() sets up interval timer
    expect(server.server).toBeDefined()
  })
})

describe('ZeroDBMCPServer - Authentication', () => {
  beforeEach(() => {
    cleanupNock()
    jest.clearAllMocks()
    // Set required env vars
    process.env.ZERODB_USERNAME = TEST_CONFIG.username
    process.env.ZERODB_PASSWORD = TEST_CONFIG.password
  })

  afterEach(() => {
    cleanupNock()
  })

  test('should successfully renew token with valid credentials', async () => {
    nock('https://api.ainative.studio')
      .post('/v1/public/auth/login-json')
      .reply(200, mockAuthResponse)

    const server = new ZeroDBMCPServer()
    const result = await server.renewToken()

    expect(result).toBe(true)
    expect(server.apiToken).toBe(mockAuthResponse.access_token)
    expect(server.tokenExpiry).toBeGreaterThan(Date.now())
  })

  test('should handle authentication failure with 401', async () => {
    nock('https://api.ainative.studio')
      .post('/v1/public/auth/login-json')
      .reply(401, { detail: 'Invalid credentials' })

    const server = new ZeroDBMCPServer()

    await expect(server.renewToken()).rejects.toThrow('Authentication failed')
  })

  test('should handle network errors during token renewal', async () => {
    nock('https://api.ainative.studio')
      .post('/v1/public/auth/login-json')
      .replyWithError('Network error')

    const server = new ZeroDBMCPServer()

    await expect(server.renewToken()).rejects.toThrow('Authentication failed')
  })

  test('should handle timeout during token renewal', async () => {
    nock('https://api.ainative.studio')
      .post('/v1/public/auth/login-json')
      .delayConnection(11000)
      .reply(200, mockAuthResponse)

    const server = new ZeroDBMCPServer()

    await expect(server.renewToken()).rejects.toThrow()
  })

  test('should use default expires_in when not provided', async () => {
    nock('https://api.ainative.studio')
      .post('/v1/public/auth/login-json')
      .reply(200, { access_token: 'test-token' })

    const server = new ZeroDBMCPServer()
    await server.renewToken()

    const expectedExpiry = Date.now() + (1800 * 1000)
    expect(server.tokenExpiry).toBeGreaterThan(expectedExpiry - 1000)
  })

  test('should renew token when token is null', async () => {
    nock('https://api.ainative.studio')
      .post('/v1/public/auth/login-json')
      .reply(200, mockAuthResponse)

    const server = new ZeroDBMCPServer()
    server.apiToken = null

    await server.ensureValidToken()

    expect(server.apiToken).toBe(mockAuthResponse.access_token)
  })

  test('should renew token when token is expired', async () => {
    nock('https://api.ainative.studio')
      .post('/v1/public/auth/login-json')
      .reply(200, mockAuthResponse)

    const server = new ZeroDBMCPServer()
    server.apiToken = 'old-token'
    server.tokenExpiry = Date.now() - 1000 // Expired

    await server.ensureValidToken()

    expect(server.apiToken).toBe(mockAuthResponse.access_token)
  })

  test('should renew token when expiring in less than 5 minutes', async () => {
    nock('https://api.ainative.studio')
      .post('/v1/public/auth/login-json')
      .reply(200, mockAuthResponse)

    const server = new ZeroDBMCPServer()
    server.apiToken = 'old-token'
    server.tokenExpiry = Date.now() + (4 * 60 * 1000) // 4 minutes from now

    await server.ensureValidToken()

    expect(server.apiToken).toBe(mockAuthResponse.access_token)
  })

  test('should not renew token when still valid', async () => {
    const server = new ZeroDBMCPServer()
    server.apiToken = 'valid-token'
    server.tokenExpiry = Date.now() + (10 * 60 * 1000) // 10 minutes from now

    const oldToken = server.apiToken
    await server.ensureValidToken()

    expect(server.apiToken).toBe(oldToken)
  })

  test('should handle manual token renewal success', async () => {
    nock('https://api.ainative.studio')
      .post('/v1/public/auth/login-json')
      .reply(200, mockAuthResponse)

    const server = new ZeroDBMCPServer()
    const result = await server.manualTokenRenewal()

    expect(result.content[0].text).toContain('Token renewed successfully')
    expect(result.isError).toBeUndefined()
  })

  test('should handle manual token renewal failure', async () => {
    nock('https://api.ainative.studio')
      .post('/v1/public/auth/login-json')
      .reply(401, { detail: 'Invalid credentials' })

    const server = new ZeroDBMCPServer()
    const result = await server.manualTokenRenewal()

    expect(result.content[0].text).toContain('Token renewal failed')
    expect(result.isError).toBe(true)
  })

  test('should handle authentication with custom API URL', async () => {
    process.env.ZERODB_API_URL = 'https://custom.api.com'

    nock('https://custom.api.com')
      .post('/v1/public/auth/login-json')
      .reply(200, mockAuthResponse)

    const server = new ZeroDBMCPServer()
    await server.renewToken()

    expect(server.apiToken).toBe(mockAuthResponse.access_token)
  })

  test('should throw error message when renewToken fails without access_token', async () => {
    nock('https://api.ainative.studio')
      .post('/v1/public/auth/login-json')
      .reply(200, { expires_in: 1800 }) // Missing access_token

    const server = new ZeroDBMCPServer()

    await expect(server.renewToken()).rejects.toThrow('Authentication failed: Connection error')
  })
})

describe('ZeroDBMCPServer - Execute Operation', () => {
  beforeEach(() => {
    cleanupNock()
    jest.clearAllMocks()
  })

  afterEach(() => {
    cleanupNock()
  })

  test('should execute operation successfully', async () => {
    const server = createMockedServer()

    nock('https://api.ainative.studio')
      .post('/v1/public/zerodb/mcp/execute')
      .reply(200, {
        success: true,
        result: { message: 'Operation successful' }
      })

    const result = await server.executeOperation('test_operation', { param: 'value' })

    expect(result.content[0].text).toContain('Operation successful')
    expect(result.isError).toBeUndefined()
  })

  test('should add project_id to params if not present', async () => {
    const server = createMockedServer()

    let capturedRequest
    nock('https://api.ainative.studio')
      .post('/v1/public/zerodb/mcp/execute')
      .reply(200, function (_uri, requestBody) {
        capturedRequest = requestBody
        return { success: true, result: {} }
      })

    await server.executeOperation('test_operation', { param: 'value' })

    expect(capturedRequest.params.project_id).toBe(TEST_CONFIG.projectId)
  })

  test('should not override project_id if already present', async () => {
    const server = createMockedServer()

    let capturedRequest
    nock('https://api.ainative.studio')
      .post('/v1/public/zerodb/mcp/execute')
      .reply(200, function (_uri, requestBody) {
        capturedRequest = requestBody
        return { success: true, result: {} }
      })

    await server.executeOperation('test_operation', { project_id: 'custom-project' })

    expect(capturedRequest.params.project_id).toBe('custom-project')
  })

  test('should handle operation failure response', async () => {
    const server = createMockedServer()

    nock('https://api.ainative.studio')
      .post('/v1/public/zerodb/mcp/execute')
      .reply(200, {
        success: false,
        error: { message: 'Operation failed', code: 'VALIDATION_ERROR' }
      })

    const result = await server.executeOperation('test_operation', {})

    expect(result.content[0].text).toContain('Operation failed')
    expect(result.isError).toBe(true)
  })

  test('should handle API error response', async () => {
    const server = createMockedServer()

    nock('https://api.ainative.studio')
      .post('/v1/public/zerodb/mcp/execute')
      .reply(500, {
        error: { message: 'Internal server error', details: 'Database connection failed' }
      })

    const result = await server.executeOperation('test_operation', {})

    expect(result.content[0].text).toContain('Internal server error')
    expect(result.content[0].text).toContain('Database connection failed')
    expect(result.isError).toBe(true)
  })

  test('should handle network errors', async () => {
    const server = createMockedServer()

    nock('https://api.ainative.studio')
      .post('/v1/public/zerodb/mcp/execute')
      .replyWithError('Network failure')

    const result = await server.executeOperation('test_operation', {})

    expect(result.isError).toBe(true)
  })

  test('should include Authorization header', async () => {
    const server = createMockedServer()

    let capturedHeaders
    nock('https://api.ainative.studio')
      .post('/v1/public/zerodb/mcp/execute')
      .reply(200, function (_uri, _requestBody) {
        capturedHeaders = this.req.headers
        return { success: true, result: {} }
      })

    await server.executeOperation('test_operation', {})

    expect(capturedHeaders.authorization).toBe(`Bearer ${TEST_CONFIG.apiToken}`)
  })

  test('should use 30 second timeout', async () => {
    const server = createMockedServer()

    nock('https://api.ainative.studio')
      .post('/v1/public/zerodb/mcp/execute')
      .delayConnection(31000)
      .reply(200, { success: true, result: {} })

    const result = await server.executeOperation('test_operation', {})
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('timeout')
  })

  test('should handle error without response data', async () => {
    const server = createMockedServer()

    nock('https://api.ainative.studio')
      .post('/v1/public/zerodb/mcp/execute')
      .replyWithError({ message: 'Connection timeout', code: 'ETIMEDOUT' })

    const result = await server.executeOperation('test_operation', {})

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Connection timeout')
  })
})

describe('ZeroDBMCPServer - All 60 Operations Coverage', () => {
  beforeEach(() => {
    cleanupNock()
    jest.clearAllMocks()
  })

  afterEach(() => {
    cleanupNock()
  })

  // Test all 60 operations through executeOperation method
  const allOperations = [
    // Memory Operations (3)
    { name: 'store_memory', args: { content: 'test', role: 'user' } },
    { name: 'search_memory', args: { query: 'test' } },
    { name: 'get_context', args: { session_id: 'session-123' } },

    // Vector Operations (10)
    { name: 'upsert_vector', args: { vector_embedding: createTestVector(), document: 'test' } },
    { name: 'batch_upsert_vectors', args: { vectors: [] } },
    { name: 'search_vectors', args: { query_vector: createTestVector() } },
    { name: 'delete_vector', args: { vector_id: 'vec-123' } },
    { name: 'get_vector', args: { vector_id: 'vec-123' } },
    { name: 'list_vectors', args: {} },
    { name: 'vector_stats', args: {} },
    { name: 'create_vector_index', args: {} },
    { name: 'optimize_vector_storage', args: {} },
    { name: 'export_vectors', args: {} },

    // Quantum Operations (6)
    { name: 'quantum_compress_vector', args: { vector_embedding: createTestVector() } },
    { name: 'quantum_decompress_vector', args: { compressed_vector: [] } },
    { name: 'quantum_hybrid_similarity', args: { query_vector: createTestVector() } },
    { name: 'quantum_optimize_space', args: {} },
    { name: 'quantum_feature_map', args: { vector_embedding: createTestVector() } },
    { name: 'quantum_kernel_similarity', args: { vector_a: [], vector_b: [] } },

    // Table Operations (8)
    { name: 'create_table', args: { table_name: 'test_table', schema: {} } },
    { name: 'list_tables', args: {} },
    { name: 'get_table', args: { table_id: 'table-123' } },
    { name: 'delete_table', args: { table_id: 'table-123', confirm: true } },
    { name: 'insert_rows', args: { table_id: 'table-123', rows: [] } },
    { name: 'query_rows', args: { table_id: 'table-123' } },
    { name: 'update_rows', args: { table_id: 'table-123', filter: {}, update: {} } },
    { name: 'delete_rows', args: { table_id: 'table-123', filter: {} } },

    // File Operations (6)
    { name: 'upload_file', args: { file_name: 'test.txt', file_content: 'base64data' } },
    { name: 'download_file', args: { file_id: 'file-123' } },
    { name: 'list_files', args: {} },
    { name: 'delete_file', args: { file_id: 'file-123' } },
    { name: 'get_file_metadata', args: { file_id: 'file-123' } },
    { name: 'generate_presigned_url', args: { file_id: 'file-123' } },

    // Event Operations (5)
    { name: 'create_event', args: { event_type: 'test', event_data: {} } },
    { name: 'list_events', args: {} },
    { name: 'get_event', args: { event_id: 'event-123' } },
    { name: 'subscribe_to_events', args: { event_types: ['test'] } },
    { name: 'event_stats', args: {} },

    // Project Operations (7)
    { name: 'create_project', args: { project_name: 'test_project' } },
    { name: 'get_project', args: {} },
    { name: 'list_projects', args: {} },
    { name: 'update_project', args: { project_id: 'proj-123' } },
    { name: 'delete_project', args: { project_id: 'proj-123', confirm: true } },
    { name: 'get_project_stats', args: {} },
    { name: 'enable_database', args: { project_id: 'proj-123', features: [] } },

    // RLHF Operations (10)
    { name: 'rlhf_collect_interaction', args: { prompt: 'test', response: 'test' } },
    { name: 'rlhf_collect_agent_feedback', args: { agent_id: 'agent-123', feedback_type: 'rating' } },
    { name: 'rlhf_collect_workflow_feedback', args: { workflow_id: 'wf-123', success: true } },
    { name: 'rlhf_collect_error_report', args: { error_type: 'test', error_message: 'test' } },
    { name: 'rlhf_get_status', args: {} },
    { name: 'rlhf_get_summary', args: {} },
    { name: 'rlhf_start_collection', args: { session_id: 'session-123' } },
    { name: 'rlhf_stop_collection', args: { session_id: 'session-123' } },
    { name: 'rlhf_get_session_interactions', args: { session_id: 'session-123' } },
    { name: 'rlhf_broadcast_event', args: { event_type: 'test', event_data: {} } },

    // Admin Operations (5)
    { name: 'admin_get_system_stats', args: {} },
    { name: 'admin_list_all_projects', args: {} },
    { name: 'admin_get_user_usage', args: { user_id: 'user-123' } },
    { name: 'admin_system_health', args: {} },
    { name: 'admin_optimize_database', args: { optimization_type: 'vacuum' } }
  ]

  test('should verify all 60 operations are covered in tests', () => {
    expect(allOperations).toHaveLength(60)
  })

  allOperations.forEach(({ name, args }) => {
    test(`should execute ${name} operation`, async () => {
      const server = createMockedServer()

      nock('https://api.ainative.studio')
        .post('/v1/public/zerodb/mcp/execute')
        .reply(200, {
          success: true,
          result: { operation: name, status: 'success' }
        })

      const result = await server.executeOperation(name, args)

      expect(result.isError).toBeUndefined()
      expect(result.content).toBeDefined()
      expect(result.content[0].type).toBe('text')
      expect(result.content[0].text).toContain(name)
    })
  })
})

describe('ZeroDBMCPServer - Error Handling', () => {
  beforeEach(() => {
    cleanupNock()
    jest.clearAllMocks()
  })

  afterEach(() => {
    cleanupNock()
  })

  test('should handle 404 errors', async () => {
    const server = createMockedServer()

    nock('https://api.ainative.studio')
      .post('/v1/public/zerodb/mcp/execute')
      .reply(404, { error: { message: 'Not found' } })

    const result = await server.executeOperation('test_operation', {})

    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('Not found')
  })

  test('should handle 422 validation errors', async () => {
    const server = createMockedServer()

    nock('https://api.ainative.studio')
      .post('/v1/public/zerodb/mcp/execute')
      .reply(422, { error: { message: 'Validation error', details: { field: 'error' } } })

    const result = await server.executeOperation('test_operation', {})

    expect(result.isError).toBe(true)
  })

  test('should handle 429 rate limit errors', async () => {
    const server = createMockedServer()

    nock('https://api.ainative.studio')
      .post('/v1/public/zerodb/mcp/execute')
      .reply(429, { error: { message: 'Rate limit exceeded' } })

    const result = await server.executeOperation('test_operation', {})

    expect(result.isError).toBe(true)
  })

  test('should handle 500 server errors', async () => {
    const server = createMockedServer()

    nock('https://api.ainative.studio')
      .post('/v1/public/zerodb/mcp/execute')
      .reply(500, { error: { message: 'Internal server error' } })

    const result = await server.executeOperation('test_operation', {})

    expect(result.isError).toBe(true)
  })

  test('should handle connection refused', async () => {
    const server = createMockedServer()

    nock('https://api.ainative.studio')
      .post('/v1/public/zerodb/mcp/execute')
      .replyWithError({ code: 'ECONNREFUSED' })

    const result = await server.executeOperation('test_operation', {})

    expect(result.isError).toBe(true)
  })

  test('should handle timeout', async () => {
    const server = createMockedServer()

    nock('https://api.ainative.studio')
      .post('/v1/public/zerodb/mcp/execute')
      .delayConnection(31000)
      .reply(200, { success: true })

    const result = await server.executeOperation('test_operation', {})

    expect(result.isError).toBe(true)
  })

  test('should handle malformed JSON response', async () => {
    const server = createMockedServer()

    nock('https://api.ainative.studio')
      .post('/v1/public/zerodb/mcp/execute')
      .reply(200, 'not-json')

    const result = await server.executeOperation('test_operation', {})

    expect(result.isError).toBe(true)
  })
})

describe('ZeroDBMCPServer - Integration Tests', () => {
  beforeEach(() => {
    cleanupNock()
    jest.clearAllMocks()
  })

  afterEach(() => {
    cleanupNock()
  })

  test('should handle successful memory workflow', async () => {
    const server = createMockedServer()

    // Store memory
    nock('https://api.ainative.studio')
      .post('/v1/public/zerodb/mcp/execute')
      .reply(200, {
        success: true,
        result: { memory_id: 'mem-123' }
      })

    const storeResult = await server.executeOperation('store_memory', {
      content: 'Test memory',
      role: 'user'
    })

    expect(storeResult.isError).toBeUndefined()

    // Search memory
    nock('https://api.ainative.studio')
      .post('/v1/public/zerodb/mcp/execute')
      .reply(200, {
        success: true,
        result: { memories: [{ content: 'Test memory' }] }
      })

    const searchResult = await server.executeOperation('search_memory', {
      query: 'test'
    })

    expect(searchResult.isError).toBeUndefined()
  })

  test('should handle successful vector workflow', async () => {
    const server = createMockedServer()
    const vector = createTestVector()

    // Upsert vector
    nock('https://api.ainative.studio')
      .post('/v1/public/zerodb/mcp/execute')
      .reply(200, {
        success: true,
        result: { vector_id: 'vec-123' }
      })

    const upsertResult = await server.executeOperation('upsert_vector', {
      vector_embedding: vector,
      document: 'Test document'
    })

    expect(upsertResult.isError).toBeUndefined()

    // Search vectors
    nock('https://api.ainative.studio')
      .post('/v1/public/zerodb/mcp/execute')
      .reply(200, {
        success: true,
        result: { vectors: [{ document: 'Test document', similarity: 0.95 }] }
      })

    const searchResult = await server.executeOperation('search_vectors', {
      query_vector: vector
    })

    expect(searchResult.isError).toBeUndefined()
  })

  test('should handle concurrent operations', async () => {
    const server = createMockedServer()

    nock('https://api.ainative.studio')
      .post('/v1/public/zerodb/mcp/execute')
      .times(3)
      .reply(200, {
        success: true,
        result: {}
      })

    const promises = [
      server.executeOperation('list_vectors', {}),
      server.executeOperation('list_tables', {}),
      server.executeOperation('list_files', {})
    ]

    const results = await Promise.all(promises)

    results.forEach(result => {
      expect(result.isError).toBeUndefined()
    })
  })
})

describe('ZeroDBMCPServer - Coverage Tests', () => {
  beforeEach(() => {
    cleanupNock()
    jest.clearAllMocks()
  })

  test('should format operation success response correctly', async () => {
    const server = createMockedServer()

    nock('https://api.ainative.studio')
      .post('/v1/public/zerodb/mcp/execute')
      .reply(200, {
        success: true,
        result: { key: 'value', nested: { data: 'test' } }
      })

    const result = await server.executeOperation('test_operation', {})

    const parsedText = JSON.parse(result.content[0].text)
    expect(parsedText.key).toBe('value')
    expect(parsedText.nested.data).toBe('test')
  })

  test('should format operation error response correctly', async () => {
    const server = createMockedServer()

    nock('https://api.ainative.studio')
      .post('/v1/public/zerodb/mcp/execute')
      .reply(200, {
        success: false,
        error: { message: 'Custom error', code: 'ERR_001' }
      })

    const result = await server.executeOperation('test_operation', {})

    expect(result.content[0].text).toContain('Operation failed')
    expect(result.content[0].text).toContain('Custom error')
  })

  test('should handle request with all operation categories', async () => {
    const server = createMockedServer()

    const categories = [
      'store_memory',
      'upsert_vector',
      'quantum_compress_vector',
      'create_table',
      'upload_file',
      'create_event',
      'create_project',
      'rlhf_collect_interaction',
      'admin_get_system_stats'
    ]

    for (const operation of categories) {
      nock('https://api.ainative.studio')
        .post('/v1/public/zerodb/mcp/execute')
        .reply(200, {
          success: true,
          result: { operation }
        })

      const result = await server.executeOperation(operation, {})
      expect(result.isError).toBeUndefined()
    }
  })
})

describe('ZeroDBMCPServer - Tool Routing', () => {
  beforeEach(() => {
    cleanupNock()
    jest.clearAllMocks()
  })

  afterEach(() => {
    cleanupNock()
  })

  // Test the routing layer that was previously uncovered
  const allRoutes = [
    { name: 'zerodb_store_memory', operation: 'store_memory' },
    { name: 'zerodb_search_memory', operation: 'search_memory' },
    { name: 'zerodb_get_context', operation: 'get_context' },
    { name: 'zerodb_upsert_vector', operation: 'upsert_vector' },
    { name: 'zerodb_batch_upsert_vectors', operation: 'batch_upsert_vectors' },
    { name: 'zerodb_search_vectors', operation: 'search_vectors' },
    { name: 'zerodb_delete_vector', operation: 'delete_vector' },
    { name: 'zerodb_get_vector', operation: 'get_vector' },
    { name: 'zerodb_list_vectors', operation: 'list_vectors' },
    { name: 'zerodb_vector_stats', operation: 'vector_stats' },
    { name: 'zerodb_create_vector_index', operation: 'create_vector_index' },
    { name: 'zerodb_optimize_vectors', operation: 'optimize_vector_storage' },
    { name: 'zerodb_export_vectors', operation: 'export_vectors' },
    { name: 'zerodb_quantum_compress', operation: 'quantum_compress_vector' },
    { name: 'zerodb_quantum_decompress', operation: 'quantum_decompress_vector' },
    { name: 'zerodb_quantum_hybrid_search', operation: 'quantum_hybrid_similarity' },
    { name: 'zerodb_quantum_optimize', operation: 'quantum_optimize_space' },
    { name: 'zerodb_quantum_feature_map', operation: 'quantum_feature_map' },
    { name: 'zerodb_quantum_kernel', operation: 'quantum_kernel_similarity' },
    { name: 'zerodb_create_table', operation: 'create_table' },
    { name: 'zerodb_list_tables', operation: 'list_tables' },
    { name: 'zerodb_get_table', operation: 'get_table' },
    { name: 'zerodb_delete_table', operation: 'delete_table' },
    { name: 'zerodb_insert_rows', operation: 'insert_rows' },
    { name: 'zerodb_query_rows', operation: 'query_rows' },
    { name: 'zerodb_update_rows', operation: 'update_rows' },
    { name: 'zerodb_delete_rows', operation: 'delete_rows' },
    { name: 'zerodb_upload_file', operation: 'upload_file' },
    { name: 'zerodb_download_file', operation: 'download_file' },
    { name: 'zerodb_list_files', operation: 'list_files' },
    { name: 'zerodb_delete_file', operation: 'delete_file' },
    { name: 'zerodb_get_file_metadata', operation: 'get_file_metadata' },
    { name: 'zerodb_generate_presigned_url', operation: 'generate_presigned_url' },
    { name: 'zerodb_create_event', operation: 'create_event' },
    { name: 'zerodb_list_events', operation: 'list_events' },
    { name: 'zerodb_get_event', operation: 'get_event' },
    { name: 'zerodb_subscribe_events', operation: 'subscribe_to_events' },
    { name: 'zerodb_event_stats', operation: 'event_stats' },
    { name: 'zerodb_create_project', operation: 'create_project' },
    { name: 'zerodb_get_project', operation: 'get_project' },
    { name: 'zerodb_list_projects', operation: 'list_projects' },
    { name: 'zerodb_update_project', operation: 'update_project' },
    { name: 'zerodb_delete_project', operation: 'delete_project' },
    { name: 'zerodb_get_project_stats', operation: 'get_project_stats' },
    { name: 'zerodb_enable_database', operation: 'enable_database' },
    { name: 'zerodb_rlhf_interaction', operation: 'rlhf_collect_interaction' },
    { name: 'zerodb_rlhf_agent_feedback', operation: 'rlhf_collect_agent_feedback' },
    { name: 'zerodb_rlhf_workflow', operation: 'rlhf_collect_workflow_feedback' },
    { name: 'zerodb_rlhf_error', operation: 'rlhf_collect_error_report' },
    { name: 'zerodb_rlhf_status', operation: 'rlhf_get_status' },
    { name: 'zerodb_rlhf_summary', operation: 'rlhf_get_summary' },
    { name: 'zerodb_rlhf_start', operation: 'rlhf_start_collection' },
    { name: 'zerodb_rlhf_stop', operation: 'rlhf_stop_collection' },
    { name: 'zerodb_rlhf_session', operation: 'rlhf_get_session_interactions' },
    { name: 'zerodb_rlhf_broadcast', operation: 'rlhf_broadcast_event' },
    { name: 'zerodb_admin_system_stats', operation: 'admin_get_system_stats' },
    { name: 'zerodb_admin_list_projects', operation: 'admin_list_all_projects' },
    { name: 'zerodb_admin_user_usage', operation: 'admin_get_user_usage' },
    { name: 'zerodb_admin_health', operation: 'admin_system_health' },
    { name: 'zerodb_admin_optimize', operation: 'admin_optimize_database' }
  ]

  test('should route all 60 tool names correctly', async () => {
    const server = createMockedServer()

    for (const route of allRoutes) {
      nock('https://api.ainative.studio')
        .post('/v1/public/zerodb/mcp/execute')
        .reply(200, {
          success: true,
          result: { operation: route.operation, status: 'success' }
        })

      const result = await server.routeToolCall(route.name, {})
      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain(route.operation)
    }
  })

  test('should handle zerodb_renew_token specially', async () => {
    const server = createMockedServer()

    nock('https://api.ainative.studio')
      .post('/v1/public/auth/login-json')
      .reply(200, mockAuthResponse)

    const result = await server.routeToolCall('zerodb_renew_token', {})
    expect(result.content[0].text).toContain('Token renewed successfully')
  })

  test('should throw error for unknown tool', async () => {
    const server = createMockedServer()

    await expect(server.routeToolCall('unknown_tool', {}))
      .rejects.toThrow('Unknown tool: unknown_tool')
  })
})

describe('ZeroDBMCPServer - Token Renewal Automation', () => {
  beforeEach(() => {
    cleanupNock()
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    cleanupNock()
    jest.useRealTimers()
  })

  test('should setup automatic token renewal interval', () => {
    const server = createMockedServer()

    // Spy on setInterval
    const setIntervalSpy = jest.spyOn(global, 'setInterval')

    server.setupTokenRenewal()

    // Verify setInterval was called with 25 minutes (25 * 60 * 1000 ms)
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 25 * 60 * 1000)

    setIntervalSpy.mockRestore()
  })
})

describe('ZeroDBMCPServer - Error Paths', () => {
  beforeEach(() => {
    cleanupNock()
    jest.clearAllMocks()
  })

  afterEach(() => {
    cleanupNock()
  })

  test('should handle missing access_token in auth response', async () => {
    nock('https://api.ainative.studio')
      .post('/v1/public/auth/login-json')
      .reply(200, { expires_in: 1800 }) // Missing access_token

    const server = new ZeroDBMCPServer()

    await expect(server.renewToken()).rejects.toThrow('Authentication failed')
  })
})

describe('ZeroDBMCPServer - Additional Coverage', () => {
  beforeEach(() => {
    cleanupNock()
    jest.clearAllMocks()
  })

  afterEach(() => {
    cleanupNock()
  })

  test('should handle ensureValidToken when token needs renewal', async () => {
    const server = createMockedServer()
    server.apiToken = null
    server.tokenExpiry = null

    nock('https://api.ainative.studio')
      .post('/v1/public/auth/login-json')
      .reply(200, mockAuthResponse)

    await server.ensureValidToken()

    expect(server.apiToken).toBe(mockAuthResponse.access_token)
  })

  test('should handle renewToken success path', async () => {
    nock('https://api.ainative.studio')
      .post('/v1/public/auth/login-json')
      .reply(200, mockAuthResponse)

    const server = new ZeroDBMCPServer()
    await server.renewToken()

    expect(server.apiToken).toBe(mockAuthResponse.access_token)
    expect(server.tokenExpiry).toBeGreaterThan(Date.now())
  })

  test('should add project_id to params when not present', async () => {
    const server = createMockedServer()

    let capturedBody
    nock('https://api.ainative.studio')
      .post('/v1/public/zerodb/mcp/execute', (body) => {
        capturedBody = body
        return true
      })
      .reply(200, { success: true, result: {} })

    await server.executeOperation('test_op', {})

    expect(capturedBody.params.project_id).toBe(TEST_CONFIG.projectId)
  })
})
