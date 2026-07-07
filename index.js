#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js')
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js')
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js')
const axios = require('axios')

/**
 * ZeroDB MCP Server v2.2.0
 *
 * Complete implementation with ALL 76 operations across 11 categories:
 * - Vector Operations (10): upsert, batch_upsert, search, delete, get, list, stats, create_index, optimize, export
 * - Vector Compression Operations (6): TurboQuant compress, decompress, hybrid_search, optimize, feature_map, kernel_similarity
 * - Table Operations (8): create_table, list_tables, get_table, delete_table, insert_rows, query_rows, update_rows, delete_rows
 * - File Operations (6): upload_file, download_file, list_files, delete_file, get_file_metadata, generate_presigned_url
 * - Event Operations (5): create_event, list_events, get_event, subscribe_to_events, event_stats
 * - Project Operations (7): create_project, get_project, list_projects, update_project, delete_project, get_project_stats, enable_database
 * - RLHF Operations (10): collect_interaction, agent_feedback, workflow_feedback, error_report, get_status, get_summary, start_collection, stop_collection, session_interactions, broadcast_event
 * - Memory Operations (3): store_memory, search_memory, get_context
 * - Admin Operations (5): system_stats, list_all_projects, user_usage, system_health, optimize_database
 * - PostgreSQL Operations (6): query, schema_info, create_table, backup, restore, stats
 * - Dedicated PostgreSQL Management (7): provision, status, connection, usage, logs, restart, delete
 */

class ZeroDBMCPServer {
  constructor () {
    this.apiUrl = process.env.ZERODB_API_URL || 'https://api.ainative.studio'
    this.projectId = process.env.ZERODB_PROJECT_ID
    // Support ZERODB_API_KEY (recommended) or ZERODB_API_TOKEN (legacy)
    this.apiToken = process.env.ZERODB_API_KEY || process.env.ZERODB_API_TOKEN
    this.username = process.env.ZERODB_USERNAME
    this.password = process.env.ZERODB_PASSWORD
    this.contextWindow = parseInt(process.env.MCP_CONTEXT_WINDOW || '8192')
    this.retentionDays = parseInt(process.env.MCP_RETENTION_DAYS || '30')
    this.tokenExpiry = null

    // Security: Validate required credentials - API key/token OR username/password
    this.useStaticToken = !!this.apiToken && (!this.username || !this.password)
    if (!this.apiToken && (!this.username || !this.password)) {
      throw new Error('SECURITY ERROR: ZERODB_API_KEY (recommended), ZERODB_API_TOKEN, or ZERODB_USERNAME and ZERODB_PASSWORD environment variables are required. Do not hardcode credentials.')
    }

    // Deprecation warning for username/password auth
    if (!this.useStaticToken && this.username && this.password) {
      console.error('')
      console.error('\u26a0\ufe0f  DEPRECATION WARNING: ZERODB_USERNAME/ZERODB_PASSWORD authentication is deprecated.')
      console.error('    Please switch to ZERODB_API_KEY for improved security.')
      console.error('    Get your API key at: https://ainative.studio/settings')
      console.error('    Password auth will be removed in zerodb-mcp v3.0.')
      console.error('')
    }

    this.server = new Server(
      {
        name: 'zerodb-mcp',
        version: '2.3.2'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    )

    this.setupTools()
    this.setupHandlers()
    this.setupTokenRenewal()
  }

  /**
   * Validate vector dimensions - supports 384, 768, 1024, 1536
   * @param {Array<number>} vector - Vector embedding array
   * @returns {number} - Validated dimension count
   * @throws {Error} - If dimension is not supported
   */
  validateVectorDimension (vector) {
    const SUPPORTED_DIMENSIONS = [384, 768, 1024, 1536]

    if (!vector || !Array.isArray(vector)) {
      throw new Error('Vector must be a non-empty array')
    }

    const dim = vector.length

    if (!SUPPORTED_DIMENSIONS.includes(dim)) {
      throw new Error(`Unsupported dimension: ${dim}. Supported: ${SUPPORTED_DIMENSIONS.join(', ')}`)
    }

    return dim
  }

  setupTools () {
    // Define ALL 69 MCP tools for ZeroDB integration (updated from 66 with 3 new embedding tools)
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // ==================== EMBEDDING OPERATIONS (3) ====================
        {
          name: 'zerodb_generate_embeddings',
          description: 'Generate embeddings using specified model (384/768/1024 dimensions). Supports BAAI/bge-small-en-v1.5 (384-dim, default), BAAI/bge-base-en-v1.5 (768-dim), BAAI/bge-large-en-v1.5 (1024-dim). Use when you need raw embedding vectors without storing them. Does not persist data — for embed + store in one step, use zerodb_embed_and_store instead.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              texts: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of text strings to generate embeddings for'
              },
              model: {
                type: 'string',
                enum: ['BAAI/bge-small-en-v1.5', 'BAAI/bge-base-en-v1.5', 'BAAI/bge-large-en-v1.5'],
                description: 'Embedding model to use',
                default: 'BAAI/bge-small-en-v1.5'
              }
            },
            required: ['texts']
          }
        },
        {
          name: 'zerodb_embed_and_store',
          description: 'Generate embeddings and store in ZeroDB in one step. Auto-detects dimension based on model and routes to correct storage. Use when you want to embed text and persist the vectors in a single call. Combines zerodb_generate_embeddings + zerodb_upsert_vector.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              texts: {
                type: 'array',
                items: { type: 'string' },
                description: 'Array of text strings to embed and store'
              },
              model: {
                type: 'string',
                enum: ['BAAI/bge-small-en-v1.5', 'BAAI/bge-base-en-v1.5', 'BAAI/bge-large-en-v1.5'],
                description: 'Embedding model to use',
                default: 'BAAI/bge-small-en-v1.5'
              },
              namespace: {
                type: 'string',
                description: 'Vector namespace for organization',
                default: 'default'
              },
              metadata: {
                type: 'object',
                description: 'Optional metadata to attach to vectors'
              }
            },
            required: ['texts']
          }
        },
        {
          name: 'zerodb_semantic_search',
          description: 'Semantic search using text query (auto-embeds query text). Searches vectors in the same dimension as the model used. Use when searching vectors using a text query (auto-embeds the text). Unlike zerodb_search_vectors which requires a raw vector, this accepts plain text. Unlike zerodb_search_memory which searches agent conversation memory, this searches the general vector store.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              query_text: {
                type: 'string',
                description: 'Text query to search for (will be auto-embedded)'
              },
              model: {
                type: 'string',
                enum: ['BAAI/bge-small-en-v1.5', 'BAAI/bge-base-en-v1.5', 'BAAI/bge-large-en-v1.5'],
                description: 'Model to use for query embedding (must match stored vectors)',
                default: 'BAAI/bge-small-en-v1.5'
              },
              namespace: {
                type: 'string',
                description: 'Vector namespace to search in',
                default: 'default'
              },
              limit: {
                type: 'number',
                description: 'Maximum number of results to return',
                default: 10
              },
              threshold: {
                type: 'number',
                description: 'Minimum similarity score (0.0-1.0)',
                default: 0.7
              },
              filter_metadata: {
                type: 'object',
                description: 'Metadata filters for search'
              }
            },
            required: ['query_text']
          }
        },

        // ==================== MEMORY OPERATIONS (3) ====================
        {
          name: 'zerodb_store_memory',
          description: 'Store agent memory in ZeroDB for persistent context. Use when the agent needs to persist conversation turns, decisions, or observations for later recall. Stores with role, session, and agent metadata for filtered retrieval.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              content: { type: 'string', description: 'Memory content to store' },
              role: { type: 'string', enum: ['user', 'assistant', 'system'], description: 'Message role' },
              session_id: { type: 'string', description: 'Session identifier (auto-generated if not provided)' },
              agent_id: { type: 'string', description: 'Agent identifier (auto-generated if not provided)' },
              metadata: { type: 'object', description: 'Additional metadata' }
            },
            required: ['content', 'role']
          }
        },
        {
          name: 'zerodb_search_memory',
          description: 'Search agent memory using semantic similarity. Use when searching agent conversation memory by natural language. Unlike zerodb_search_vectors which requires a raw vector, and zerodb_semantic_search which searches the general vector store, this searches agent-specific memory entries filtered by session/agent/role.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' },
              session_id: { type: 'string', description: 'Filter by session' },
              agent_id: { type: 'string', description: 'Filter by agent' },
              role: { type: 'string', description: 'Filter by role' },
              limit: { type: 'number', description: 'Max results', default: 10 }
            },
            required: ['query']
          }
        },
        {
          name: 'zerodb_get_context',
          description: 'Get agent context window for current session. Use when the agent needs to retrieve its recent conversation context within token limits. Returns the most recent memories for a session, bounded by max_tokens.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              session_id: { type: 'string', description: 'Session identifier' },
              agent_id: { type: 'string', description: 'Agent identifier' },
              max_tokens: { type: 'number', description: 'Max tokens in context' }
            },
            required: ['session_id']
          }
        },

        // ==================== VECTOR OPERATIONS (10) ====================
        {
          name: 'zerodb_upsert_vector',
          description: 'Store or update a vector embedding with metadata. Supports 384, 768, 1024, or 1536 dimensions. Dimension is auto-detected and validated. Use when you have a pre-computed embedding vector to store or update. For embedding text and storing in one step, use zerodb_embed_and_store instead.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              vector_embedding: {
                type: 'array',
                items: { type: 'number' },
                description: 'Vector embedding (384, 768, 1024, or 1536 dimensions supported)'
              },
              document: { type: 'string', description: 'Source document or text' },
              metadata: { type: 'object', description: 'Document metadata' },
              namespace: { type: 'string', description: 'Vector namespace', default: 'default' },
              vector_id: { type: 'string', description: 'Optional vector ID for updates' }
            },
            required: ['vector_embedding', 'document']
          }
        },
        {
          name: 'zerodb_batch_upsert_vectors',
          description: 'Batch upsert multiple vectors for efficiency. Use when storing many vectors at once to reduce API round-trips. Accepts an array of vector objects and processes them in a single request.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              vectors: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    vector_embedding: { type: 'array', items: { type: 'number' } },
                    document: { type: 'string' },
                    metadata: { type: 'object' },
                    vector_id: { type: 'string' }
                  },
                  required: ['vector_embedding', 'document']
                },
                description: 'Array of vectors to upsert'
              },
              namespace: { type: 'string', description: 'Vector namespace', default: 'default' }
            },
            required: ['vectors']
          }
        },
        {
          name: 'zerodb_search_vectors',
          description: 'Search vectors using semantic similarity. Supports 384, 768, 1024, or 1536 dimension query vectors. Auto-detects dimension. Use when searching raw vector embeddings by similarity with a query vector. Unlike zerodb_semantic_search which accepts text (auto-embeds), this requires a pre-computed vector. Unlike zerodb_search_memory which searches agent memory, this searches the general vector store.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              query_vector: {
                type: 'array',
                items: { type: 'number' },
                description: 'Query vector (384, 768, 1024, or 1536 dimensions supported)'
              },
              namespace: { type: 'string', description: 'Vector namespace' },
              limit: { type: 'number', description: 'Max results', default: 10 },
              threshold: { type: 'number', description: 'Similarity threshold', default: 0.7 },
              filter_metadata: { type: 'object', description: 'Metadata filters' }
            },
            required: ['query_vector']
          }
        },
        {
          name: 'zerodb_delete_vector',
          description: 'Delete a specific vector by ID. Use when removing a single vector embedding from the store. WARNING: This operation is irreversible.',
          annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              vector_id: { type: 'string', description: 'Vector ID to delete' },
              namespace: { type: 'string', description: 'Vector namespace' }
            },
            required: ['vector_id']
          }
        },
        {
          name: 'zerodb_get_vector',
          description: 'Retrieve a specific vector by ID. Use when you need to inspect a particular vector\'s metadata or embedding values. Optionally includes the full embedding array.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              vector_id: { type: 'string', description: 'Vector ID to retrieve' },
              namespace: { type: 'string', description: 'Vector namespace' },
              include_embedding: { type: 'boolean', description: 'Include full embedding in response', default: false }
            },
            required: ['vector_id']
          }
        },
        {
          name: 'zerodb_list_vectors',
          description: 'List vectors in a project/namespace with pagination. Use when the agent needs to browse or enumerate stored vectors, or answer "what vectors exist?". Supports filtering by namespace and metadata.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              namespace: { type: 'string', description: 'Vector namespace' },
              limit: { type: 'number', description: 'Results per page', default: 100 },
              offset: { type: 'number', description: 'Pagination offset', default: 0 },
              filter_metadata: { type: 'object', description: 'Metadata filters' }
            },
            required: []
          }
        },
        {
          name: 'zerodb_vector_stats',
          description: 'Get vector statistics for a project. Use when checking how many vectors are stored, their dimensions, and namespace distribution. Returns counts, dimension breakdowns, and optionally detailed statistics.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              namespace: { type: 'string', description: 'Optional namespace filter' },
              detailed: { type: 'boolean', description: 'Include detailed statistics', default: false }
            },
            required: []
          }
        },
        {
          name: 'zerodb_create_vector_index',
          description: 'Create optimized index for vector search. Use when search performance needs improvement on large vector collections. Supports IVF, HNSW, and flat index types with configurable distance metrics.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              namespace: { type: 'string', description: 'Namespace to index' },
              index_type: { type: 'string', enum: ['ivf', 'hnsw', 'flat'], description: 'Index algorithm', default: 'hnsw' },
              distance_metric: { type: 'string', enum: ['cosine', 'euclidean', 'dot'], description: 'Distance metric', default: 'cosine' },
              index_params: { type: 'object', description: 'Algorithm-specific parameters' }
            },
            required: []
          }
        },
        {
          name: 'zerodb_optimize_vectors',
          description: 'Optimize vector storage for better performance. Use when vector search is slow or storage needs compaction. Supports compress, reindex, and deduplicate operations. Use dry_run to preview changes first.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              namespace: { type: 'string', description: 'Namespace to optimize' },
              optimize_type: { type: 'string', enum: ['compress', 'reindex', 'deduplicate'], description: 'Optimization type', default: 'reindex' },
              dry_run: { type: 'boolean', description: 'Preview changes without applying', default: false }
            },
            required: []
          }
        },
        {
          name: 'zerodb_export_vectors',
          description: 'Export vectors to various formats (JSON, CSV, Parquet). Use when you need to download or migrate vector data out of ZeroDB. Supports filtering by namespace and metadata.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              namespace: { type: 'string', description: 'Namespace to export' },
              format: { type: 'string', enum: ['json', 'csv', 'parquet'], description: 'Export format', default: 'json' },
              filter_metadata: { type: 'object', description: 'Metadata filters' },
              include_embeddings: { type: 'boolean', description: 'Include vector embeddings', default: true }
            },
            required: []
          }
        },

        // ==================== VECTOR COMPRESSION OPERATIONS (6) - TurboQuant ====================
        {
          name: 'zerodb_quantum_compress',
          description: 'Compress vector using TurboQuant (PolarQuant + QJL) algorithm from Google Research (ICLR 2026). Achieves ~3.5x compression with 0.9999+ cosine similarity preservation. Data-oblivious — no calibration needed. Returns base64-encoded compressed data.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              vector_embedding: { type: 'array', items: { type: 'number' }, description: 'Vector to compress (1-4096 dimensions)' },
              compression_ratio: { type: 'number', description: 'Ignored (kept for backward compat). Actual ratio is determined by precision.', default: 0.5 },
              preserve_similarity: { type: 'boolean', description: 'Use TurboQuant (true) or PolarQuant-only (false)', default: true },
              precision: { type: 'number', description: 'Bit precision for radius quantization (8=3.5x, 16=2.4x, 32=highest fidelity)', default: 16 },
              method: { type: 'string', enum: ['turboquant', 'polarquant', 'qjl'], description: 'Algorithm: turboquant (PolarQuant+QJL), polarquant (PolarQuant only), qjl (sign-bit only)', default: 'turboquant' }
            },
            required: ['vector_embedding']
          }
        },
        {
          name: 'zerodb_quantum_decompress',
          description: 'Decompress a TurboQuant-compressed vector back to original dimensions. Reconstructs the full vector from the base64-encoded compressed data returned by zerodb_quantum_compress.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              compressed_vector: { type: 'array', items: { type: 'number' }, description: 'Compressed vector data' },
              original_dimensions: { type: 'number', description: 'Original vector dimensions', default: 1536 },
              compression_metadata: { type: 'object', description: 'Compression metadata from compress operation' }
            },
            required: ['compressed_vector']
          }
        },
        {
          name: 'zerodb_quantum_hybrid_search',
          description: 'Hybrid similarity search combining cosine similarity with metadata boosting. Returns ranked results with configurable weighting between similarity score and metadata relevance.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              query_vector: { type: 'array', items: { type: 'number' }, description: 'Query vector' },
              namespace: { type: 'string', description: 'Vector namespace' },
              quantum_weight: { type: 'number', description: 'Metadata boost weight (0.0-1.0)', default: 0.3 },
              classical_weight: { type: 'number', description: 'Cosine similarity weight (0.0-1.0)', default: 0.7 },
              limit: { type: 'number', description: 'Max results', default: 10 }
            },
            required: ['query_vector']
          }
        },
        {
          name: 'zerodb_quantum_optimize',
          description: 'Analyze vector space characteristics for optimal TurboQuant compression settings. Reports sparsity, magnitude distribution, and recommended precision level.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              namespace: { type: 'string', description: 'Namespace to analyze' },
              optimization_level: { type: 'number', description: 'Analysis depth (1-3)', default: 2 },
              target_backend: { type: 'string', enum: ['simulator', 'ionq', 'rigetti'], description: 'Target backend (simulator recommended)', default: 'simulator' }
            },
            required: []
          }
        },
        {
          name: 'zerodb_quantum_feature_map',
          description: 'Transform vector into feature space for enhanced similarity computation. Applies configurable feature mapping for dimensionality transformation.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              vector_embedding: { type: 'array', items: { type: 'number' }, description: 'Input vector' },
              feature_map_type: { type: 'string', enum: ['zz', 'pauli', 'custom'], description: 'Feature map type', default: 'zz' },
              num_qubits: { type: 'number', description: 'Dimensionality parameter', default: 10 },
              reps: { type: 'number', description: 'Number of repetitions', default: 2 }
            },
            required: ['vector_embedding']
          }
        },
        {
          name: 'zerodb_quantum_kernel',
          description: 'Calculate kernel similarity between two vectors. Supports fidelity (normalized dot product squared) and swap_test kernel types for measuring vector similarity.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              vector_a: { type: 'array', items: { type: 'number' }, description: 'First vector' },
              vector_b: { type: 'array', items: { type: 'number' }, description: 'Second vector' },
              kernel_type: { type: 'string', enum: ['fidelity', 'swap_test'], description: 'Kernel type', default: 'fidelity' },
              shots: { type: 'number', description: 'Number of iterations', default: 1024 }
            },
            required: ['vector_a', 'vector_b']
          }
        },

        // ==================== TABLE/NoSQL OPERATIONS (8) ====================
        {
          name: 'zerodb_create_table',
          description: 'Create a new NoSQL table with schema. Use when you need to set up a new data structure for storing structured records. Define fields and indexes for the table schema.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              table_name: { type: 'string', description: 'Unique table name' },
              schema: {
                type: 'object',
                description: 'Table schema definition',
                properties: {
                  fields: { type: 'object', description: 'Field definitions' },
                  indexes: { type: 'array', description: 'Index definitions' }
                }
              },
              description: { type: 'string', description: 'Table description' }
            },
            required: ['table_name', 'schema']
          }
        },
        {
          name: 'zerodb_list_tables',
          description: 'List all NoSQL tables in the project with their schemas. Use when the agent needs to discover available data structures or answer "what tables exist?". Returns table names, row counts, and field definitions.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Max results', default: 100 },
              offset: { type: 'number', description: 'Pagination offset', default: 0 }
            },
            required: []
          }
        },
        {
          name: 'zerodb_get_table',
          description: 'Get table details and schema. Use when you need to inspect a specific table\'s structure, field types, indexes, and optionally row count statistics.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              table_id: { type: 'string', description: 'Table ID or name' },
              include_stats: { type: 'boolean', description: 'Include row count and stats', default: true }
            },
            required: ['table_id']
          }
        },
        {
          name: 'zerodb_delete_table',
          description: 'Delete a table and all its data. Use when a table is no longer needed and should be permanently removed. Requires confirm flag. WARNING: This operation is irreversible.',
          annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              table_id: { type: 'string', description: 'Table ID or name to delete' },
              confirm: { type: 'boolean', description: 'Confirmation flag', default: false }
            },
            required: ['table_id', 'confirm']
          }
        },
        {
          name: 'zerodb_insert_rows',
          description: 'Insert rows into a table. Use when adding new records to a NoSQL table. Accepts an array of row objects and optionally returns inserted IDs.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              table_id: { type: 'string', description: 'Table ID or name' },
              rows: { type: 'array', items: { type: 'object' }, description: 'Array of row objects to insert' },
              return_ids: { type: 'boolean', description: 'Return inserted row IDs', default: true }
            },
            required: ['table_id', 'rows']
          }
        },
        {
          name: 'zerodb_query_rows',
          description: 'Query rows from a table with filters. Use when reading data from a NoSQL table. Supports MongoDB-style filters, sorting, pagination, and field projection.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              table_id: { type: 'string', description: 'Table ID or name' },
              filter: { type: 'object', description: 'MongoDB-style query filter' },
              sort: { type: 'object', description: 'Sort specification' },
              limit: { type: 'number', description: 'Max results', default: 100 },
              offset: { type: 'number', description: 'Pagination offset', default: 0 },
              projection: { type: 'object', description: 'Field projection' }
            },
            required: ['table_id']
          }
        },
        {
          name: 'zerodb_update_rows',
          description: 'Update rows in a table. Use when modifying existing records in a NoSQL table. Supports MongoDB-style update operators ($set, $inc, etc.) and optional upsert behavior.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              table_id: { type: 'string', description: 'Table ID or name' },
              filter: { type: 'object', description: 'MongoDB-style query filter' },
              update: { type: 'object', description: 'Update operations ($set, $inc, etc.)' },
              upsert: { type: 'boolean', description: 'Insert if not found', default: false }
            },
            required: ['table_id', 'filter', 'update']
          }
        },
        {
          name: 'zerodb_delete_rows',
          description: 'Delete rows from a table matching a filter. Use when removing specific records from a NoSQL table. Supports MongoDB-style filters. WARNING: This operation is irreversible.',
          annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              table_id: { type: 'string', description: 'Table ID or name' },
              filter: { type: 'object', description: 'MongoDB-style query filter to match rows' },
              limit: { type: 'number', description: 'Max rows to delete (0 = all matching)', default: 0 }
            },
            required: ['table_id', 'filter']
          }
        },

        // ==================== FILE OPERATIONS (6) ====================
        {
          name: 'zerodb_upload_file',
          description: 'Upload file to ZeroDB storage. Use when you need to store a file (base64-encoded) in the project\'s S3-compatible object storage. Supports metadata and virtual folder organization.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              file_name: { type: 'string', description: 'File name' },
              file_content: { type: 'string', description: 'Base64-encoded file content' },
              content_type: { type: 'string', description: 'MIME type', default: 'application/octet-stream' },
              metadata: { type: 'object', description: 'File metadata' },
              folder: { type: 'string', description: 'Virtual folder path' }
            },
            required: ['file_name', 'file_content']
          }
        },
        {
          name: 'zerodb_download_file',
          description: 'Download file from ZeroDB storage. Use when you need to retrieve a previously uploaded file by its ID. Returns base64-encoded content by default.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              file_id: { type: 'string', description: 'File ID to download' },
              return_base64: { type: 'boolean', description: 'Return as base64 string', default: true }
            },
            required: ['file_id']
          }
        },
        {
          name: 'zerodb_list_files',
          description: 'List files in project storage. Use when the agent needs to discover available files or answer "what files are stored?". Supports filtering by folder and MIME type with pagination.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              folder: { type: 'string', description: 'Filter by folder path' },
              content_type: { type: 'string', description: 'Filter by MIME type' },
              limit: { type: 'number', description: 'Max results', default: 100 },
              offset: { type: 'number', description: 'Pagination offset', default: 0 }
            },
            required: []
          }
        },
        {
          name: 'zerodb_delete_file',
          description: 'Delete file from storage. Use when a file is no longer needed and should be permanently removed. WARNING: This operation is irreversible.',
          annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              file_id: { type: 'string', description: 'File ID to delete' }
            },
            required: ['file_id']
          }
        },
        {
          name: 'zerodb_get_file_metadata',
          description: 'Get file metadata without downloading content. Use when you need to check a file\'s size, type, upload date, or custom metadata without fetching the actual file data.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              file_id: { type: 'string', description: 'File ID' }
            },
            required: ['file_id']
          }
        },
        {
          name: 'zerodb_generate_presigned_url',
          description: 'Generate presigned URL for file access. Use when you need a temporary URL to share file access with external systems. Supports download and upload operations with configurable expiration.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              file_id: { type: 'string', description: 'File ID' },
              expiration_seconds: { type: 'number', description: 'URL expiration time', default: 3600 },
              operation: { type: 'string', enum: ['download', 'upload'], description: 'URL operation type', default: 'download' }
            },
            required: ['file_id']
          }
        },

        // ==================== EVENT OPERATIONS (5) ====================
        {
          name: 'zerodb_create_event',
          description: 'Create an event in the event stream. Use when you need to publish an event for tracking, auditing, or triggering downstream workflows. Supports event types, payloads, and correlation IDs.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              event_type: { type: 'string', description: 'Event type/category' },
              event_data: { type: 'object', description: 'Event payload data' },
              source: { type: 'string', description: 'Event source identifier' },
              correlation_id: { type: 'string', description: 'Correlation ID for event tracking' }
            },
            required: ['event_type', 'event_data']
          }
        },
        {
          name: 'zerodb_list_events',
          description: 'List events with filtering. Use when you need to browse or query the event stream by type, source, or time range. Supports pagination for large result sets.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              event_type: { type: 'string', description: 'Filter by event type' },
              source: { type: 'string', description: 'Filter by source' },
              start_time: { type: 'string', description: 'ISO timestamp - events after this time' },
              end_time: { type: 'string', description: 'ISO timestamp - events before this time' },
              limit: { type: 'number', description: 'Max results', default: 100 },
              offset: { type: 'number', description: 'Pagination offset', default: 0 }
            },
            required: []
          }
        },
        {
          name: 'zerodb_get_event',
          description: 'Get event details by ID. Use when you need to inspect a specific event\'s full payload, timestamps, and metadata.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              event_id: { type: 'string', description: 'Event ID' }
            },
            required: ['event_id']
          }
        },
        {
          name: 'zerodb_subscribe_events',
          description: 'Subscribe to event stream (returns subscription ID). Use when you need to set up real-time event notifications. Supports filtering by event type and optional webhook delivery.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              event_types: { type: 'array', items: { type: 'string' }, description: 'Event types to subscribe to' },
              filter: { type: 'object', description: 'Event filter criteria' },
              webhook_url: { type: 'string', description: 'Optional webhook URL for events' }
            },
            required: ['event_types']
          }
        },
        {
          name: 'zerodb_event_stats',
          description: 'Get event stream statistics. Use when you need to understand event volume, frequency, and distribution over time. Supports filtering by event type and time range.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              event_type: { type: 'string', description: 'Filter by event type' },
              time_range: { type: 'string', enum: ['hour', 'day', 'week', 'month'], description: 'Statistics time range', default: 'day' }
            },
            required: []
          }
        },

        // ==================== PROJECT OPERATIONS (7) ====================
        {
          name: 'zerodb_create_project',
          description: 'Create a new ZeroDB project. Use when you need to set up a new isolated workspace for storing vectors, tables, files, and events. Projects are the top-level organizational unit.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              project_name: { type: 'string', description: 'Unique project name' },
              description: { type: 'string', description: 'Project description' },
              settings: { type: 'object', description: 'Project settings and configuration' }
            },
            required: ['project_name']
          }
        },
        {
          name: 'zerodb_get_project',
          description: 'Get project details. Use when you need to inspect a project\'s configuration, settings, and enabled features. Uses the configured project ID by default.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string', description: 'Project ID (optional, uses env default if not provided)' }
            },
            required: []
          }
        },
        {
          name: 'zerodb_list_projects',
          description: 'List all accessible projects. Use when the agent needs to discover available projects or answer "what projects do I have access to?". Returns project names, IDs, and basic info.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Max results', default: 100 },
              offset: { type: 'number', description: 'Pagination offset', default: 0 }
            },
            required: []
          }
        },
        {
          name: 'zerodb_update_project',
          description: 'Update project settings. Use when you need to modify a project\'s name, description, or configuration settings.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string', description: 'Project ID' },
              project_name: { type: 'string', description: 'New project name' },
              description: { type: 'string', description: 'New description' },
              settings: { type: 'object', description: 'Updated settings' }
            },
            required: ['project_id']
          }
        },
        {
          name: 'zerodb_delete_project',
          description: 'Delete a project and all its data. Use when a project is no longer needed. Removes all vectors, tables, files, and events within the project. Requires confirm flag. WARNING: This operation is irreversible.',
          annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string', description: 'Project ID to delete' },
              confirm: { type: 'boolean', description: 'Confirmation flag', default: false }
            },
            required: ['project_id', 'confirm']
          }
        },
        {
          name: 'zerodb_get_project_stats',
          description: 'Get project usage statistics. Use when you need to check storage consumption, vector counts, API call volumes, and other usage metrics for a project.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string', description: 'Project ID (optional, uses env default)' },
              include_details: { type: 'boolean', description: 'Include detailed breakdowns', default: true }
            },
            required: []
          }
        },
        {
          name: 'zerodb_enable_database',
          description: 'Enable database features for a project. Use when you need to activate specific capabilities (vectors, compression, nosql, files, events) on a project that does not yet have them enabled.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string', description: 'Project ID' },
              features: {
                type: 'array',
                items: { type: 'string' },
                description: 'Features to enable: vectors, quantum, nosql, files, events'
              }
            },
            required: ['project_id', 'features']
          }
        },

        // ==================== RLHF OPERATIONS (10) ====================
        {
          name: 'zerodb_rlhf_interaction',
          description: 'Collect user interaction for RLHF training. Use when recording a prompt-response pair with optional feedback score for reinforcement learning. Each call creates a new training data point.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              prompt: { type: 'string', description: 'User prompt' },
              response: { type: 'string', description: 'Agent response' },
              feedback: { type: 'number', description: 'User feedback score (-1 to 1)' },
              context: { type: 'object', description: 'Interaction context' },
              agent_id: { type: 'string', description: 'Agent identifier' }
            },
            required: ['prompt', 'response']
          }
        },
        {
          name: 'zerodb_rlhf_agent_feedback',
          description: 'Collect agent-level feedback. Use when recording user satisfaction signals (thumbs up/down, ratings) for a specific agent. Useful for tracking agent quality over time.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              agent_id: { type: 'string', description: 'Agent identifier' },
              feedback_type: { type: 'string', enum: ['thumbs_up', 'thumbs_down', 'rating'], description: 'Feedback type' },
              rating: { type: 'number', description: 'Rating value (1-5 for rating type)' },
              comment: { type: 'string', description: 'Optional feedback comment' },
              context: { type: 'object', description: 'Feedback context' }
            },
            required: ['agent_id', 'feedback_type']
          }
        },
        {
          name: 'zerodb_rlhf_workflow',
          description: 'Collect workflow-level feedback. Use when recording the outcome of a multi-step workflow including success status, duration, and steps completed.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              workflow_id: { type: 'string', description: 'Workflow identifier' },
              success: { type: 'boolean', description: 'Workflow success status' },
              duration_ms: { type: 'number', description: 'Workflow duration in milliseconds' },
              steps_completed: { type: 'number', description: 'Number of steps completed' },
              feedback: { type: 'object', description: 'Detailed workflow feedback' }
            },
            required: ['workflow_id', 'success']
          }
        },
        {
          name: 'zerodb_rlhf_error',
          description: 'Collect error report for RLHF improvement. Use when recording errors encountered during agent operation to improve future behavior. Include sanitized stack traces and severity levels.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              error_type: { type: 'string', description: 'Error type/category' },
              error_message: { type: 'string', description: 'Error message' },
              stack_trace: { type: 'string', description: 'Error stack trace (sanitized)' },
              context: { type: 'object', description: 'Error context' },
              severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'Error severity', default: 'medium' }
            },
            required: ['error_type', 'error_message']
          }
        },
        {
          name: 'zerodb_rlhf_status',
          description: 'Get RLHF collection status. Use when you need to check whether RLHF data collection is active and how many interactions have been recorded for a session.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              session_id: { type: 'string', description: 'Optional session ID filter' }
            },
            required: []
          }
        },
        {
          name: 'zerodb_rlhf_summary',
          description: 'Get RLHF data summary and statistics. Use when you need an overview of collected RLHF data including interaction counts, average feedback scores, and trends over time.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              time_range: { type: 'string', enum: ['hour', 'day', 'week', 'month'], description: 'Summary time range', default: 'day' },
              agent_id: { type: 'string', description: 'Filter by agent' }
            },
            required: []
          }
        },
        {
          name: 'zerodb_rlhf_start',
          description: 'Start RLHF data collection for session. Use when initiating RLHF tracking at the beginning of an agent session. Safe to call multiple times — idempotent for the same session.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              session_id: { type: 'string', description: 'Session identifier' },
              config: { type: 'object', description: 'Collection configuration' }
            },
            required: ['session_id']
          }
        },
        {
          name: 'zerodb_rlhf_stop',
          description: 'Stop RLHF data collection for session. Use when ending RLHF tracking at the end of an agent session. Optionally exports collected data before stopping.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              session_id: { type: 'string', description: 'Session identifier' },
              export_data: { type: 'boolean', description: 'Export collected data', default: false }
            },
            required: ['session_id']
          }
        },
        {
          name: 'zerodb_rlhf_session',
          description: 'Get RLHF interactions for a session. Use when reviewing all recorded interactions within a specific RLHF session for analysis or export.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              session_id: { type: 'string', description: 'Session identifier' },
              limit: { type: 'number', description: 'Max results', default: 100 }
            },
            required: ['session_id']
          }
        },
        {
          name: 'zerodb_rlhf_broadcast',
          description: 'Broadcast RLHF event to subscribers. Use when sending RLHF-related notifications to specific agents or all subscribers. Supports targeted delivery to specific agent IDs.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              event_type: { type: 'string', description: 'Event type' },
              event_data: { type: 'object', description: 'Event payload' },
              target_agents: { type: 'array', items: { type: 'string' }, description: 'Target agent IDs' }
            },
            required: ['event_type', 'event_data']
          }
        },

        // ==================== ADMIN OPERATIONS (5) ====================
        {
          name: 'zerodb_admin_system_stats',
          description: 'Get system-wide statistics (admin only). Use when you need a global view of platform performance and usage metrics. Requires admin privileges.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              include_performance: { type: 'boolean', description: 'Include performance metrics', default: true },
              include_usage: { type: 'boolean', description: 'Include usage metrics', default: true }
            },
            required: []
          }
        },
        {
          name: 'zerodb_admin_list_projects',
          description: 'List all projects system-wide (admin only). Use when you need to see all projects across all users for administrative purposes. Supports filtering by user ID. Requires admin privileges.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              limit: { type: 'number', description: 'Max results', default: 100 },
              offset: { type: 'number', description: 'Pagination offset', default: 0 },
              filter_user: { type: 'string', description: 'Filter by user ID' }
            },
            required: []
          }
        },
        {
          name: 'zerodb_admin_user_usage',
          description: 'Get user usage statistics (admin only). Use when you need to inspect a specific user\'s resource consumption and API usage. Requires admin privileges.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              user_id: { type: 'string', description: 'User ID to query' },
              time_range: { type: 'string', enum: ['hour', 'day', 'week', 'month'], description: 'Statistics time range', default: 'day' }
            },
            required: ['user_id']
          }
        },
        {
          name: 'zerodb_admin_health',
          description: 'Get system health status (admin only). Use when you need to check the health of all system components (database, storage, search). Requires admin privileges.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              include_components: { type: 'boolean', description: 'Include component health', default: true }
            },
            required: []
          }
        },
        {
          name: 'zerodb_admin_optimize',
          description: 'Run database optimization (admin only). Use when the database needs maintenance such as vacuum, reindex, or analyze operations. Supports dry_run to preview changes. Requires admin privileges.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              optimization_type: { type: 'string', enum: ['vacuum', 'reindex', 'analyze'], description: 'Optimization type' },
              project_id: { type: 'string', description: 'Optional project ID to optimize' },
              dry_run: { type: 'boolean', description: 'Preview without applying', default: false }
            },
            required: ['optimization_type']
          }
        },

        // ==================== POSTGRESQL OPERATIONS (6) ====================
        {
          name: 'zerodb_postgres_query',
          description: 'Execute SQL query on provisioned PostgreSQL instance with security validations. Use when you need to run arbitrary SQL (SELECT, INSERT, UPDATE, DELETE) against the dedicated PostgreSQL database. Supports parameterized queries and read-only mode enforcement.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              sql: { type: 'string', description: 'SQL query to execute' },
              params: { type: 'array', items: { type: 'string' }, description: 'Query parameters for prepared statements' },
              read_only: { type: 'boolean', description: 'Enforce read-only mode (SELECT only)', default: false },
              timeout_seconds: { type: 'number', description: 'Query timeout in seconds', default: 30 },
              max_rows: { type: 'number', description: 'Maximum rows to return', default: 1000 }
            },
            required: ['sql']
          }
        },
        {
          name: 'zerodb_postgres_schema_info',
          description: 'Get database schema information (tables, columns, indexes). Use when you need to discover or inspect the PostgreSQL schema structure. Returns table definitions, column types, indexes, and constraints.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              table_name: { type: 'string', description: 'Optional: specific table to inspect' },
              include_indexes: { type: 'boolean', description: 'Include index information', default: true },
              include_constraints: { type: 'boolean', description: 'Include constraint information', default: true },
              include_stats: { type: 'boolean', description: 'Include table statistics', default: false }
            },
            required: []
          }
        },
        {
          name: 'zerodb_postgres_create_table',
          description: 'Create new PostgreSQL table with schema definition. Use when you need to define a new relational table with typed columns, constraints, and indexes. Supports if_not_exists for idempotent creation.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              table_name: { type: 'string', description: 'Name of the table to create' },
              columns: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'Column name' },
                    type: { type: 'string', description: 'Column type (e.g., VARCHAR(255), INTEGER, TIMESTAMP)' },
                    nullable: { type: 'boolean', description: 'Allow NULL values', default: true },
                    primary_key: { type: 'boolean', description: 'Is primary key', default: false },
                    unique: { type: 'boolean', description: 'Unique constraint', default: false },
                    default: { type: 'string', description: 'Default value' }
                  },
                  required: ['name', 'type']
                },
                description: 'Column definitions'
              },
              indexes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'Index name' },
                    columns: { type: 'array', items: { type: 'string' }, description: 'Columns to index' },
                    unique: { type: 'boolean', description: 'Unique index', default: false }
                  },
                  required: ['columns']
                },
                description: 'Index definitions'
              },
              if_not_exists: { type: 'boolean', description: 'Only create if table does not exist', default: true }
            },
            required: ['table_name', 'columns']
          }
        },
        {
          name: 'zerodb_postgres_backup',
          description: 'Trigger PostgreSQL backup job. Use when you need to create a point-in-time backup of the database. Supports full and incremental backups with configurable retention and compression.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              backup_type: { type: 'string', enum: ['full', 'incremental'], description: 'Backup type', default: 'full' },
              retention_days: { type: 'number', description: 'Backup retention in days', default: 7 },
              compression: { type: 'boolean', description: 'Compress backup', default: true },
              include_schema: { type: 'boolean', description: 'Include schema definition', default: true },
              include_data: { type: 'boolean', description: 'Include table data', default: true }
            },
            required: []
          }
        },
        {
          name: 'zerodb_postgres_restore',
          description: 'Restore PostgreSQL database from backup. Use when you need to recover data from a previous backup. Supports full, schema-only, and data-only restore types. WARNING: This operation is irreversible — it overwrites existing data when confirm_overwrite is true.',
          annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              backup_id: { type: 'string', description: 'Backup ID to restore from' },
              restore_type: { type: 'string', enum: ['full', 'schema_only', 'data_only'], description: 'Restore type', default: 'full' },
              target_database: { type: 'string', description: 'Optional: restore to different database name' },
              confirm_overwrite: { type: 'boolean', description: 'Confirm overwrite of existing data', default: false }
            },
            required: ['backup_id', 'confirm_overwrite']
          }
        },
        {
          name: 'zerodb_postgres_stats',
          description: 'Get PostgreSQL database statistics (size, connections, query performance). Use when you need to monitor database health, connection pool usage, storage consumption, and query performance metrics.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              include_connections: { type: 'boolean', description: 'Include connection statistics', default: true },
              include_queries: { type: 'boolean', description: 'Include query performance stats', default: true },
              include_storage: { type: 'boolean', description: 'Include storage statistics', default: true },
              include_replication: { type: 'boolean', description: 'Include replication stats', default: false },
              time_range: { type: 'string', enum: ['hour', 'day', 'week', 'month'], description: 'Statistics time range', default: 'day' }
            },
            required: []
          }
        },

        // ==================== DEDICATED POSTGRESQL MANAGEMENT (7) ====================
        {
          name: 'zerodb_provision_postgres',
          description: 'Provision a dedicated PostgreSQL instance via Railway with dedicated resources. Use when you need to spin up a new managed PostgreSQL database. Choose instance size based on workload requirements and budget.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string', description: 'ZeroDB project ID' },
              instance_size: {
                type: 'string',
                enum: ['micro-1', 'standard-2', 'standard-4', 'performance-8', 'performance-16'],
                description: 'Instance size: micro-1 ($5/mo), standard-2 ($10/mo), standard-4 ($25/mo), performance-8 ($50/mo), performance-16 ($100/mo)',
                default: 'micro-1'
              },
              postgres_version: {
                type: 'string',
                enum: ['13', '14', '15'],
                description: 'PostgreSQL version',
                default: '15'
              },
              tags: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional tags for organization',
                default: []
              }
            },
            required: ['project_id', 'instance_size']
          }
        },
        {
          name: 'zerodb_get_postgres_status',
          description: 'Get status and health metrics for dedicated PostgreSQL instance. Use when you need to check if your PostgreSQL instance is running, its uptime, and health indicators.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string', description: 'ZeroDB project ID' }
            },
            required: ['project_id']
          }
        },
        {
          name: 'zerodb_get_postgres_connection',
          description: 'Get connection credentials for PostgreSQL instance (database_url, host, port, etc.). Use when you need connection details to configure applications or tools. Supports primary, readonly, and admin credential types.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string', description: 'ZeroDB project ID' },
              credential_type: {
                type: 'string',
                enum: ['primary', 'readonly', 'admin'],
                description: 'Type of credentials to retrieve',
                default: 'primary'
              }
            },
            required: ['project_id']
          }
        },
        {
          name: 'zerodb_get_postgres_usage',
          description: 'Get usage statistics and billing information for PostgreSQL instance. Use when you need to review compute usage, storage consumption, and cost breakdown for your dedicated instance.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string', description: 'ZeroDB project ID' },
              hours: {
                type: 'number',
                description: 'Time range in hours for statistics (default: 24)',
                default: 24
              }
            },
            required: ['project_id']
          }
        },
        {
          name: 'zerodb_get_postgres_logs',
          description: 'Get SQL query logs with performance metrics and credit consumption. Use when you need to audit queries, debug slow operations, or review credit usage. Supports filtering by query type.',
          annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string', description: 'ZeroDB project ID' },
              limit: {
                type: 'number',
                description: 'Maximum number of log entries to return (default: 100)',
                default: 100
              },
              query_type: {
                type: 'string',
                enum: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
                description: 'Optional: filter by query type'
              }
            },
            required: ['project_id']
          }
        },
        {
          name: 'zerodb_restart_postgres',
          description: 'Restart the dedicated PostgreSQL instance (completes in 30-60 seconds). Use when the instance needs a restart due to configuration changes or performance issues. Does not lose data.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string', description: 'ZeroDB project ID' }
            },
            required: ['project_id']
          }
        },
        {
          name: 'zerodb_delete_postgres',
          description: 'Delete the PostgreSQL instance and all data (requires confirmation). Use when the instance is no longer needed. Requires confirm=true. WARNING: This operation is irreversible.',
          annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {
              project_id: { type: 'string', description: 'ZeroDB project ID' },
              confirm: {
                type: 'boolean',
                description: 'Must be true to confirm deletion and data loss'
              }
            },
            required: ['project_id', 'confirm']
          }
        },

        // ==================== UTILITY OPERATIONS (1) ====================
        {
          name: 'zerodb_renew_token',
          description: 'Manually renew authentication token. Use when the current auth token has expired or is about to expire and you need to force a refresh before the next API call.',
          annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      ]
    }))
  }

  // Extracted routing logic for testability
  async routeToolCall (name, args) {
    switch (name) {
      // Embedding Operations
      case 'zerodb_generate_embeddings':
        return await this.executeOperation('generate_embeddings', args)
      case 'zerodb_embed_and_store':
        return await this.executeOperation('embed_and_store', args)
      case 'zerodb_semantic_search':
        return await this.executeOperation('semantic_search', args)

      // Memory Operations
      case 'zerodb_store_memory':
        return await this.executeOperation('store_memory', args)
      case 'zerodb_search_memory':
        return await this.executeOperation('search_memory', args)
      case 'zerodb_get_context':
        return await this.executeOperation('get_context', args)

        // Vector Operations
      case 'zerodb_upsert_vector':
        return await this.executeOperation('upsert_vector', args)
      case 'zerodb_batch_upsert_vectors':
        return await this.executeOperation('batch_upsert_vectors', args)
      case 'zerodb_search_vectors':
        return await this.executeOperation('search_vectors', args)
      case 'zerodb_delete_vector':
        return await this.executeOperation('delete_vector', args)
      case 'zerodb_get_vector':
        return await this.executeOperation('get_vector', args)
      case 'zerodb_list_vectors':
        return await this.executeOperation('list_vectors', args)
      case 'zerodb_vector_stats':
        return await this.executeOperation('vector_stats', args)
      case 'zerodb_create_vector_index':
        return await this.executeOperation('create_vector_index', args)
      case 'zerodb_optimize_vectors':
        return await this.executeOperation('optimize_vector_storage', args)
      case 'zerodb_export_vectors':
        return await this.executeOperation('export_vectors', args)

        // Vector Compression Operations (TurboQuant)
      case 'zerodb_quantum_compress':
        return await this.executeOperation('quantum_compress_vector', args)
      case 'zerodb_quantum_decompress':
        return await this.executeOperation('quantum_decompress_vector', args)
      case 'zerodb_quantum_hybrid_search':
        return await this.executeOperation('quantum_hybrid_similarity', args)
      case 'zerodb_quantum_optimize':
        return await this.executeOperation('quantum_optimize_space', args)
      case 'zerodb_quantum_feature_map':
        return await this.executeOperation('quantum_feature_map', args)
      case 'zerodb_quantum_kernel':
        return await this.executeOperation('quantum_kernel_similarity', args)

        // Table Operations
      case 'zerodb_create_table':
        return await this.executeOperation('create_table', args)
      case 'zerodb_list_tables':
        return await this.executeOperation('list_tables', args)
      case 'zerodb_get_table':
        return await this.executeOperation('get_table', args)
      case 'zerodb_delete_table':
        return await this.executeOperation('delete_table', args)
      case 'zerodb_insert_rows':
        return await this.executeOperation('insert_rows', args)
      case 'zerodb_query_rows':
        return await this.executeOperation('query_rows', args)
      case 'zerodb_update_rows':
        return await this.executeOperation('update_rows', args)
      case 'zerodb_delete_rows':
        return await this.executeOperation('delete_rows', args)

        // File Operations
      case 'zerodb_upload_file':
        return await this.executeOperation('upload_file', args)
      case 'zerodb_download_file':
        return await this.executeOperation('download_file', args)
      case 'zerodb_list_files':
        return await this.executeOperation('list_files', args)
      case 'zerodb_delete_file':
        return await this.executeOperation('delete_file', args)
      case 'zerodb_get_file_metadata':
        return await this.executeOperation('get_file_metadata', args)
      case 'zerodb_generate_presigned_url':
        return await this.executeOperation('generate_presigned_url', args)

        // Event Operations
      case 'zerodb_create_event':
        return await this.executeOperation('create_event', args)
      case 'zerodb_list_events':
        return await this.executeOperation('list_events', args)
      case 'zerodb_get_event':
        return await this.executeOperation('get_event', args)
      case 'zerodb_subscribe_events':
        return await this.executeOperation('subscribe_to_events', args)
      case 'zerodb_event_stats':
        return await this.executeOperation('event_stats', args)

        // Project Operations
      case 'zerodb_create_project':
        return await this.executeOperation('create_project', args)
      case 'zerodb_get_project':
        return await this.executeOperation('get_project', args)
      case 'zerodb_list_projects':
        return await this.executeOperation('list_projects', args)
      case 'zerodb_update_project':
        return await this.executeOperation('update_project', args)
      case 'zerodb_delete_project':
        return await this.executeOperation('delete_project', args)
      case 'zerodb_get_project_stats':
        return await this.executeOperation('get_project_stats', args)
      case 'zerodb_enable_database':
        return await this.executeOperation('enable_database', args)

        // RLHF Operations
      case 'zerodb_rlhf_interaction':
        return await this.executeOperation('rlhf_collect_interaction', args)
      case 'zerodb_rlhf_agent_feedback':
        return await this.executeOperation('rlhf_collect_agent_feedback', args)
      case 'zerodb_rlhf_workflow':
        return await this.executeOperation('rlhf_collect_workflow_feedback', args)
      case 'zerodb_rlhf_error':
        return await this.executeOperation('rlhf_collect_error_report', args)
      case 'zerodb_rlhf_status':
        return await this.executeOperation('rlhf_get_status', args)
      case 'zerodb_rlhf_summary':
        return await this.executeOperation('rlhf_get_summary', args)
      case 'zerodb_rlhf_start':
        return await this.executeOperation('rlhf_start_collection', args)
      case 'zerodb_rlhf_stop':
        return await this.executeOperation('rlhf_stop_collection', args)
      case 'zerodb_rlhf_session':
        return await this.executeOperation('rlhf_get_session_interactions', args)
      case 'zerodb_rlhf_broadcast':
        return await this.executeOperation('rlhf_broadcast_event', args)

        // Admin Operations
      case 'zerodb_admin_system_stats':
        return await this.executeOperation('admin_get_system_stats', args)
      case 'zerodb_admin_list_projects':
        return await this.executeOperation('admin_list_all_projects', args)
      case 'zerodb_admin_user_usage':
        return await this.executeOperation('admin_get_user_usage', args)
      case 'zerodb_admin_health':
        return await this.executeOperation('admin_system_health', args)
      case 'zerodb_admin_optimize':
        return await this.executeOperation('admin_optimize_database', args)

        // PostgreSQL Operations
      case 'zerodb_postgres_query':
        return await this.executeOperation('postgres_query', args)
      case 'zerodb_postgres_schema_info':
        return await this.executeOperation('postgres_schema_info', args)
      case 'zerodb_postgres_create_table':
        return await this.executeOperation('postgres_create_table', args)
      case 'zerodb_postgres_backup':
        return await this.executeOperation('postgres_backup', args)
      case 'zerodb_postgres_restore':
        return await this.executeOperation('postgres_restore', args)
      case 'zerodb_postgres_stats':
        return await this.executeOperation('postgres_stats', args)

        // Dedicated PostgreSQL Management Operations
      case 'zerodb_provision_postgres':
        return await this.provisionPostgres(args)
      case 'zerodb_get_postgres_status':
        return await this.getPostgresStatus(args)
      case 'zerodb_get_postgres_connection':
        return await this.getPostgresConnection(args)
      case 'zerodb_get_postgres_usage':
        return await this.getPostgresUsage(args)
      case 'zerodb_get_postgres_logs':
        return await this.getPostgresLogs(args)
      case 'zerodb_restart_postgres':
        return await this.restartPostgres(args)
      case 'zerodb_delete_postgres':
        return await this.deletePostgres(args)

        // Utility Operations
      case 'zerodb_renew_token':
        return await this.manualTokenRenewal()

      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  }

  setupHandlers () {
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params

      try {
        // Check token expiry before each request
        await this.ensureValidToken()

        // Route to appropriate handler
        return await this.routeToolCall(name, args)
      } catch (error) {
        console.error(`Error executing ${name}:`, error.message)
        return {
          content: [{
            type: 'text',
            text: `Error executing ${name}: ${error.message}`
          }],
          isError: true
        }
      }
    })
  }

  /**
   * Execute an operation through the unified MCP execute endpoint
   * @param {string} operation - Backend operation name (e.g., 'upsert_vector')
   * @param {object} params - Operation parameters
   * @returns {object} MCP response
   */
  async executeOperation (operation, params) {
    try {
      // Add project_id to params if not present and we have one
      if (!params.project_id && this.projectId) {
        params.project_id = this.projectId
      }

      console.error(`Executing operation: ${operation}`)

      const response = await axios.post(
        `${this.apiUrl}/v1/public/mcp`,
        {
          operation,
          params
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 second timeout for operations
        }
      )

      // Check if operation was successful
      if (response.data.success) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(response.data.result, null, 2)
          }]
        }
      } else {
        return {
          content: [{
            type: 'text',
            text: `Operation failed: ${JSON.stringify(response.data.error, null, 2)}`
          }],
          isError: true
        }
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error?.message || error.message
      const errorDetails = error.response?.data?.error?.details || ''

      console.error(`Operation ${operation} failed:`, errorMsg)

      return {
        content: [{
          type: 'text',
          text: `Error executing ${operation}: ${errorMsg}${errorDetails ? '\nDetails: ' + JSON.stringify(errorDetails) : ''}`
        }],
        isError: true
      }
    }
  }

  async ensureValidToken () {
    // Skip renewal for static API tokens
    if (this.useStaticToken && this.apiToken) {
      return
    }
    // Check if token needs renewal (5 minutes before expiry)
    if (!this.apiToken || !this.tokenExpiry || Date.now() > (this.tokenExpiry - 5 * 60 * 1000)) {
      await this.renewToken()
    }
  }

  async renewToken () {
    try {
      console.error('Renewing authentication token...')

      const response = await axios.post(
        `${this.apiUrl}/v1/auth/login`,
        {
          email: this.username,
          password: this.password
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000 // 10 second timeout
        }
      )

      if (response.data && response.data.access_token) {
        this.apiToken = response.data.access_token
        this.tokenExpiry = Date.now() + ((response.data.expires_in || 1800) * 1000) // Default 30 minutes
        console.error('Token renewed successfully')
        return true
      } else {
        throw new Error('Invalid response format: missing access_token')
      }
    } catch (error) {
      // Security: Don't log full error response which may contain sensitive data
      const safeError = error.response?.status ? `HTTP ${error.response.status}` : error.message
      console.error('Token renewal failed:', safeError)
      throw new Error(`Authentication failed: ${error.response?.status === 401 ? 'Invalid credentials' : 'Connection error'}`)
    }
  }

  async manualTokenRenewal () {
    try {
      await this.renewToken()
      return {
        content: [{
          type: 'text',
          text: `Token renewed successfully. Expires at: ${new Date(this.tokenExpiry).toISOString()}`
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Token renewal failed: ${error.message}`
        }],
        isError: true
      }
    }
  }

  setupTokenRenewal () {
    // Skip scheduled renewal for static API tokens
    if (this.useStaticToken) return
    // Renew token every 25 minutes (tokens expire after 30 minutes)
    setInterval(async () => {
      try {
        await this.renewToken()
      } catch (error) {
        console.error('Automatic token renewal failed:', error.message)
      }
    }, 25 * 60 * 1000)
  }

  // ==================== DEDICATED POSTGRESQL MANAGEMENT METHODS ====================

  /**
   * Provision a dedicated PostgreSQL instance
   */
  async provisionPostgres (args) {
    try {
      const { project_id, instance_size, postgres_version = '15', tags = [] } = args

      if (!project_id) {
        throw new Error('project_id is required')
      }

      console.error(`Provisioning PostgreSQL instance for project ${project_id}...`)

      const response = await axios.post(
        `${this.apiUrl}/v1/projects/${project_id}/postgres`,
        {
          instance_size,
          postgres_version,
          tags
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      )

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response.data, null, 2)
        }]
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.response?.data?.message || error.message
      console.error('PostgreSQL provisioning failed:', errorMsg)

      return {
        content: [{
          type: 'text',
          text: `Error provisioning PostgreSQL: ${errorMsg}`
        }],
        isError: true
      }
    }
  }

  /**
   * Get PostgreSQL instance status
   */
  async getPostgresStatus (args) {
    try {
      const { project_id } = args

      if (!project_id) {
        throw new Error('project_id is required')
      }

      console.error(`Getting PostgreSQL status for project ${project_id}...`)

      const response = await axios.get(
        `${this.apiUrl}/v1/projects/${project_id}/postgres`,
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`
          },
          timeout: 30000
        }
      )

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response.data, null, 2)
        }]
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.response?.data?.message || error.message
      console.error('Get PostgreSQL status failed:', errorMsg)

      return {
        content: [{
          type: 'text',
          text: `Error getting PostgreSQL status: ${errorMsg}`
        }],
        isError: true
      }
    }
  }

  /**
   * Get PostgreSQL connection credentials
   */
  async getPostgresConnection (args) {
    try {
      const { project_id, credential_type = 'primary' } = args

      if (!project_id) {
        throw new Error('project_id is required')
      }

      console.error(`Getting PostgreSQL connection for project ${project_id}...`)

      const response = await axios.get(
        `${this.apiUrl}/v1/projects/${project_id}/postgres/connection`,
        {
          params: { credential_type },
          headers: {
            Authorization: `Bearer ${this.apiToken}`
          },
          timeout: 30000
        }
      )

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response.data, null, 2)
        }]
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.response?.data?.message || error.message
      console.error('Get PostgreSQL connection failed:', errorMsg)

      return {
        content: [{
          type: 'text',
          text: `Error getting PostgreSQL connection: ${errorMsg}`
        }],
        isError: true
      }
    }
  }

  /**
   * Get PostgreSQL usage statistics
   */
  async getPostgresUsage (args) {
    try {
      const { project_id, hours = 24 } = args

      if (!project_id) {
        throw new Error('project_id is required')
      }

      console.error(`Getting PostgreSQL usage for project ${project_id}...`)

      const response = await axios.get(
        `${this.apiUrl}/v1/projects/${project_id}/postgres/usage`,
        {
          params: { hours },
          headers: {
            Authorization: `Bearer ${this.apiToken}`
          },
          timeout: 30000
        }
      )

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response.data, null, 2)
        }]
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.response?.data?.message || error.message
      console.error('Get PostgreSQL usage failed:', errorMsg)

      return {
        content: [{
          type: 'text',
          text: `Error getting PostgreSQL usage: ${errorMsg}`
        }],
        isError: true
      }
    }
  }

  /**
   * Get PostgreSQL query logs
   */
  async getPostgresLogs (args) {
    try {
      const { project_id, limit = 100, query_type } = args

      if (!project_id) {
        throw new Error('project_id is required')
      }

      console.error(`Getting PostgreSQL logs for project ${project_id}...`)

      const params = { limit }
      if (query_type) {
        params.query_type = query_type
      }

      const response = await axios.get(
        `${this.apiUrl}/v1/projects/${project_id}/postgres/logs`,
        {
          params,
          headers: {
            Authorization: `Bearer ${this.apiToken}`
          },
          timeout: 30000
        }
      )

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response.data, null, 2)
        }]
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.response?.data?.message || error.message
      console.error('Get PostgreSQL logs failed:', errorMsg)

      return {
        content: [{
          type: 'text',
          text: `Error getting PostgreSQL logs: ${errorMsg}`
        }],
        isError: true
      }
    }
  }

  /**
   * Restart PostgreSQL instance
   */
  async restartPostgres (args) {
    try {
      const { project_id } = args

      if (!project_id) {
        throw new Error('project_id is required')
      }

      console.error(`Restarting PostgreSQL instance for project ${project_id}...`)

      const response = await axios.post(
        `${this.apiUrl}/v1/projects/${project_id}/postgres/restart`,
        {},
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000 // 60 second timeout for restart
        }
      )

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response.data, null, 2)
        }]
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.response?.data?.message || error.message
      console.error('PostgreSQL restart failed:', errorMsg)

      return {
        content: [{
          type: 'text',
          text: `Error restarting PostgreSQL: ${errorMsg}`
        }],
        isError: true
      }
    }
  }

  /**
   * Delete PostgreSQL instance
   */
  async deletePostgres (args) {
    try {
      const { project_id, confirm } = args

      if (!project_id) {
        throw new Error('project_id is required')
      }

      if (!confirm) {
        throw new Error('confirm must be true to delete PostgreSQL instance and all data')
      }

      console.error(`Deleting PostgreSQL instance for project ${project_id}...`)

      const response = await axios.delete(
        `${this.apiUrl}/v1/projects/${project_id}/postgres`,
        {
          headers: {
            Authorization: `Bearer ${this.apiToken}`
          },
          timeout: 30000
        }
      )

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response.data, null, 2)
        }]
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.response?.data?.message || error.message
      console.error('PostgreSQL deletion failed:', errorMsg)

      return {
        content: [{
          type: 'text',
          text: `Error deleting PostgreSQL: ${errorMsg}`
        }],
        isError: true
      }
    }
  }

  async start () {
    try {
      // Initial token acquisition
      if (!this.apiToken) {
        await this.renewToken()
      }

      const transport = new StdioServerTransport()
      await this.server.connect(transport)
      console.error('ZeroDB MCP Server v2.3.0 running on stdio')
      console.error(`API URL: ${this.apiUrl}`)
      console.error(`Project ID: ${this.projectId}`)
      console.error('Operations: 77 (includes 7 dedicated PostgreSQL management tools, all annotated with MCP hints)')
      if (this.useStaticToken) {
        console.error('\u2705 Auth: API key (recommended)')
      } else {
        console.error('\u26a0\ufe0f  Auth: Username/password (deprecated \u2014 switch to API key)')
      }
      console.error(`Token expires: ${this.tokenExpiry ? new Date(this.tokenExpiry).toISOString() : 'Unknown'}`)
    } catch (error) {
      console.error('Failed to start ZeroDB MCP Server:', error.message)
      process.exit(1)
    }
  }
}

// Start the server
if (require.main === module) {
  const server = new ZeroDBMCPServer()
  server.start().catch(console.error)
}

module.exports = ZeroDBMCPServer
