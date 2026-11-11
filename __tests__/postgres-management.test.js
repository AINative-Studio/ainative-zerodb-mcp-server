const nock = require('nock')
const ZeroDBMCPServer = require('../index')

// Mock console.error to reduce noise in tests (matches __tests__/index.test.js convention)
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
  server.tokenExpiry = Date.now() + 30 * 60 * 1000 // 30 minutes from now

  return server
}

const cleanupNock = () => {
  nock.cleanAll()
  nock.enableNetConnect()
}

describe('ZeroDBMCPServer - Dedicated PostgreSQL Management', () => {
  beforeEach(() => {
    cleanupNock()
    jest.clearAllMocks()
  })

  afterEach(() => {
    cleanupNock()
  })

  describe('provisionPostgres', () => {
    test('provisions a PostgreSQL instance and returns the backend response', async () => {
      const server = createMockedServer()

      nock(TEST_CONFIG.apiUrl)
        .post('/v1/projects/test-project-123/postgres', {
          instance_size: 'standard-2',
          postgres_version: '15',
          tags: ['prod']
        })
        .reply(201, {
          id: 'pg-instance-1',
          status: 'provisioning',
          instance_size: 'standard-2'
        })

      const result = await server.provisionPostgres({
        project_id: 'test-project-123',
        instance_size: 'standard-2',
        tags: ['prod']
      })

      expect(result.isError).toBeUndefined()
      expect(result.content[0].type).toBe('text')
      const body = JSON.parse(result.content[0].text)
      expect(body.id).toBe('pg-instance-1')
      expect(body.status).toBe('provisioning')
    })

    test('defaults postgres_version to 15 and tags to [] when omitted', async () => {
      const server = createMockedServer()

      nock(TEST_CONFIG.apiUrl)
        .post('/v1/projects/test-project-123/postgres', {
          instance_size: 'micro-1',
          postgres_version: '15',
          tags: []
        })
        .reply(201, { id: 'pg-instance-2', status: 'provisioning' })

      const result = await server.provisionPostgres({
        project_id: 'test-project-123',
        instance_size: 'micro-1'
      })

      expect(result.isError).toBeUndefined()
      expect(JSON.parse(result.content[0].text).id).toBe('pg-instance-2')
    })

    test('returns VALIDATION_ERROR when project_id is missing', async () => {
      const server = createMockedServer()

      const result = await server.provisionPostgres({ instance_size: 'micro-1' })

      expect(result.isError).toBe(true)
      expect(result.content[0]._meta.code).toBe('VALIDATION_ERROR')
      expect(result.structuredContent.code).toBe('VALIDATION_ERROR')
      expect(result.content[0].text).toContain('project_id is required')
    })

    test('returns INVALID_ARGS when the backend rejects the request with a 4xx', async () => {
      const server = createMockedServer()

      nock(TEST_CONFIG.apiUrl)
        .post('/v1/projects/test-project-123/postgres')
        .reply(400, { detail: 'instance_size is not a valid tier' })

      const result = await server.provisionPostgres({
        project_id: 'test-project-123',
        instance_size: 'not-a-real-tier'
      })

      expect(result.isError).toBe(true)
      expect(result.content[0]._meta.code).toBe('INVALID_ARGS')
      expect(result.content[0].text).toContain('instance_size is not a valid tier')
    })

    test('returns UPSTREAM_ERROR when the backend 500s', async () => {
      const server = createMockedServer()

      nock(TEST_CONFIG.apiUrl)
        .post('/v1/projects/test-project-123/postgres')
        .reply(500, { detail: 'provisioning service unavailable' })

      const result = await server.provisionPostgres({
        project_id: 'test-project-123',
        instance_size: 'micro-1'
      })

      expect(result.isError).toBe(true)
      expect(result.content[0]._meta.code).toBe('UPSTREAM_ERROR')
      expect(result.content[0].text).toContain('provisioning service unavailable')
    })
  })

  describe('getPostgresStatus', () => {
    test('returns the instance status from the backend', async () => {
      const server = createMockedServer()

      nock(TEST_CONFIG.apiUrl)
        .get('/v1/projects/test-project-123/postgres')
        .reply(200, { status: 'running', uptime_seconds: 86400 })

      const result = await server.getPostgresStatus({ project_id: 'test-project-123' })

      expect(result.isError).toBeUndefined()
      const body = JSON.parse(result.content[0].text)
      expect(body.status).toBe('running')
    })

    test('returns VALIDATION_ERROR when project_id is missing', async () => {
      const server = createMockedServer()

      const result = await server.getPostgresStatus({})

      expect(result.isError).toBe(true)
      expect(result.content[0]._meta.code).toBe('VALIDATION_ERROR')
      expect(result.content[0].text).toContain('project_id is required')
    })

    test('returns UPSTREAM_ERROR when the instance does not exist (404-class treated as INVALID_ARGS boundary)', async () => {
      const server = createMockedServer()

      nock(TEST_CONFIG.apiUrl)
        .get('/v1/projects/test-project-123/postgres')
        .reply(404, { detail: 'No PostgreSQL instance provisioned for this project' })

      const result = await server.getPostgresStatus({ project_id: 'test-project-123' })

      expect(result.isError).toBe(true)
      expect(result.content[0]._meta.code).toBe('INVALID_ARGS')
      expect(result.content[0].text).toContain('No PostgreSQL instance provisioned')
    })
  })

  describe('getPostgresConnection', () => {
    test('returns connection credentials, defaulting credential_type to primary', async () => {
      const server = createMockedServer()

      nock(TEST_CONFIG.apiUrl)
        .get('/v1/projects/test-project-123/postgres/connection')
        .query({ credential_type: 'primary' })
        .reply(200, {
          database_url: 'postgres://user:pass@host:5432/db',
          host: 'host',
          port: 5432
        })

      const result = await server.getPostgresConnection({ project_id: 'test-project-123' })

      expect(result.isError).toBeUndefined()
      const body = JSON.parse(result.content[0].text)
      expect(body.host).toBe('host')
    })

    test('passes through an explicit credential_type', async () => {
      const server = createMockedServer()

      nock(TEST_CONFIG.apiUrl)
        .get('/v1/projects/test-project-123/postgres/connection')
        .query({ credential_type: 'readonly' })
        .reply(200, { database_url: 'postgres://readonly@host:5432/db' })

      const result = await server.getPostgresConnection({
        project_id: 'test-project-123',
        credential_type: 'readonly'
      })

      expect(result.isError).toBeUndefined()
      expect(JSON.parse(result.content[0].text).database_url).toContain('readonly')
    })

    test('returns VALIDATION_ERROR when project_id is missing', async () => {
      const server = createMockedServer()

      const result = await server.getPostgresConnection({ credential_type: 'admin' })

      expect(result.isError).toBe(true)
      expect(result.content[0]._meta.code).toBe('VALIDATION_ERROR')
      expect(result.content[0].text).toContain('project_id is required')
    })

    test('returns UPSTREAM_ERROR when the backend fails', async () => {
      const server = createMockedServer()

      nock(TEST_CONFIG.apiUrl)
        .get('/v1/projects/test-project-123/postgres/connection')
        .query(true)
        .reply(503, { detail: 'connection service down' })

      const result = await server.getPostgresConnection({ project_id: 'test-project-123' })

      expect(result.isError).toBe(true)
      expect(result.content[0]._meta.code).toBe('UPSTREAM_ERROR')
    })
  })

  describe('getPostgresUsage', () => {
    test('returns usage stats, defaulting hours to 24', async () => {
      const server = createMockedServer()

      nock(TEST_CONFIG.apiUrl)
        .get('/v1/projects/test-project-123/postgres/usage')
        .query({ hours: '24' })
        .reply(200, { compute_hours: 12.5, storage_gb: 2.3, cost_usd: 1.25 })

      const result = await server.getPostgresUsage({ project_id: 'test-project-123' })

      expect(result.isError).toBeUndefined()
      const body = JSON.parse(result.content[0].text)
      expect(body.cost_usd).toBe(1.25)
    })

    test('passes through an explicit hours window', async () => {
      const server = createMockedServer()

      nock(TEST_CONFIG.apiUrl)
        .get('/v1/projects/test-project-123/postgres/usage')
        .query({ hours: '168' })
        .reply(200, { compute_hours: 100, storage_gb: 2.3 })

      const result = await server.getPostgresUsage({ project_id: 'test-project-123', hours: 168 })

      expect(result.isError).toBeUndefined()
      expect(JSON.parse(result.content[0].text).compute_hours).toBe(100)
    })

    test('returns VALIDATION_ERROR when project_id is missing', async () => {
      const server = createMockedServer()

      const result = await server.getPostgresUsage({ hours: 24 })

      expect(result.isError).toBe(true)
      expect(result.content[0]._meta.code).toBe('VALIDATION_ERROR')
      expect(result.content[0].text).toContain('project_id is required')
    })

    test('returns UPSTREAM_ERROR when the backend fails', async () => {
      const server = createMockedServer()

      nock(TEST_CONFIG.apiUrl)
        .get('/v1/projects/test-project-123/postgres/usage')
        .query(true)
        .reply(502, { detail: 'usage metrics unavailable' })

      const result = await server.getPostgresUsage({ project_id: 'test-project-123' })

      expect(result.isError).toBe(true)
      expect(result.content[0]._meta.code).toBe('UPSTREAM_ERROR')
      expect(result.content[0].text).toContain('usage metrics unavailable')
    })
  })

  describe('getPostgresLogs', () => {
    test('returns query logs, defaulting limit to 100 with no query_type filter', async () => {
      const server = createMockedServer()

      nock(TEST_CONFIG.apiUrl)
        .get('/v1/projects/test-project-123/postgres/logs')
        .query({ limit: '100' })
        .reply(200, { logs: [{ query: 'SELECT 1', duration_ms: 2 }] })

      const result = await server.getPostgresLogs({ project_id: 'test-project-123' })

      expect(result.isError).toBeUndefined()
      const body = JSON.parse(result.content[0].text)
      expect(body.logs).toHaveLength(1)
    })

    test('passes through an explicit limit and query_type filter', async () => {
      const server = createMockedServer()

      nock(TEST_CONFIG.apiUrl)
        .get('/v1/projects/test-project-123/postgres/logs')
        .query({ limit: '10', query_type: 'SELECT' })
        .reply(200, { logs: [] })

      const result = await server.getPostgresLogs({
        project_id: 'test-project-123',
        limit: 10,
        query_type: 'SELECT'
      })

      expect(result.isError).toBeUndefined()
      expect(JSON.parse(result.content[0].text).logs).toEqual([])
    })

    test('returns VALIDATION_ERROR when project_id is missing', async () => {
      const server = createMockedServer()

      const result = await server.getPostgresLogs({ limit: 50 })

      expect(result.isError).toBe(true)
      expect(result.content[0]._meta.code).toBe('VALIDATION_ERROR')
      expect(result.content[0].text).toContain('project_id is required')
    })

    test('returns UPSTREAM_ERROR when the backend fails', async () => {
      const server = createMockedServer()

      nock(TEST_CONFIG.apiUrl)
        .get('/v1/projects/test-project-123/postgres/logs')
        .query(true)
        .reply(500, { detail: 'log storage unreachable' })

      const result = await server.getPostgresLogs({ project_id: 'test-project-123' })

      expect(result.isError).toBe(true)
      expect(result.content[0]._meta.code).toBe('UPSTREAM_ERROR')
    })
  })

  describe('restartPostgres', () => {
    test('restarts the instance and returns the backend response', async () => {
      const server = createMockedServer()

      nock(TEST_CONFIG.apiUrl)
        .post('/v1/projects/test-project-123/postgres/restart', {})
        .reply(200, { status: 'restarting' })

      const result = await server.restartPostgres({ project_id: 'test-project-123' })

      expect(result.isError).toBeUndefined()
      expect(JSON.parse(result.content[0].text).status).toBe('restarting')
    })

    test('returns VALIDATION_ERROR when project_id is missing', async () => {
      const server = createMockedServer()

      const result = await server.restartPostgres({})

      expect(result.isError).toBe(true)
      expect(result.content[0]._meta.code).toBe('VALIDATION_ERROR')
      expect(result.content[0].text).toContain('project_id is required')
    })

    test('returns UPSTREAM_ERROR when the restart fails upstream', async () => {
      const server = createMockedServer()

      nock(TEST_CONFIG.apiUrl)
        .post('/v1/projects/test-project-123/postgres/restart')
        .reply(500, { detail: 'restart failed: instance busy' })

      const result = await server.restartPostgres({ project_id: 'test-project-123' })

      expect(result.isError).toBe(true)
      expect(result.content[0]._meta.code).toBe('UPSTREAM_ERROR')
      expect(result.content[0].text).toContain('restart failed: instance busy')
    })
  })

  describe('deletePostgres', () => {
    test('deletes the instance when confirm is true', async () => {
      const server = createMockedServer()

      nock(TEST_CONFIG.apiUrl)
        .delete('/v1/projects/test-project-123/postgres')
        .reply(200, { status: 'deleted' })

      const result = await server.deletePostgres({ project_id: 'test-project-123', confirm: true })

      expect(result.isError).toBeUndefined()
      expect(JSON.parse(result.content[0].text).status).toBe('deleted')
    })

    test('returns VALIDATION_ERROR when project_id is missing', async () => {
      const server = createMockedServer()

      const result = await server.deletePostgres({ confirm: true })

      expect(result.isError).toBe(true)
      expect(result.content[0]._meta.code).toBe('VALIDATION_ERROR')
      expect(result.content[0].text).toContain('project_id is required')
    })

    test('returns VALIDATION_ERROR when confirm is not true (refuses to delete without explicit confirmation)', async () => {
      const server = createMockedServer()

      const result = await server.deletePostgres({ project_id: 'test-project-123' })

      expect(result.isError).toBe(true)
      expect(result.content[0]._meta.code).toBe('VALIDATION_ERROR')
      expect(result.content[0].text).toContain('confirm must be true')
    })

    test('returns UPSTREAM_ERROR when the backend deletion fails', async () => {
      const server = createMockedServer()

      nock(TEST_CONFIG.apiUrl)
        .delete('/v1/projects/test-project-123/postgres')
        .reply(500, { detail: 'deletion failed: backup in progress' })

      const result = await server.deletePostgres({ project_id: 'test-project-123', confirm: true })

      expect(result.isError).toBe(true)
      expect(result.content[0]._meta.code).toBe('UPSTREAM_ERROR')
      expect(result.content[0].text).toContain('deletion failed: backup in progress')
    })
  })

  describe('routing: dedicated PostgreSQL tools dispatch to the right methods', () => {
    const routes = [
      { name: 'zerodb_provision_postgres', args: { project_id: 'test-project-123', instance_size: 'micro-1' }, method: 'post', path: '/v1/projects/test-project-123/postgres' },
      { name: 'zerodb_get_postgres_status', args: { project_id: 'test-project-123' }, method: 'get', path: '/v1/projects/test-project-123/postgres' },
      { name: 'zerodb_get_postgres_connection', args: { project_id: 'test-project-123' }, method: 'get', path: '/v1/projects/test-project-123/postgres/connection' },
      { name: 'zerodb_get_postgres_usage', args: { project_id: 'test-project-123' }, method: 'get', path: '/v1/projects/test-project-123/postgres/usage' },
      { name: 'zerodb_get_postgres_logs', args: { project_id: 'test-project-123' }, method: 'get', path: '/v1/projects/test-project-123/postgres/logs' },
      { name: 'zerodb_restart_postgres', args: { project_id: 'test-project-123' }, method: 'post', path: '/v1/projects/test-project-123/postgres/restart' },
      { name: 'zerodb_delete_postgres', args: { project_id: 'test-project-123', confirm: true }, method: 'delete', path: '/v1/projects/test-project-123/postgres' }
    ]

    routes.forEach(({ name, args, method, path }) => {
      test(`${name} routes through routeToolCall to the dedicated Postgres method`, async () => {
        const server = createMockedServer()

        // Each dedicated-postgres method hits its own distinct path/verb;
        // this test exercises the routing switch (that routeToolCall
        // dispatches to the right method), with the exact request/response
        // shape of each method already covered above.
        const scope = nock(TEST_CONFIG.apiUrl)
        scope[method](path).query(true).reply(200, { ok: true })

        const result = await server.routeToolCall(name, args)

        expect(result.isError).toBeUndefined()
        expect(result.content[0].type).toBe('text')
      })
    })
  })

  describe('generic PostgreSQL operations (zerodb_postgres_*) route through executeOperation', () => {
    const genericPostgresRoutes = [
      { name: 'zerodb_postgres_query', operation: 'postgres_query' },
      { name: 'zerodb_postgres_schema_info', operation: 'postgres_schema_info' },
      { name: 'zerodb_postgres_create_table', operation: 'postgres_create_table' },
      { name: 'zerodb_postgres_backup', operation: 'postgres_backup' },
      { name: 'zerodb_postgres_restore', operation: 'postgres_restore' },
      { name: 'zerodb_postgres_stats', operation: 'postgres_stats' }
    ]

    genericPostgresRoutes.forEach(({ name, operation }) => {
      test(`${name} routes to executeOperation('${operation}', ...)`, async () => {
        const server = createMockedServer()

        nock(TEST_CONFIG.apiUrl)
          .post('/v1/public/mcp')
          .reply(200, { success: true, result: { operation, status: 'success' } })

        const result = await server.routeToolCall(name, {})

        expect(result.isError).toBeUndefined()
        expect(result.content[0].text).toContain(operation)
      })
    })
  })
})

describe('ZeroDBMCPServer - start()', () => {
  beforeEach(() => {
    cleanupNock()
    jest.clearAllMocks()
  })

  afterEach(() => {
    cleanupNock()
  })

  test('acquires a token when none is set, connects the stdio transport, and logs startup info', async () => {
    process.env.ZERODB_API_URL = TEST_CONFIG.apiUrl
    process.env.ZERODB_PROJECT_ID = TEST_CONFIG.projectId
    process.env.ZERODB_USERNAME = TEST_CONFIG.username
    process.env.ZERODB_PASSWORD = TEST_CONFIG.password

    const server = new ZeroDBMCPServer()
    // No apiToken set yet — start() must call renewToken() itself.
    expect(server.apiToken).toBeFalsy()

    nock(TEST_CONFIG.apiUrl)
      .post('/v1/auth/login')
      .reply(200, {
        access_token: 'fresh-token-from-start',
        expires_in: 1800,
        token_type: 'bearer'
      })

    // Avoid actually wiring up stdio for the MCP SDK transport in a test
    // process — stub server.connect (what start() calls on the real
    // transport) the same way a real stdio transport's connect() would
    // resolve once the handshake completes.
    const connectSpy = jest.spyOn(server.server, 'connect').mockResolvedValue(undefined)

    await server.start()

    expect(server.apiToken).toBe('fresh-token-from-start')
    expect(connectSpy).toHaveBeenCalledTimes(1)
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('running on stdio'))

    connectSpy.mockRestore()
  })

  test('skips token acquisition when a token is already set, and still connects', async () => {
    const server = createMockedServer()
    const renewSpy = jest.spyOn(server, 'renewToken')
    const connectSpy = jest.spyOn(server.server, 'connect').mockResolvedValue(undefined)

    await server.start()

    expect(renewSpy).not.toHaveBeenCalled()
    expect(connectSpy).toHaveBeenCalledTimes(1)

    renewSpy.mockRestore()
    connectSpy.mockRestore()
  })

  test('logs the API-key auth message when using a static token', async () => {
    delete process.env.ZERODB_USERNAME
    delete process.env.ZERODB_PASSWORD
    process.env.ZERODB_API_URL = TEST_CONFIG.apiUrl
    process.env.ZERODB_PROJECT_ID = TEST_CONFIG.projectId
    process.env.ZERODB_API_KEY = 'static-api-key-xyz'

    const server = new ZeroDBMCPServer()
    expect(server.useStaticToken).toBe(true)

    const connectSpy = jest.spyOn(server.server, 'connect').mockResolvedValue(undefined)

    await server.start()

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Auth: API key'))

    connectSpy.mockRestore()
    delete process.env.ZERODB_API_KEY
  })

  test('exits the process when the transport fails to connect', async () => {
    const server = createMockedServer()
    const connectError = new Error('stdio transport failed to attach')
    const connectSpy = jest.spyOn(server.server, 'connect').mockRejectedValue(connectError)
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {})

    await server.start()

    expect(console.error).toHaveBeenCalledWith(
      'Failed to start ZeroDB MCP Server:',
      'stdio transport failed to attach'
    )
    expect(exitSpy).toHaveBeenCalledWith(1)

    connectSpy.mockRestore()
    exitSpy.mockRestore()
  })
})

describe('ZeroDBMCPServer - scheduled token renewal actually firing', () => {
  beforeEach(() => {
    cleanupNock()
    jest.clearAllMocks()
  })

  afterEach(() => {
    cleanupNock()
  })

  // setupTokenRenewal()'s own interval is a real 25-minute setInterval, which
  // is impractical to wait out for real. Instead we capture the exact
  // callback setupTokenRenewal registers (via a setInterval spy) and invoke
  // it directly, clearing the real interval immediately afterward so it
  // never actually fires again and leaks across tests.
  test('the registered interval callback renews the token successfully', async () => {
    const server = createMockedServer()

    let capturedCallback
    const setIntervalSpy = jest.spyOn(global, 'setInterval').mockImplementation((fn) => {
      capturedCallback = fn
      return 12345 // fake timer handle; never actually scheduled
    })

    server.setupTokenRenewal()
    setIntervalSpy.mockRestore()

    expect(typeof capturedCallback).toBe('function')

    nock(TEST_CONFIG.apiUrl)
      .post('/v1/auth/login')
      .reply(200, {
        access_token: 'renewed-via-interval',
        expires_in: 1800,
        token_type: 'bearer'
      })

    await capturedCallback()

    expect(server.apiToken).toBe('renewed-via-interval')
  })

  test('the registered interval callback logs and swallows a renewal failure instead of crashing', async () => {
    const server = createMockedServer()

    let capturedCallback
    const setIntervalSpy = jest.spyOn(global, 'setInterval').mockImplementation((fn) => {
      capturedCallback = fn
      return 12345
    })

    server.setupTokenRenewal()
    setIntervalSpy.mockRestore()

    nock(TEST_CONFIG.apiUrl)
      .post('/v1/auth/login')
      .reply(500, { detail: 'auth service unavailable' })

    await expect(capturedCallback()).resolves.not.toThrow()

    expect(console.error).toHaveBeenCalledWith(
      'Automatic token renewal failed:',
      expect.any(String)
    )
  })
})

describe('ZeroDBMCPServer - ensureValidToken with a static API key', () => {
  beforeEach(() => {
    cleanupNock()
    jest.clearAllMocks()
  })

  afterEach(() => {
    cleanupNock()
  })

  test('returns immediately without renewing when useStaticToken and apiToken are both set', async () => {
    delete process.env.ZERODB_USERNAME
    delete process.env.ZERODB_PASSWORD
    process.env.ZERODB_API_URL = TEST_CONFIG.apiUrl
    process.env.ZERODB_PROJECT_ID = TEST_CONFIG.projectId
    process.env.ZERODB_API_KEY = 'static-api-key-for-ensure-valid'

    const server = new ZeroDBMCPServer()
    expect(server.useStaticToken).toBe(true)
    expect(server.apiToken).toBe('static-api-key-for-ensure-valid')

    const renewSpy = jest.spyOn(server, 'renewToken')

    await server.ensureValidToken()

    expect(renewSpy).not.toHaveBeenCalled()

    renewSpy.mockRestore()
    delete process.env.ZERODB_API_KEY
  })
})

describe('ZeroDBMCPServer - setupHandlers top-level catch (non-McpError path)', () => {
  beforeEach(() => {
    cleanupNock()
    jest.clearAllMocks()
  })

  afterEach(() => {
    cleanupNock()
  })

  const invokeCallToolHandler = async (server, name, args) => {
    const handler = server.server._requestHandlers.get('tools/call')
    const request = { method: 'tools/call', params: { name, arguments: args } }
    return handler(request, {})
  }

  test('a non-McpError thrown before routing (e.g. ensureValidToken failing) is caught and returned as EXECUTION_ERROR, not a crash', async () => {
    const server = createMockedServer()

    // Force the token to look expired so setupHandlers' ensureValidToken()
    // call attempts a real renewal, and make that renewal fail with a plain
    // Error (no McpError, no axios .response) — exactly the kind of
    // non-protocol failure the outer try/catch in setupHandlers exists to
    // convert into a safe isError:true result instead of an unhandled
    // rejection.
    server.tokenExpiry = Date.now() - 1000

    nock(TEST_CONFIG.apiUrl)
      .post('/v1/auth/login')
      .reply(200, { expires_in: 1800 }) // missing access_token -> renewToken() throws plain Error

    const result = await invokeCallToolHandler(server, 'zerodb_get_postgres_status', { project_id: 'test-project-123' })

    expect(result.isError).toBe(true)
    expect(result.content[0]._meta.code).toBe('EXECUTION_ERROR')
    expect(result.content[0].text).toContain('Error executing zerodb_get_postgres_status')
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Error executing zerodb_get_postgres_status'),
      expect.any(String)
    )
  })
})

describe('autoProvisionCredentials - malformed JSON response from the provisioning endpoint', () => {
  const { autoProvisionCredentials } = require('../index')
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    cleanupNock()
    jest.clearAllMocks()
    delete process.env.ZERODB_API_KEY
    delete process.env.ZERODB_API_TOKEN
    delete process.env.ZERODB_USERNAME
    delete process.env.ZERODB_PASSWORD
    delete process.env.ZERODB_PROJECT_ID
  })

  afterEach(() => {
    cleanupNock()
    process.env = { ...ORIGINAL_ENV }
  })

  test('does not throw and leaves credentials unset when the response body is not valid JSON', async () => {
    nock('https://api.ainative.studio')
      .post('/api/v1/public/instant-db')
      .reply(200, 'this is not json {{{')

    await expect(autoProvisionCredentials()).resolves.not.toThrow()

    expect(process.env.ZERODB_API_KEY).toBeUndefined()
    expect(process.env.ZERODB_PROJECT_ID).toBeUndefined()
  })
})
