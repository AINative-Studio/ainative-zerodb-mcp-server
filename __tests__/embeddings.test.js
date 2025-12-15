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

const createTestVector = (dimension = 384) => {
  return Array(dimension).fill(0).map(() => Math.random())
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

const cleanupNock = () => {
  nock.cleanAll()
  nock.enableNetConnect()
}

describe('ZeroDBMCPServer - Embedding Tools (TDD)', () => {
  let server

  beforeEach(() => {
    cleanupNock()
    jest.clearAllMocks()
    server = createMockedServer()
  })

  afterEach(() => {
    cleanupNock()
  })

  // ==================== DIMENSION VALIDATION TESTS ====================
  describe('Dimension Validation', () => {
    test('should validate 384 dimensions', () => {
      const vector = createTestVector(384)
      expect(() => server.validateVectorDimension(vector)).not.toThrow()
      expect(server.validateVectorDimension(vector)).toBe(384)
    })

    test('should validate 768 dimensions', () => {
      const vector = createTestVector(768)
      expect(() => server.validateVectorDimension(vector)).not.toThrow()
      expect(server.validateVectorDimension(vector)).toBe(768)
    })

    test('should validate 1024 dimensions', () => {
      const vector = createTestVector(1024)
      expect(() => server.validateVectorDimension(vector)).not.toThrow()
      expect(server.validateVectorDimension(vector)).toBe(1024)
    })

    test('should validate 1536 dimensions (legacy)', () => {
      const vector = createTestVector(1536)
      expect(() => server.validateVectorDimension(vector)).not.toThrow()
      expect(server.validateVectorDimension(vector)).toBe(1536)
    })

    test('should reject unsupported dimension 256', () => {
      const vector = createTestVector(256)
      expect(() => server.validateVectorDimension(vector)).toThrow(
        'Unsupported dimension: 256. Supported: 384, 768, 1024, 1536'
      )
    })

    test('should reject unsupported dimension 512', () => {
      const vector = createTestVector(512)
      expect(() => server.validateVectorDimension(vector)).toThrow(
        'Unsupported dimension: 512. Supported: 384, 768, 1024, 1536'
      )
    })

    test('should reject unsupported dimension 2048', () => {
      const vector = createTestVector(2048)
      expect(() => server.validateVectorDimension(vector)).toThrow(
        'Unsupported dimension: 2048. Supported: 384, 768, 1024, 1536'
      )
    })

    test('should reject empty vector', () => {
      const vector = []
      expect(() => server.validateVectorDimension(vector)).toThrow(
        'Unsupported dimension: 0. Supported: 384, 768, 1024, 1536'
      )
    })

    test('should handle null vector gracefully', () => {
      expect(() => server.validateVectorDimension(null)).toThrow()
    })

    test('should handle undefined vector gracefully', () => {
      expect(() => server.validateVectorDimension(undefined)).toThrow()
    })
  })

  // ==================== GENERATE EMBEDDINGS TOOL TESTS ====================
  describe('zerodb_generate_embeddings Tool', () => {
    test('should generate embeddings with default model (384-dim)', async () => {
      const mockEmbeddings = {
        embeddings: [createTestVector(384)],
        dimensions: 384,
        model: 'BAAI/bge-small-en-v1.5'
      }

      nock(TEST_CONFIG.apiUrl)
        .post('/v1/public/zerodb/mcp/execute', body =>
          body.operation === 'generate_embeddings' &&
          body.params.texts[0] === 'Test document'
        )
        .reply(200, { success: true, result: mockEmbeddings })

      const result = await server.routeToolCall('zerodb_generate_embeddings', {
        texts: ['Test document']
      })

      expect(result.content[0].text).toContain('"dimensions": 384')
      expect(result.content[0].text).toContain('"model": "BAAI/bge-small-en-v1.5"')
    })

    test('should generate embeddings with bge-base model (768-dim)', async () => {
      const mockEmbeddings = {
        embeddings: [createTestVector(768)],
        dimensions: 768,
        model: 'BAAI/bge-base-en-v1.5'
      }

      nock(TEST_CONFIG.apiUrl)
        .post('/v1/public/zerodb/mcp/execute', body =>
          body.operation === 'generate_embeddings' &&
          body.params.model === 'BAAI/bge-base-en-v1.5'
        )
        .reply(200, { success: true, result: mockEmbeddings })

      const result = await server.routeToolCall('zerodb_generate_embeddings', {
        texts: ['Test document'],
        model: 'BAAI/bge-base-en-v1.5'
      })

      expect(result.content[0].text).toContain('"dimensions": 768')
    })

    test('should generate embeddings with bge-large model (1024-dim)', async () => {
      const mockEmbeddings = {
        embeddings: [createTestVector(1024)],
        dimensions: 1024,
        model: 'BAAI/bge-large-en-v1.5'
      }

      nock(TEST_CONFIG.apiUrl)
        .post('/v1/public/zerodb/mcp/execute', body =>
          body.operation === 'generate_embeddings' &&
          body.params.model === 'BAAI/bge-large-en-v1.5'
        )
        .reply(200, { success: true, result: mockEmbeddings })

      const result = await server.routeToolCall('zerodb_generate_embeddings', {
        texts: ['Test document'],
        model: 'BAAI/bge-large-en-v1.5'
      })

      expect(result.content[0].text).toContain('"dimensions": 1024')
    })

    test('should handle batch text generation', async () => {
      const mockEmbeddings = {
        embeddings: [
          createTestVector(384),
          createTestVector(384),
          createTestVector(384)
        ],
        dimensions: 384,
        model: 'BAAI/bge-small-en-v1.5'
      }

      nock(TEST_CONFIG.apiUrl)
        .post('/v1/public/zerodb/mcp/execute')
        .reply(200, { success: true, result: mockEmbeddings })

      const result = await server.routeToolCall('zerodb_generate_embeddings', {
        texts: ['Doc 1', 'Doc 2', 'Doc 3']
      })

      const parsedResult = JSON.parse(result.content[0].text)
      expect(parsedResult.embeddings).toHaveLength(3)
    })

    test('should handle API errors gracefully', async () => {
      nock(TEST_CONFIG.apiUrl)
        .post('/v1/public/zerodb/mcp/execute')
        .reply(500, { error: 'Model loading failed' })

      const result = await server.routeToolCall('zerodb_generate_embeddings', {
        texts: ['Test']
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Error')
    })
  })

  // ==================== EMBED AND STORE TOOL TESTS ====================
  describe('zerodb_embed_and_store Tool', () => {
    test('should embed and store with default model', async () => {
      const mockResponse = {
        vectors_stored: 1,
        dimensions: 384,
        model: 'BAAI/bge-small-en-v1.5',
        namespace: 'default',
        vector_ids: ['vec-123']
      }

      nock(TEST_CONFIG.apiUrl)
        .post('/v1/public/zerodb/mcp/execute', body =>
          body.operation === 'embed_and_store'
        )
        .reply(200, { success: true, result: mockResponse })

      const result = await server.routeToolCall('zerodb_embed_and_store', {
        texts: ['Test document']
      })

      expect(result.content[0].text).toContain('"vectors_stored": 1')
      expect(result.content[0].text).toContain('"dimensions": 384')
    })

    test('should embed and store with custom model and namespace', async () => {
      const mockResponse = {
        vectors_stored: 2,
        dimensions: 768,
        model: 'BAAI/bge-base-en-v1.5',
        namespace: 'custom-namespace',
        vector_ids: ['vec-1', 'vec-2']
      }

      nock(TEST_CONFIG.apiUrl)
        .post('/v1/public/zerodb/mcp/execute', body =>
          body.operation === 'embed_and_store' &&
          body.params.model === 'BAAI/bge-base-en-v1.5' &&
          body.params.namespace === 'custom-namespace'
        )
        .reply(200, { success: true, result: mockResponse })

      const result = await server.routeToolCall('zerodb_embed_and_store', {
        texts: ['Doc 1', 'Doc 2'],
        model: 'BAAI/bge-base-en-v1.5',
        namespace: 'custom-namespace'
      })

      expect(result.content[0].text).toContain('"vectors_stored": 2')
      expect(result.content[0].text).toContain('"dimensions": 768')
      expect(result.content[0].text).toContain('"namespace": "custom-namespace"')
    })

    test('should handle metadata in embed and store', async () => {
      const mockResponse = {
        vectors_stored: 1,
        dimensions: 384,
        vector_ids: ['vec-123']
      }

      nock(TEST_CONFIG.apiUrl)
        .post('/v1/public/zerodb/mcp/execute', body =>
          body.params.metadata && body.params.metadata.source === 'test'
        )
        .reply(200, { success: true, result: mockResponse })

      const result = await server.routeToolCall('zerodb_embed_and_store', {
        texts: ['Test'],
        metadata: { source: 'test' }
      })

      expect(result.isError).not.toBe(true)
    })
  })

  // ==================== SEMANTIC SEARCH TOOL TESTS ====================
  describe('zerodb_semantic_search Tool', () => {
    test('should perform semantic search with default model', async () => {
      const mockResults = {
        total_results: 2,
        results: [
          {
            id: 'vec-1',
            score: 0.95,
            document: 'Test document 1',
            metadata: {}
          },
          {
            id: 'vec-2',
            score: 0.87,
            document: 'Test document 2',
            metadata: {}
          }
        ],
        dimensions: 384,
        model: 'BAAI/bge-small-en-v1.5'
      }

      nock(TEST_CONFIG.apiUrl)
        .post('/v1/public/zerodb/mcp/execute', body =>
          body.operation === 'semantic_search' &&
          body.params.query_text === 'search query'
        )
        .reply(200, { success: true, result: mockResults })

      const result = await server.routeToolCall('zerodb_semantic_search', {
        query_text: 'search query'
      })

      expect(result.content[0].text).toContain('"total_results": 2')
      expect(result.content[0].text).toContain('"dimensions": 384')
    })

    test('should perform semantic search with custom model and limit', async () => {
      const mockResults = {
        total_results: 5,
        results: Array(5).fill(null).map((_, i) => ({
          id: `vec-${i}`,
          score: 0.9 - (i * 0.05),
          document: `Document ${i}`,
          metadata: {}
        })),
        dimensions: 768,
        model: 'BAAI/bge-base-en-v1.5'
      }

      nock(TEST_CONFIG.apiUrl)
        .post('/v1/public/zerodb/mcp/execute', body =>
          body.operation === 'semantic_search' &&
          body.params.model === 'BAAI/bge-base-en-v1.5' &&
          body.params.limit === 5
        )
        .reply(200, { success: true, result: mockResults })

      const result = await server.routeToolCall('zerodb_semantic_search', {
        query_text: 'test query',
        model: 'BAAI/bge-base-en-v1.5',
        limit: 5
      })

      const parsedResult = JSON.parse(result.content[0].text)
      expect(parsedResult.results).toHaveLength(5)
      expect(parsedResult.dimensions).toBe(768)
    })

    test('should handle namespace parameter in semantic search', async () => {
      const mockResults = {
        total_results: 1,
        results: [{ id: 'vec-1', score: 0.9, document: 'Test' }]
      }

      nock(TEST_CONFIG.apiUrl)
        .post('/v1/public/zerodb/mcp/execute', body =>
          body.params.namespace === 'custom-ns'
        )
        .reply(200, { success: true, result: mockResults })

      const result = await server.routeToolCall('zerodb_semantic_search', {
        query_text: 'query',
        namespace: 'custom-ns'
      })

      expect(result.isError).not.toBe(true)
    })

    test('should handle threshold parameter', async () => {
      const mockResults = {
        total_results: 1,
        results: [{ id: 'vec-1', score: 0.95, document: 'High match' }]
      }

      nock(TEST_CONFIG.apiUrl)
        .post('/v1/public/zerodb/mcp/execute', body =>
          body.params.threshold === 0.9
        )
        .reply(200, { success: true, result: mockResults })

      const result = await server.routeToolCall('zerodb_semantic_search', {
        query_text: 'query',
        threshold: 0.9
      })

      expect(result.isError).not.toBe(true)
    })

    test('should handle no results found', async () => {
      const mockResults = {
        total_results: 0,
        results: []
      }

      nock(TEST_CONFIG.apiUrl)
        .post('/v1/public/zerodb/mcp/execute')
        .reply(200, { success: true, result: mockResults })

      const result = await server.routeToolCall('zerodb_semantic_search', {
        query_text: 'nonexistent query'
      })

      expect(result.content[0].text).toContain('"total_results": 0')
    })
  })

  // ==================== UPDATED UPSERT VECTOR TESTS ====================
  describe('zerodb_upsert_vector - Multi-Dimension Support', () => {
    test('should accept 384-dimension vectors', async () => {
      const vector384 = createTestVector(384)
      const mockResponse = {
        vector_id: 'vec-384',
        dimensions: 384,
        success: true
      }

      nock(TEST_CONFIG.apiUrl)
        .post('/v1/public/zerodb/mcp/execute', body =>
          body.operation === 'upsert_vector' &&
          body.params.vector_embedding.length === 384
        )
        .reply(200, { success: true, result: mockResponse })

      const result = await server.routeToolCall('zerodb_upsert_vector', {
        vector_embedding: vector384,
        document: 'Test document'
      })

      expect(result.isError).not.toBe(true)
      expect(result.content[0].text).toContain('"dimensions": 384')
    })

    test('should accept 768-dimension vectors', async () => {
      const vector768 = createTestVector(768)
      const mockResponse = {
        vector_id: 'vec-768',
        dimensions: 768,
        success: true
      }

      nock(TEST_CONFIG.apiUrl)
        .post('/v1/public/zerodb/mcp/execute', body =>
          body.params.vector_embedding.length === 768
        )
        .reply(200, { success: true, result: mockResponse })

      const result = await server.routeToolCall('zerodb_upsert_vector', {
        vector_embedding: vector768,
        document: 'Test document'
      })

      expect(result.isError).not.toBe(true)
    })

    test('should accept 1024-dimension vectors', async () => {
      const vector1024 = createTestVector(1024)
      const mockResponse = {
        vector_id: 'vec-1024',
        dimensions: 1024,
        success: true
      }

      nock(TEST_CONFIG.apiUrl)
        .post('/v1/public/zerodb/mcp/execute', body =>
          body.params.vector_embedding.length === 1024
        )
        .reply(200, { success: true, result: mockResponse })

      const result = await server.routeToolCall('zerodb_upsert_vector', {
        vector_embedding: vector1024,
        document: 'Test document'
      })

      expect(result.isError).not.toBe(true)
    })

    test('should accept 1536-dimension vectors (legacy)', async () => {
      const vector1536 = createTestVector(1536)
      const mockResponse = {
        vector_id: 'vec-1536',
        dimensions: 1536,
        success: true
      }

      nock(TEST_CONFIG.apiUrl)
        .post('/v1/public/zerodb/mcp/execute', body =>
          body.params.vector_embedding.length === 1536
        )
        .reply(200, { success: true, result: mockResponse })

      const result = await server.routeToolCall('zerodb_upsert_vector', {
        vector_embedding: vector1536,
        document: 'Test document'
      })

      expect(result.isError).not.toBe(true)
    })

    test('should handle backend rejection of 512-dimension vectors', async () => {
      const vector512 = createTestVector(512)

      // Backend will reject unsupported dimensions
      nock(TEST_CONFIG.apiUrl)
        .post('/v1/public/zerodb/mcp/execute')
        .reply(400, {
          success: false,
          error: { message: 'Unsupported dimension: 512' }
        })

      const result = await server.routeToolCall('zerodb_upsert_vector', {
        vector_embedding: vector512,
        document: 'Test document'
      })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('Unsupported dimension')
    })
  })

  // ==================== UPDATED SEARCH VECTORS TESTS ====================
  describe('zerodb_search_vectors - Multi-Dimension Support', () => {
    test('should search with 384-dimension query vector', async () => {
      const queryVector = createTestVector(384)
      const mockResults = {
        total_results: 1,
        results: [{ id: 'vec-1', score: 0.95 }],
        dimensions: 384
      }

      nock(TEST_CONFIG.apiUrl)
        .post('/v1/public/zerodb/mcp/execute', body =>
          body.operation === 'search_vectors' &&
          body.params.query_vector.length === 384
        )
        .reply(200, { success: true, result: mockResults })

      const result = await server.routeToolCall('zerodb_search_vectors', {
        query_vector: queryVector
      })

      expect(result.isError).not.toBe(true)
    })

    test('should search with 768-dimension query vector', async () => {
      const queryVector = createTestVector(768)
      const mockResults = {
        total_results: 1,
        results: [{ id: 'vec-1', score: 0.92 }],
        dimensions: 768
      }

      nock(TEST_CONFIG.apiUrl)
        .post('/v1/public/zerodb/mcp/execute', body =>
          body.params.query_vector.length === 768
        )
        .reply(200, { success: true, result: mockResults })

      const result = await server.routeToolCall('zerodb_search_vectors', {
        query_vector: queryVector
      })

      expect(result.isError).not.toBe(true)
    })

    test('should search with 1024-dimension query vector', async () => {
      const queryVector = createTestVector(1024)
      const mockResults = {
        total_results: 1,
        results: [{ id: 'vec-1', score: 0.93 }],
        dimensions: 1024
      }

      nock(TEST_CONFIG.apiUrl)
        .post('/v1/public/zerodb/mcp/execute', body =>
          body.params.query_vector.length === 1024
        )
        .reply(200, { success: true, result: mockResults })

      const result = await server.routeToolCall('zerodb_search_vectors', {
        query_vector: queryVector
      })

      expect(result.isError).not.toBe(true)
    })

    test('should search with 1536-dimension query vector (legacy)', async () => {
      const queryVector = createTestVector(1536)
      const mockResults = {
        total_results: 1,
        results: [{ id: 'vec-1', score: 0.94 }],
        dimensions: 1536
      }

      nock(TEST_CONFIG.apiUrl)
        .post('/v1/public/zerodb/mcp/execute', body =>
          body.params.query_vector.length === 1536
        )
        .reply(200, { success: true, result: mockResults })

      const result = await server.routeToolCall('zerodb_search_vectors', {
        query_vector: queryVector
      })

      expect(result.isError).not.toBe(true)
    })
  })

  // ==================== BATCH UPSERT MULTI-DIMENSION TESTS ====================
  describe('zerodb_batch_upsert_vectors - Multi-Dimension Support', () => {
    test('should batch upsert mixed dimension vectors (384 and 768)', async () => {
      const vectors = [
        {
          vector_embedding: createTestVector(384),
          document: 'Doc 1 (384-dim)'
        },
        {
          vector_embedding: createTestVector(768),
          document: 'Doc 2 (768-dim)'
        }
      ]

      const mockResponse = {
        vectors_stored: 2,
        vector_ids: ['vec-1', 'vec-2'],
        dimensions: [384, 768]
      }

      nock(TEST_CONFIG.apiUrl)
        .post('/v1/public/zerodb/mcp/execute', body =>
          body.operation === 'batch_upsert_vectors'
        )
        .reply(200, { success: true, result: mockResponse })

      const result = await server.routeToolCall('zerodb_batch_upsert_vectors', {
        vectors
      })

      expect(result.isError).not.toBe(true)
      expect(result.content[0].text).toContain('"vectors_stored": 2')
    })

    test('should batch upsert all 384-dimension vectors', async () => {
      const vectors = Array(5).fill(null).map((_, i) => ({
        vector_embedding: createTestVector(384),
        document: `Doc ${i}`
      }))

      const mockResponse = {
        vectors_stored: 5,
        vector_ids: ['vec-1', 'vec-2', 'vec-3', 'vec-4', 'vec-5'],
        dimensions: 384
      }

      nock(TEST_CONFIG.apiUrl)
        .post('/v1/public/zerodb/mcp/execute')
        .reply(200, { success: true, result: mockResponse })

      const result = await server.routeToolCall('zerodb_batch_upsert_vectors', {
        vectors
      })

      expect(result.isError).not.toBe(true)
      expect(result.content[0].text).toContain('"vectors_stored": 5')
    })
  })

  // ==================== INTEGRATION TESTS ====================
  describe('End-to-End Embedding Workflows', () => {
    test('should handle full RAG workflow with 384-dim embeddings', async () => {
      // Step 1: Embed and store documents
      nock(TEST_CONFIG.apiUrl)
        .post('/v1/public/zerodb/mcp/execute', body =>
          body.operation === 'embed_and_store'
        )
        .reply(200, {
          success: true,
          result: {
            vectors_stored: 3,
            dimensions: 384,
            vector_ids: ['vec-1', 'vec-2', 'vec-3']
          }
        })

      const storeResult = await server.routeToolCall('zerodb_embed_and_store', {
        texts: ['Doc 1', 'Doc 2', 'Doc 3'],
        model: 'BAAI/bge-small-en-v1.5',
        namespace: 'test-rag'
      })

      expect(storeResult.isError).not.toBe(true)

      // Step 2: Search with semantic query
      nock(TEST_CONFIG.apiUrl)
        .post('/v1/public/zerodb/mcp/execute', body =>
          body.operation === 'semantic_search'
        )
        .reply(200, {
          success: true,
          result: {
            total_results: 2,
            results: [
              { id: 'vec-1', score: 0.95, document: 'Doc 1' },
              { id: 'vec-2', score: 0.87, document: 'Doc 2' }
            ]
          }
        })

      const searchResult = await server.routeToolCall('zerodb_semantic_search', {
        query_text: 'search query',
        model: 'BAAI/bge-small-en-v1.5',
        namespace: 'test-rag'
      })

      expect(searchResult.isError).not.toBe(true)
      expect(searchResult.content[0].text).toContain('"total_results": 2')
    })

    test('should handle dimension mismatch scenario', async () => {
      // Generate 384-dim embedding
      nock(TEST_CONFIG.apiUrl)
        .post('/v1/public/zerodb/mcp/execute', body =>
          body.operation === 'generate_embeddings' &&
          body.params.model === 'BAAI/bge-small-en-v1.5'
        )
        .reply(200, {
          success: true,
          result: {
            embeddings: [createTestVector(384)],
            dimensions: 384
          }
        })

      const embedResult = await server.routeToolCall('zerodb_generate_embeddings', {
        texts: ['Test'],
        model: 'BAAI/bge-small-en-v1.5'
      })

      expect(embedResult.isError).not.toBe(true)
      expect(embedResult.content[0].text).toContain('"dimensions": 384')
    })

    test('should support namespace isolation across dimensions', async () => {
      // Store 384-dim in namespace-384
      nock(TEST_CONFIG.apiUrl)
        .post('/v1/public/zerodb/mcp/execute')
        .reply(200, {
          success: true,
          result: {
            vectors_stored: 1,
            dimensions: 384,
            namespace: 'namespace-384'
          }
        })

      const result384 = await server.routeToolCall('zerodb_embed_and_store', {
        texts: ['Doc 384'],
        model: 'BAAI/bge-small-en-v1.5',
        namespace: 'namespace-384'
      })

      expect(result384.isError).not.toBe(true)

      // Store 768-dim in namespace-768
      nock(TEST_CONFIG.apiUrl)
        .post('/v1/public/zerodb/mcp/execute')
        .reply(200, {
          success: true,
          result: {
            vectors_stored: 1,
            dimensions: 768,
            namespace: 'namespace-768'
          }
        })

      const result768 = await server.routeToolCall('zerodb_embed_and_store', {
        texts: ['Doc 768'],
        model: 'BAAI/bge-base-en-v1.5',
        namespace: 'namespace-768'
      })

      expect(result768.isError).not.toBe(true)
    })
  })
})
