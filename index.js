#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js')
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js')
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js')
const axios = require('axios')

/**
 * ZeroDB MCP Server v2.0.8
 *
 * Complete implementation with ALL 60 operations across 9 categories:
 * - Vector Operations (10): upsert, batch_upsert, search, delete, get, list, stats, create_index, optimize, export
 * - Quantum Operations (6): compress, decompress, hybrid_similarity, optimize_space, feature_map, kernel_similarity
 * - Table Operations (8): create_table, list_tables, get_table, delete_table, insert_rows, query_rows, update_rows, delete_rows
 * - File Operations (6): upload_file, download_file, list_files, delete_file, get_file_metadata, generate_presigned_url
 * - Event Operations (5): create_event, list_events, get_event, subscribe_to_events, event_stats
 * - Project Operations (7): create_project, get_project, list_projects, update_project, delete_project, get_project_stats, enable_database
 * - RLHF Operations (10): collect_interaction, agent_feedback, workflow_feedback, error_report, get_status, get_summary, start_collection, stop_collection, session_interactions, broadcast_event
 * - Memory Operations (3): store_memory, search_memory, get_context
 * - Admin Operations (5): system_stats, list_all_projects, user_usage, system_health, optimize_database
 */

class ZeroDBMCPServer {
  constructor () {
    this.apiUrl = process.env.ZERODB_API_URL || 'https://api.ainative.studio'
    this.projectId = process.env.ZERODB_PROJECT_ID
    this.apiToken = process.env.ZERODB_API_TOKEN
    this.username = process.env.ZERODB_USERNAME
    this.password = process.env.ZERODB_PASSWORD
    this.contextWindow = parseInt(process.env.MCP_CONTEXT_WINDOW || '8192')
    this.retentionDays = parseInt(process.env.MCP_RETENTION_DAYS || '30')
    this.tokenExpiry = null

    // Security: Validate required credentials
    if (!this.username || !this.password) {
      throw new Error('SECURITY ERROR: ZERODB_USERNAME and ZERODB_PASSWORD environment variables are required. Do not hardcode credentials.')
    }

    this.server = new Server(
      {
        name: 'zerodb-mcp',
        version: '2.0.8'
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

  setupTools () {
    // Define ALL 60 MCP tools for ZeroDB integration
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // ==================== MEMORY OPERATIONS (3) ====================
        {
          name: 'zerodb_store_memory',
          description: 'Store agent memory in ZeroDB for persistent context',
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
          description: 'Search agent memory using semantic similarity',
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
          description: 'Get agent context window for current session',
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
          description: 'Store or update a vector embedding with metadata (1536 dimensions)',
          inputSchema: {
            type: 'object',
            properties: {
              vector_embedding: {
                type: 'array',
                items: { type: 'number' },
                description: 'Vector embedding (exactly 1536 dimensions required)',
                minItems: 1536,
                maxItems: 1536
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
          description: 'Batch upsert multiple vectors for efficiency',
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
          description: 'Search vectors using semantic similarity',
          inputSchema: {
            type: 'object',
            properties: {
              query_vector: {
                type: 'array',
                items: { type: 'number' },
                description: 'Query vector (exactly 1536 dimensions required)',
                minItems: 1536,
                maxItems: 1536
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
          description: 'Delete a specific vector by ID',
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
          description: 'Retrieve a specific vector by ID',
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
          description: 'List vectors in a project/namespace with pagination',
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
          description: 'Get vector statistics for a project',
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
          description: 'Create optimized index for vector search',
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
          description: 'Optimize vector storage for better performance',
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
          description: 'Export vectors to various formats (JSON, CSV, Parquet)',
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

        // ==================== QUANTUM OPERATIONS (6) ====================
        {
          name: 'zerodb_quantum_compress',
          description: 'Apply quantum-inspired compression to vector (reduces dimensionality)',
          inputSchema: {
            type: 'object',
            properties: {
              vector_embedding: { type: 'array', items: { type: 'number' }, description: 'Vector to compress' },
              compression_ratio: { type: 'number', description: 'Target compression ratio (0.0-1.0)', default: 0.5 },
              preserve_similarity: { type: 'boolean', description: 'Preserve similarity relationships', default: true }
            },
            required: ['vector_embedding']
          }
        },
        {
          name: 'zerodb_quantum_decompress',
          description: 'Decompress quantum-compressed vector back to original dimensions',
          inputSchema: {
            type: 'object',
            properties: {
              compressed_vector: { type: 'array', items: { type: 'number' }, description: 'Compressed vector' },
              original_dimensions: { type: 'number', description: 'Original vector dimensions', default: 1536 },
              compression_metadata: { type: 'object', description: 'Compression metadata from compress operation' }
            },
            required: ['compressed_vector']
          }
        },
        {
          name: 'zerodb_quantum_hybrid_search',
          description: 'Hybrid similarity search using quantum enhancement',
          inputSchema: {
            type: 'object',
            properties: {
              query_vector: { type: 'array', items: { type: 'number' }, description: 'Query vector' },
              namespace: { type: 'string', description: 'Vector namespace' },
              quantum_weight: { type: 'number', description: 'Quantum similarity weight (0.0-1.0)', default: 0.3 },
              classical_weight: { type: 'number', description: 'Classical similarity weight (0.0-1.0)', default: 0.7 },
              limit: { type: 'number', description: 'Max results', default: 10 }
            },
            required: ['query_vector']
          }
        },
        {
          name: 'zerodb_quantum_optimize',
          description: 'Optimize quantum circuits for project vectors',
          inputSchema: {
            type: 'object',
            properties: {
              namespace: { type: 'string', description: 'Namespace to optimize' },
              optimization_level: { type: 'number', description: 'Optimization level (1-3)', default: 2 },
              target_backend: { type: 'string', enum: ['simulator', 'ionq', 'rigetti'], description: 'Target quantum backend', default: 'simulator' }
            },
            required: []
          }
        },
        {
          name: 'zerodb_quantum_feature_map',
          description: 'Apply quantum feature mapping to vector',
          inputSchema: {
            type: 'object',
            properties: {
              vector_embedding: { type: 'array', items: { type: 'number' }, description: 'Input vector' },
              feature_map_type: { type: 'string', enum: ['zz', 'pauli', 'custom'], description: 'Feature map type', default: 'zz' },
              num_qubits: { type: 'number', description: 'Number of qubits to use', default: 10 },
              reps: { type: 'number', description: 'Number of repetitions', default: 2 }
            },
            required: ['vector_embedding']
          }
        },
        {
          name: 'zerodb_quantum_kernel',
          description: 'Calculate quantum kernel similarity between vectors',
          inputSchema: {
            type: 'object',
            properties: {
              vector_a: { type: 'array', items: { type: 'number' }, description: 'First vector' },
              vector_b: { type: 'array', items: { type: 'number' }, description: 'Second vector' },
              kernel_type: { type: 'string', enum: ['fidelity', 'swap_test'], description: 'Kernel type', default: 'fidelity' },
              shots: { type: 'number', description: 'Number of quantum shots', default: 1024 }
            },
            required: ['vector_a', 'vector_b']
          }
        },

        // ==================== TABLE/NoSQL OPERATIONS (8) ====================
        {
          name: 'zerodb_create_table',
          description: 'Create a new NoSQL table with schema',
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
          description: 'List all tables in the project',
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
          description: 'Get table details and schema',
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
          description: 'Delete a table and all its data',
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
          description: 'Insert rows into a table',
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
          description: 'Query rows from a table with filters',
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
          description: 'Update rows in a table',
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
          description: 'Delete rows from a table',
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
          description: 'Upload file to ZeroDB storage',
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
          description: 'Download file from ZeroDB storage',
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
          description: 'List files in project storage',
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
          description: 'Delete file from storage',
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
          description: 'Get file metadata without downloading content',
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
          description: 'Generate presigned URL for file access',
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
          description: 'Create an event in the event stream',
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
          description: 'List events with filtering',
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
          description: 'Get event details by ID',
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
          description: 'Subscribe to event stream (returns subscription ID)',
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
          description: 'Get event stream statistics',
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
          description: 'Create a new ZeroDB project',
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
          description: 'Get project details',
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
          description: 'List all accessible projects',
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
          description: 'Update project settings',
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
          description: 'Delete a project and all its data',
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
          description: 'Get project usage statistics',
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
          description: 'Enable database features for a project',
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
          description: 'Collect user interaction for RLHF training',
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
          description: 'Collect agent-level feedback',
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
          description: 'Collect workflow-level feedback',
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
          description: 'Collect error report for RLHF improvement',
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
          description: 'Get RLHF collection status',
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
          description: 'Get RLHF data summary and statistics',
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
          description: 'Start RLHF data collection for session',
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
          description: 'Stop RLHF data collection for session',
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
          description: 'Get RLHF interactions for a session',
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
          description: 'Broadcast RLHF event to subscribers',
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
          description: 'Get system-wide statistics (admin only)',
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
          description: 'List all projects system-wide (admin only)',
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
          description: 'Get user usage statistics (admin only)',
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
          description: 'Get system health status (admin only)',
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
          description: 'Run database optimization (admin only)',
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

        // ==================== UTILITY OPERATIONS (1) ====================
        {
          name: 'zerodb_renew_token',
          description: 'Manually renew authentication token',
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

        // Quantum Operations
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
        `${this.apiUrl}/v1/public/zerodb/mcp/execute`,
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
    // Check if token needs renewal (5 minutes before expiry)
    if (!this.apiToken || !this.tokenExpiry || Date.now() > (this.tokenExpiry - 5 * 60 * 1000)) {
      await this.renewToken()
    }
  }

  async renewToken () {
    try {
      console.error('Renewing authentication token...')

      const response = await axios.post(
        `${this.apiUrl}/v1/public/auth/login-json`,
        {
          username: this.username,
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
    // Renew token every 25 minutes (tokens expire after 30 minutes)
    setInterval(async () => {
      try {
        await this.renewToken()
      } catch (error) {
        console.error('Automatic token renewal failed:', error.message)
      }
    }, 25 * 60 * 1000)
  }

  async start () {
    try {
      // Initial token acquisition
      if (!this.apiToken) {
        await this.renewToken()
      }

      const transport = new StdioServerTransport()
      await this.server.connect(transport)
      console.error('ZeroDB MCP Server v2.0.8 running on stdio')
      console.error(`API URL: ${this.apiUrl}`)
      console.error(`Project ID: ${this.projectId}`)
      console.error('Operations: 60 (100% coverage)')
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
