# ZeroDB MCP Server v2.0.6

[![npm version](https://img.shields.io/npm/v/ainative-zerodb-mcp-server.svg)](https://www.npmjs.com/package/ainative-zerodb-mcp-server)
[![npm downloads](https://img.shields.io/npm/dm/ainative-zerodb-mcp-server.svg)](https://www.npmjs.com/package/ainative-zerodb-mcp-server)
[![license](https://img.shields.io/npm/l/ainative-zerodb-mcp-server.svg)](https://github.com/AINative-Studio/ainative-zerodb-mcp-server/blob/main/LICENSE)
[![test coverage](https://img.shields.io/badge/coverage-90%25-brightgreen.svg)](https://github.com/AINative-Studio/ainative-zerodb-mcp-server)

**Enterprise-grade Model Context Protocol (MCP) server providing full access to ZeroDB's vector search, quantum compression, NoSQL operations, and persistent memory for AI agents.**

## Key Features

- **60 Complete Operations** - Full API coverage across all ZeroDB capabilities
- **Vector Search** - Semantic similarity search with 1536-dimensional embeddings
- **Quantum Compression** - Advanced vector compression using quantum algorithms
- **NoSQL Tables** - Flexible table operations for structured data
- **File Storage** - Secure file upload, download, and management
- **Event System** - Event-driven architecture with pub/sub support
- **Project Management** - Multi-tenant project isolation and management
- **RLHF Integration** - Reinforcement Learning from Human Feedback collection
- **Admin Tools** - System monitoring, optimization, and health checks
- **Enterprise Security** - JWT authentication with automatic token renewal
- **90%+ Test Coverage** - Comprehensive test suite for production reliability

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
  - [Memory Operations (3)](#memory-operations)
  - [Vector Operations (10)](#vector-operations)
  - [Quantum Operations (6)](#quantum-operations)
  - [Table/NoSQL Operations (8)](#tablenos-ql-operations)
  - [File Operations (6)](#file-operations)
  - [Event Operations (5)](#event-operations)
  - [Project Operations (7)](#project-operations)
  - [RLHF Operations (10)](#rlhf-operations)
  - [Admin Operations (5)](#admin-operations)
- [Configuration](#configuration)
- [Examples](#examples)
- [Migration Guide](#migration-guide)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Installation

### NPM Global Installation
```bash
npm install -g ainative-zerodb-mcp-server
```

### NPX (No Installation Required)
```bash
npx ainative-zerodb-mcp-server
```

### Requirements
- Node.js >= 18.0.0
- NPM >= 9.0.0
- ZeroDB account with API credentials (see below)

---

## Getting Started

### Step 1: Create Your ZeroDB Account

Before using the MCP server, you need a ZeroDB account and project.

#### Option A: Register via Web (Recommended)
Visit: **https://api.ainative.studio/docs**
1. Click on "Register User" endpoint
2. Use the "Try it out" feature
3. Enter your email, password, and username

#### Option B: Register via API
```bash
curl -X POST 'https://api.ainative.studio/v1/public/auth/register' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "your-email@example.com",
    "password": "YourSecurePassword123!",
    "username": "yourname"
  }'
```

**Response:**
```json
{
  "email": "your-email@example.com",
  "id": "user-uuid-here",
  "username": "yourname"
}
```

### Step 2: Create a Project

After registration, create a project to get your `PROJECT_ID`:

```bash
# 1. Login to get your access token
curl -X POST 'https://api.ainative.studio/v1/public/auth/login-json' \
  -H 'Content-Type: application/json' \
  -d '{
    "username": "your-email@example.com",
    "password": "YourSecurePassword123!"
  }'
```

**Response:**
```json
{
  "access_token": "eyJhbGc...",
  "token_type": "bearer",
  "expires_in": 1800
}
```

```bash
# 2. Create a project using your token
curl -X POST 'https://api.ainative.studio/v1/public/projects' \
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN_HERE' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "My ZeroDB MCP Project",
    "description": "Project for Claude Desktop MCP integration"
  }'
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "My ZeroDB MCP Project",
  "status": "ACTIVE",
  ...
}
```

**Save this Project ID!** You'll need it for the MCP configuration.

---

## Quick Start

### Step 3: Configure Claude Desktop

Add to your Claude Desktop configuration file:

**MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "zerodb": {
      "command": "npx",
      "args": ["ainative-zerodb-mcp-server"],
      "env": {
        "ZERODB_API_URL": "https://api.ainative.studio",
        "ZERODB_PROJECT_ID": "your-project-id-here",
        "ZERODB_USERNAME": "your-email@example.com",
        "ZERODB_PASSWORD": "your-password",
        "MCP_CONTEXT_WINDOW": "8192",
        "MCP_RETENTION_DAYS": "30"
      }
    }
  }
}
```

### Step 4: Restart Claude Desktop

After saving the configuration, restart Claude Desktop to activate the MCP server.

### Step 5: Test Your First Operation

In Claude Desktop, try:
```
Store a memory: "This is my first ZeroDB memory entry"
```

Claude will use the `zerodb_store_memory` tool to persist this information.

---

## API Reference

All 60 operations are organized into 9 categories. Each operation is exposed as an MCP tool that Claude can invoke.

### Memory Operations

#### 1. `zerodb_store_memory`
Store agent memory in ZeroDB for persistent context across sessions.

**Parameters:**
- `content` (string, required) - Memory content to store
- `role` (string, required) - Message role: `"user"`, `"assistant"`, or `"system"`
- `session_id` (string, optional) - Session identifier (auto-generated if not provided)
- `agent_id` (string, optional) - Agent identifier (auto-generated if not provided)
- `metadata` (object, optional) - Additional metadata

**Returns:**
```json
{
  "memory_id": "uuid",
  "created_at": "2025-10-14T12:00:00Z"
}
```

**Example:**
```javascript
{
  "content": "User prefers dark mode and TypeScript",
  "role": "system",
  "metadata": {
    "category": "preferences"
  }
}
```

#### 2. `zerodb_search_memory`
Search agent memory using semantic similarity.

**Parameters:**
- `query` (string, required) - Search query
- `session_id` (string, optional) - Filter by session
- `agent_id` (string, optional) - Filter by agent
- `role` (string, optional) - Filter by role
- `limit` (number, optional) - Max results (default: 10)

**Returns:**
```json
{
  "memories": [
    {
      "memory_id": "uuid",
      "content": "string",
      "role": "user|assistant|system",
      "created_at": "timestamp",
      "similarity_score": 0.95
    }
  ]
}
```

**Example:**
```javascript
{
  "query": "What were the user's preferences?",
  "limit": 5
}
```

#### 3. `zerodb_get_context`
Get agent context window for current session, optimized for token limits.

**Parameters:**
- `session_id` (string, required) - Session identifier
- `agent_id` (string, optional) - Agent identifier
- `max_tokens` (number, optional) - Max tokens in context (default: 8192)

**Returns:**
```json
{
  "session_id": "uuid",
  "agent_id": "uuid",
  "total_tokens": 1024,
  "memory_count": 15,
  "messages": [
    {
      "role": "user",
      "content": "string",
      "timestamp": "2025-10-14T12:00:00Z"
    }
  ]
}
```

**Example:**
```javascript
{
  "session_id": "session-123",
  "max_tokens": 4096
}
```

---

### Vector Operations

#### 4. `zerodb_store_vector`
Store vector embedding with metadata (exactly 1536 dimensions).

**Parameters:**
- `vector_embedding` (array[number], required) - 1536-dimensional vector
- `document` (string, required) - Source document text
- `metadata` (object, optional) - Document metadata
- `namespace` (string, optional) - Vector namespace (default: "windsurf")

**Returns:**
```json
{
  "vector_id": "uuid",
  "namespace": "windsurf"
}
```

**Example:**
```javascript
{
  "vector_embedding": [0.1, 0.2, ..., 0.9], // 1536 values
  "document": "This is the source text",
  "metadata": {
    "source": "documentation",
    "page": 42
  }
}
```

#### 5. `zerodb_batch_upsert_vectors`
Batch upsert multiple vectors for improved performance.

**Parameters:**
- `vectors` (array, required) - Array of vector objects
  - `vector_embedding` (array[number], required) - 1536-dimensional vector
  - `document` (string, required) - Source document
  - `metadata` (object, optional) - Document metadata
- `namespace` (string, optional) - Vector namespace

**Returns:**
```json
{
  "success_count": 100,
  "failed_count": 0,
  "vector_ids": ["uuid1", "uuid2", ...]
}
```

**Example:**
```javascript
{
  "vectors": [
    {
      "vector_embedding": [...],
      "document": "Document 1",
      "metadata": {"index": 1}
    },
    {
      "vector_embedding": [...],
      "document": "Document 2",
      "metadata": {"index": 2}
    }
  ],
  "namespace": "knowledge-base"
}
```

#### 6. `zerodb_search_vectors`
Search vectors using semantic similarity.

**Parameters:**
- `query_vector` (array[number], required) - 1536-dimensional query vector
- `namespace` (string, optional) - Vector namespace
- `limit` (number, optional) - Max results (default: 10)
- `threshold` (number, optional) - Similarity threshold 0-1 (default: 0.7)

**Returns:**
```json
{
  "vectors": [
    {
      "vector_id": "uuid",
      "document": "string",
      "similarity_score": 0.95,
      "metadata": {}
    }
  ]
}
```

**Example:**
```javascript
{
  "query_vector": [...], // 1536 values
  "namespace": "windsurf",
  "limit": 20,
  "threshold": 0.8
}
```

#### 7. `zerodb_delete_vector`
Delete a specific vector by ID.

**Parameters:**
- `vector_id` (string, required) - Vector UUID to delete

**Returns:**
```json
{
  "success": true,
  "deleted_id": "uuid"
}
```

**Example:**
```javascript
{
  "vector_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

#### 8. `zerodb_get_vector`
Retrieve a specific vector by ID.

**Parameters:**
- `vector_id` (string, required) - Vector UUID to retrieve

**Returns:**
```json
{
  "vector_id": "uuid",
  "vector_embedding": [...],
  "document": "string",
  "metadata": {},
  "created_at": "timestamp"
}
```

**Example:**
```javascript
{
  "vector_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

#### 9. `zerodb_list_vectors`
List vectors with pagination and filtering.

**Parameters:**
- `namespace` (string, optional) - Filter by namespace
- `limit` (number, optional) - Results per page (default: 50)
- `offset` (number, optional) - Pagination offset (default: 0)

**Returns:**
```json
{
  "vectors": [...],
  "total_count": 1000,
  "limit": 50,
  "offset": 0
}
```

**Example:**
```javascript
{
  "namespace": "windsurf",
  "limit": 100,
  "offset": 200
}
```

#### 10. `zerodb_vector_stats`
Get statistics about vector storage.

**Parameters:**
- `namespace` (string, optional) - Filter by namespace

**Returns:**
```json
{
  "total_vectors": 10000,
  "namespaces": {
    "windsurf": 5000,
    "default": 5000
  },
  "storage_bytes": 1048576,
  "avg_dimension": 1536
}
```

**Example:**
```javascript
{
  "namespace": "windsurf"
}
```

#### 11. `zerodb_create_vector_index`
Create a vector search index for improved performance.

**Parameters:**
- `namespace` (string, required) - Namespace to index
- `index_type` (string, optional) - Index type: "ivfflat" or "hnsw" (default: "hnsw")
- `params` (object, optional) - Index-specific parameters

**Returns:**
```json
{
  "index_id": "uuid",
  "namespace": "windsurf",
  "index_type": "hnsw",
  "status": "created"
}
```

**Example:**
```javascript
{
  "namespace": "windsurf",
  "index_type": "hnsw",
  "params": {
    "m": 16,
    "ef_construction": 200
  }
}
```

#### 12. `zerodb_optimize_vectors`
Optimize vector storage and indexes.

**Parameters:**
- `namespace` (string, optional) - Namespace to optimize

**Returns:**
```json
{
  "optimized": true,
  "space_saved_bytes": 102400,
  "duration_ms": 1500
}
```

**Example:**
```javascript
{
  "namespace": "windsurf"
}
```

#### 13. `zerodb_export_vectors`
Export vectors to external format.

**Parameters:**
- `namespace` (string, required) - Namespace to export
- `format` (string, optional) - Export format: "json" or "csv" (default: "json")
- `include_embeddings` (boolean, optional) - Include vector data (default: false)

**Returns:**
```json
{
  "export_id": "uuid",
  "download_url": "https://...",
  "expires_at": "timestamp"
}
```

**Example:**
```javascript
{
  "namespace": "windsurf",
  "format": "json",
  "include_embeddings": true
}
```

---

### Quantum Operations

#### 14. `zerodb_quantum_compress`
Compress vector using quantum algorithms for reduced storage.

**Parameters:**
- `vector_embedding` (array[number], required) - 1536-dimensional vector to compress
- `compression_ratio` (number, optional) - Target ratio 0-1 (default: 0.5)
- `algorithm` (string, optional) - Algorithm: "qaoa" or "vqe" (default: "qaoa")

**Returns:**
```json
{
  "compressed_vector": [...],
  "original_dimensions": 1536,
  "compressed_dimensions": 768,
  "compression_ratio": 0.5,
  "fidelity_score": 0.98
}
```

**Example:**
```javascript
{
  "vector_embedding": [...],
  "compression_ratio": 0.6,
  "algorithm": "qaoa"
}
```

#### 15. `zerodb_quantum_decompress`
Decompress quantum-compressed vector.

**Parameters:**
- `compressed_vector` (array[number], required) - Compressed vector data
- `original_dimensions` (number, required) - Original dimension count

**Returns:**
```json
{
  "decompressed_vector": [...],
  "dimensions": 1536,
  "reconstruction_error": 0.02
}
```

**Example:**
```javascript
{
  "compressed_vector": [...],
  "original_dimensions": 1536
}
```

#### 16. `zerodb_quantum_hybrid_search`
Perform hybrid search using quantum-enhanced similarity.

**Parameters:**
- `query_vector` (array[number], required) - 1536-dimensional query
- `namespace` (string, optional) - Vector namespace
- `limit` (number, optional) - Max results (default: 10)
- `quantum_weight` (number, optional) - Quantum influence 0-1 (default: 0.5)

**Returns:**
```json
{
  "vectors": [
    {
      "vector_id": "uuid",
      "document": "string",
      "similarity_score": 0.96,
      "quantum_score": 0.94,
      "hybrid_score": 0.95
    }
  ]
}
```

**Example:**
```javascript
{
  "query_vector": [...],
  "namespace": "windsurf",
  "limit": 10,
  "quantum_weight": 0.7
}
```

#### 17. `zerodb_quantum_optimize`
Optimize vector space using quantum optimization.

**Parameters:**
- `namespace` (string, required) - Namespace to optimize
- `optimization_target` (string, optional) - "storage" or "search_speed" (default: "storage")

**Returns:**
```json
{
  "optimized": true,
  "improvement_percentage": 35.5,
  "duration_ms": 5000
}
```

**Example:**
```javascript
{
  "namespace": "windsurf",
  "optimization_target": "search_speed"
}
```

#### 18. `zerodb_quantum_feature_map`
Generate quantum feature map for vector.

**Parameters:**
- `vector_embedding` (array[number], required) - 1536-dimensional vector
- `feature_map_type` (string, optional) - "zz" or "pauli" (default: "zz")

**Returns:**
```json
{
  "feature_map": [...],
  "quantum_circuit_depth": 10,
  "qubit_count": 12
}
```

**Example:**
```javascript
{
  "vector_embedding": [...],
  "feature_map_type": "pauli"
}
```

#### 19. `zerodb_quantum_kernel`
Compute quantum kernel similarity between vectors.

**Parameters:**
- `vector_a` (array[number], required) - First 1536-dimensional vector
- `vector_b` (array[number], required) - Second 1536-dimensional vector
- `kernel_type` (string, optional) - "linear" or "rbf" (default: "rbf")

**Returns:**
```json
{
  "kernel_similarity": 0.92,
  "quantum_advantage": 0.15,
  "computation_time_ms": 45
}
```

**Example:**
```javascript
{
  "vector_a": [...],
  "vector_b": [...],
  "kernel_type": "rbf"
}
```

---

### Table/NoSQL Operations

#### 20. `zerodb_create_table`
Create a new NoSQL table with schema.

**Parameters:**
- `table_name` (string, required) - Table name
- `schema` (object, required) - JSON schema definition
- `description` (string, optional) - Table description

**Returns:**
```json
{
  "table_id": "uuid",
  "table_name": "string",
  "created_at": "timestamp"
}
```

**Example:**
```javascript
{
  "table_name": "user_profiles",
  "schema": {
    "user_id": "uuid",
    "name": "string",
    "email": "string",
    "created_at": "timestamp"
  },
  "description": "User profile information"
}
```

#### 21. `zerodb_list_tables`
List all tables in project.

**Parameters:**
- `limit` (number, optional) - Results per page (default: 50)
- `offset` (number, optional) - Pagination offset (default: 0)

**Returns:**
```json
{
  "tables": [
    {
      "table_id": "uuid",
      "table_name": "string",
      "row_count": 1000,
      "created_at": "timestamp"
    }
  ],
  "total_count": 10
}
```

**Example:**
```javascript
{
  "limit": 100,
  "offset": 0
}
```

#### 22. `zerodb_get_table`
Get table details and schema.

**Parameters:**
- `table_id` (string, required) - Table UUID

**Returns:**
```json
{
  "table_id": "uuid",
  "table_name": "string",
  "schema": {},
  "row_count": 1000,
  "created_at": "timestamp"
}
```

**Example:**
```javascript
{
  "table_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

#### 23. `zerodb_delete_table`
Delete a table and all its data.

**Parameters:**
- `table_id` (string, required) - Table UUID to delete

**Returns:**
```json
{
  "success": true,
  "deleted_id": "uuid",
  "rows_deleted": 1000
}
```

**Example:**
```javascript
{
  "table_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

#### 24. `zerodb_insert_rows`
Insert rows into table.

**Parameters:**
- `table_id` (string, required) - Table UUID
- `rows` (array, required) - Array of row objects

**Returns:**
```json
{
  "inserted_count": 100,
  "row_ids": ["uuid1", "uuid2", ...]
}
```

**Example:**
```javascript
{
  "table_id": "123e4567-e89b-12d3-a456-426614174000",
  "rows": [
    {
      "user_id": "user-1",
      "name": "John Doe",
      "email": "john@example.com"
    },
    {
      "user_id": "user-2",
      "name": "Jane Smith",
      "email": "jane@example.com"
    }
  ]
}
```

#### 25. `zerodb_query_rows`
Query table rows with filters.

**Parameters:**
- `table_id` (string, required) - Table UUID
- `filters` (object, optional) - Query filters
- `limit` (number, optional) - Max results (default: 50)
- `offset` (number, optional) - Pagination offset (default: 0)

**Returns:**
```json
{
  "rows": [...],
  "total_count": 1000,
  "limit": 50,
  "offset": 0
}
```

**Example:**
```javascript
{
  "table_id": "123e4567-e89b-12d3-a456-426614174000",
  "filters": {
    "email": {
      "$contains": "@example.com"
    }
  },
  "limit": 100
}
```

#### 26. `zerodb_update_rows`
Update rows in table.

**Parameters:**
- `table_id` (string, required) - Table UUID
- `filters` (object, required) - Row selection filters
- `updates` (object, required) - Fields to update

**Returns:**
```json
{
  "updated_count": 50,
  "row_ids": ["uuid1", "uuid2", ...]
}
```

**Example:**
```javascript
{
  "table_id": "123e4567-e89b-12d3-a456-426614174000",
  "filters": {
    "user_id": "user-1"
  },
  "updates": {
    "email": "newemail@example.com"
  }
}
```

#### 27. `zerodb_delete_rows`
Delete rows from table.

**Parameters:**
- `table_id` (string, required) - Table UUID
- `filters` (object, required) - Row selection filters

**Returns:**
```json
{
  "deleted_count": 25,
  "row_ids": ["uuid1", "uuid2", ...]
}
```

**Example:**
```javascript
{
  "table_id": "123e4567-e89b-12d3-a456-426614174000",
  "filters": {
    "created_at": {
      "$lt": "2025-01-01"
    }
  }
}
```

---

### File Operations

#### 28. `zerodb_upload_file`
Upload file to ZeroDB storage.

**Parameters:**
- `file_name` (string, required) - File name
- `file_data` (string, required) - Base64-encoded file data
- `content_type` (string, optional) - MIME type
- `metadata` (object, optional) - File metadata

**Returns:**
```json
{
  "file_id": "uuid",
  "file_name": "string",
  "size_bytes": 1024,
  "upload_url": "string"
}
```

**Example:**
```javascript
{
  "file_name": "document.pdf",
  "file_data": "base64encodeddata...",
  "content_type": "application/pdf",
  "metadata": {
    "category": "documentation"
  }
}
```

#### 29. `zerodb_download_file`
Download file from ZeroDB storage.

**Parameters:**
- `file_id` (string, required) - File UUID

**Returns:**
```json
{
  "file_id": "uuid",
  "file_name": "string",
  "file_data": "base64encodeddata...",
  "content_type": "string",
  "size_bytes": 1024
}
```

**Example:**
```javascript
{
  "file_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

#### 30. `zerodb_list_files`
List files with pagination.

**Parameters:**
- `limit` (number, optional) - Results per page (default: 50)
- `offset` (number, optional) - Pagination offset (default: 0)
- `content_type` (string, optional) - Filter by MIME type

**Returns:**
```json
{
  "files": [
    {
      "file_id": "uuid",
      "file_name": "string",
      "size_bytes": 1024,
      "content_type": "string",
      "created_at": "timestamp"
    }
  ],
  "total_count": 100
}
```

**Example:**
```javascript
{
  "limit": 100,
  "content_type": "application/pdf"
}
```

#### 31. `zerodb_delete_file`
Delete file from storage.

**Parameters:**
- `file_id` (string, required) - File UUID to delete

**Returns:**
```json
{
  "success": true,
  "deleted_id": "uuid"
}
```

**Example:**
```javascript
{
  "file_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

#### 32. `zerodb_get_file_metadata`
Get file metadata without downloading.

**Parameters:**
- `file_id` (string, required) - File UUID

**Returns:**
```json
{
  "file_id": "uuid",
  "file_name": "string",
  "size_bytes": 1024,
  "content_type": "string",
  "metadata": {},
  "created_at": "timestamp"
}
```

**Example:**
```javascript
{
  "file_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

#### 33. `zerodb_generate_presigned_url`
Generate temporary download URL.

**Parameters:**
- `file_id` (string, required) - File UUID
- `expiry_seconds` (number, optional) - URL validity (default: 3600)

**Returns:**
```json
{
  "file_id": "uuid",
  "presigned_url": "https://...",
  "expires_at": "timestamp"
}
```

**Example:**
```javascript
{
  "file_id": "123e4567-e89b-12d3-a456-426614174000",
  "expiry_seconds": 7200
}
```

---

### Event Operations

#### 34. `zerodb_create_event`
Create a new event in the event system.

**Parameters:**
- `event_type` (string, required) - Event type identifier
- `event_data` (object, required) - Event payload
- `metadata` (object, optional) - Event metadata

**Returns:**
```json
{
  "event_id": "uuid",
  "event_type": "string",
  "created_at": "timestamp"
}
```

**Example:**
```javascript
{
  "event_type": "user.signup",
  "event_data": {
    "user_id": "user-123",
    "email": "user@example.com"
  },
  "metadata": {
    "source": "web"
  }
}
```

#### 35. `zerodb_list_events`
List events with filtering and pagination.

**Parameters:**
- `event_type` (string, optional) - Filter by event type
- `start_date` (string, optional) - Filter by start date (ISO 8601)
- `end_date` (string, optional) - Filter by end date (ISO 8601)
- `limit` (number, optional) - Results per page (default: 50)
- `offset` (number, optional) - Pagination offset (default: 0)

**Returns:**
```json
{
  "events": [
    {
      "event_id": "uuid",
      "event_type": "string",
      "event_data": {},
      "created_at": "timestamp"
    }
  ],
  "total_count": 1000
}
```

**Example:**
```javascript
{
  "event_type": "user.signup",
  "start_date": "2025-10-01T00:00:00Z",
  "limit": 100
}
```

#### 36. `zerodb_get_event`
Get specific event by ID.

**Parameters:**
- `event_id` (string, required) - Event UUID

**Returns:**
```json
{
  "event_id": "uuid",
  "event_type": "string",
  "event_data": {},
  "metadata": {},
  "created_at": "timestamp"
}
```

**Example:**
```javascript
{
  "event_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

#### 37. `zerodb_subscribe_events`
Subscribe to event stream (WebSocket).

**Parameters:**
- `event_types` (array[string], required) - Event types to subscribe to
- `filters` (object, optional) - Additional filters

**Returns:**
```json
{
  "subscription_id": "uuid",
  "event_types": ["user.signup", "user.login"],
  "websocket_url": "wss://..."
}
```

**Example:**
```javascript
{
  "event_types": ["user.signup", "user.login"],
  "filters": {
    "source": "web"
  }
}
```

#### 38. `zerodb_event_stats`
Get event statistics and analytics.

**Parameters:**
- `event_type` (string, optional) - Filter by event type
- `start_date` (string, optional) - Start date (ISO 8601)
- `end_date` (string, optional) - End date (ISO 8601)
- `group_by` (string, optional) - Group by: "hour", "day", "week" (default: "day")

**Returns:**
```json
{
  "total_events": 10000,
  "event_types": {
    "user.signup": 1000,
    "user.login": 9000
  },
  "timeline": [
    {
      "date": "2025-10-14",
      "count": 500
    }
  ]
}
```

**Example:**
```javascript
{
  "start_date": "2025-10-01T00:00:00Z",
  "end_date": "2025-10-14T23:59:59Z",
  "group_by": "day"
}
```

---

### Project Operations

#### 39. `zerodb_create_project`
Create a new ZeroDB project.

**Parameters:**
- `project_name` (string, required) - Project name
- `description` (string, optional) - Project description
- `settings` (object, optional) - Project settings

**Returns:**
```json
{
  "project_id": "uuid",
  "project_name": "string",
  "created_at": "timestamp"
}
```

**Example:**
```javascript
{
  "project_name": "My AI Application",
  "description": "Vector search for customer support",
  "settings": {
    "retention_days": 90
  }
}
```

#### 40. `zerodb_get_project`
Get project details.

**Parameters:**
- `project_id` (string, required) - Project UUID

**Returns:**
```json
{
  "project_id": "uuid",
  "project_name": "string",
  "description": "string",
  "settings": {},
  "created_at": "timestamp"
}
```

**Example:**
```javascript
{
  "project_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

#### 41. `zerodb_list_projects`
List all accessible projects.

**Parameters:**
- `limit` (number, optional) - Results per page (default: 50)
- `offset` (number, optional) - Pagination offset (default: 0)

**Returns:**
```json
{
  "projects": [
    {
      "project_id": "uuid",
      "project_name": "string",
      "created_at": "timestamp"
    }
  ],
  "total_count": 10
}
```

**Example:**
```javascript
{
  "limit": 100
}
```

#### 42. `zerodb_update_project`
Update project settings.

**Parameters:**
- `project_id` (string, required) - Project UUID
- `project_name` (string, optional) - New project name
- `description` (string, optional) - New description
- `settings` (object, optional) - Updated settings

**Returns:**
```json
{
  "project_id": "uuid",
  "updated_fields": ["project_name", "settings"],
  "updated_at": "timestamp"
}
```

**Example:**
```javascript
{
  "project_id": "123e4567-e89b-12d3-a456-426614174000",
  "settings": {
    "retention_days": 120
  }
}
```

#### 43. `zerodb_delete_project`
Delete a project and all its data.

**Parameters:**
- `project_id` (string, required) - Project UUID to delete
- `confirm` (boolean, required) - Must be true to confirm deletion

**Returns:**
```json
{
  "success": true,
  "deleted_id": "uuid",
  "deleted_at": "timestamp"
}
```

**Example:**
```javascript
{
  "project_id": "123e4567-e89b-12d3-a456-426614174000",
  "confirm": true
}
```

#### 44. `zerodb_get_project_stats`
Get project usage statistics.

**Parameters:**
- `project_id` (string, required) - Project UUID
- `start_date` (string, optional) - Start date (ISO 8601)
- `end_date` (string, optional) - End date (ISO 8601)

**Returns:**
```json
{
  "project_id": "uuid",
  "vector_count": 10000,
  "memory_count": 5000,
  "table_count": 10,
  "file_count": 100,
  "storage_bytes": 10485760,
  "api_calls": 50000
}
```

**Example:**
```javascript
{
  "project_id": "123e4567-e89b-12d3-a456-426614174000",
  "start_date": "2025-10-01T00:00:00Z"
}
```

#### 45. `zerodb_enable_database`
Enable database features for project.

**Parameters:**
- `project_id` (string, required) - Project UUID
- `features` (array[string], required) - Features to enable: ["vectors", "tables", "files", "events"]

**Returns:**
```json
{
  "project_id": "uuid",
  "enabled_features": ["vectors", "tables"],
  "enabled_at": "timestamp"
}
```

**Example:**
```javascript
{
  "project_id": "123e4567-e89b-12d3-a456-426614174000",
  "features": ["vectors", "tables", "files"]
}
```

---

### RLHF Operations

#### 46. `zerodb_rlhf_interaction`
Collect user interaction for RLHF training.

**Parameters:**
- `session_id` (string, required) - Session identifier
- `user_input` (string, required) - User's input
- `agent_response` (string, required) - Agent's response
- `feedback_score` (number, optional) - User rating 1-5
- `metadata` (object, optional) - Additional context

**Returns:**
```json
{
  "interaction_id": "uuid",
  "collected_at": "timestamp"
}
```

**Example:**
```javascript
{
  "session_id": "session-123",
  "user_input": "How do I reset my password?",
  "agent_response": "You can reset your password by...",
  "feedback_score": 5,
  "metadata": {
    "model": "claude-3-sonnet",
    "response_time_ms": 1200
  }
}
```

#### 47. `zerodb_rlhf_agent_feedback`
Collect feedback about agent performance.

**Parameters:**
- `agent_id` (string, required) - Agent identifier
- `session_id` (string, required) - Session identifier
- `feedback_type` (string, required) - "positive" or "negative"
- `feedback_text` (string, optional) - Detailed feedback
- `metrics` (object, optional) - Performance metrics

**Returns:**
```json
{
  "feedback_id": "uuid",
  "collected_at": "timestamp"
}
```

**Example:**
```javascript
{
  "agent_id": "agent-123",
  "session_id": "session-123",
  "feedback_type": "positive",
  "feedback_text": "Very helpful and accurate responses",
  "metrics": {
    "accuracy": 0.95,
    "helpfulness": 0.9
  }
}
```

#### 48. `zerodb_rlhf_workflow`
Collect feedback about workflow completion.

**Parameters:**
- `workflow_id` (string, required) - Workflow identifier
- `session_id` (string, required) - Session identifier
- `completed` (boolean, required) - Workflow completion status
- `duration_ms` (number, optional) - Workflow duration
- `feedback` (object, optional) - Workflow feedback

**Returns:**
```json
{
  "workflow_feedback_id": "uuid",
  "collected_at": "timestamp"
}
```

**Example:**
```javascript
{
  "workflow_id": "workflow-123",
  "session_id": "session-123",
  "completed": true,
  "duration_ms": 5000,
  "feedback": {
    "ease_of_use": 5,
    "effectiveness": 4
  }
}
```

#### 49. `zerodb_rlhf_error`
Collect error reports for model improvement.

**Parameters:**
- `session_id` (string, required) - Session identifier
- `error_type` (string, required) - Error category
- `error_message` (string, required) - Error description
- `context` (object, optional) - Error context
- `user_impact` (string, optional) - Impact level: "low", "medium", "high"

**Returns:**
```json
{
  "error_report_id": "uuid",
  "collected_at": "timestamp"
}
```

**Example:**
```javascript
{
  "session_id": "session-123",
  "error_type": "hallucination",
  "error_message": "Agent provided incorrect information about product pricing",
  "context": {
    "user_query": "What is the price?",
    "agent_response": "The price is $50"
  },
  "user_impact": "high"
}
```

#### 50. `zerodb_rlhf_status`
Get RLHF collection status.

**Parameters:**
- `session_id` (string, optional) - Filter by session
- `start_date` (string, optional) - Start date (ISO 8601)
- `end_date` (string, optional) - End date (ISO 8601)

**Returns:**
```json
{
  "total_interactions": 1000,
  "avg_feedback_score": 4.2,
  "positive_feedback": 850,
  "negative_feedback": 150,
  "collection_rate": 0.85
}
```

**Example:**
```javascript
{
  "start_date": "2025-10-01T00:00:00Z",
  "end_date": "2025-10-14T23:59:59Z"
}
```

#### 51. `zerodb_rlhf_summary`
Get RLHF analytics summary.

**Parameters:**
- `group_by` (string, optional) - Group by: "agent", "workflow", "session" (default: "agent")
- `start_date` (string, optional) - Start date (ISO 8601)
- `end_date` (string, optional) - End date (ISO 8601)

**Returns:**
```json
{
  "summary": [
    {
      "group_id": "agent-123",
      "interaction_count": 500,
      "avg_score": 4.5,
      "improvement_trend": 0.15
    }
  ]
}
```

**Example:**
```javascript
{
  "group_by": "agent",
  "start_date": "2025-10-01T00:00:00Z"
}
```

#### 52. `zerodb_rlhf_start`
Start RLHF collection for session.

**Parameters:**
- `session_id` (string, required) - Session identifier
- `collection_config` (object, optional) - Collection settings

**Returns:**
```json
{
  "session_id": "uuid",
  "collection_started": true,
  "started_at": "timestamp"
}
```

**Example:**
```javascript
{
  "session_id": "session-123",
  "collection_config": {
    "collect_all_interactions": true,
    "require_explicit_feedback": false
  }
}
```

#### 53. `zerodb_rlhf_stop`
Stop RLHF collection for session.

**Parameters:**
- `session_id` (string, required) - Session identifier

**Returns:**
```json
{
  "session_id": "uuid",
  "collection_stopped": true,
  "stopped_at": "timestamp",
  "total_collected": 50
}
```

**Example:**
```javascript
{
  "session_id": "session-123"
}
```

#### 54. `zerodb_rlhf_session`
Get all interactions for a session.

**Parameters:**
- `session_id` (string, required) - Session identifier
- `limit` (number, optional) - Max results (default: 100)

**Returns:**
```json
{
  "session_id": "uuid",
  "interactions": [
    {
      "interaction_id": "uuid",
      "user_input": "string",
      "agent_response": "string",
      "feedback_score": 5,
      "timestamp": "timestamp"
    }
  ],
  "total_count": 50
}
```

**Example:**
```javascript
{
  "session_id": "session-123",
  "limit": 200
}
```

#### 55. `zerodb_rlhf_broadcast`
Broadcast RLHF event to subscribers.

**Parameters:**
- `event_type` (string, required) - Event type
- `event_data` (object, required) - Event payload
- `target_sessions` (array[string], optional) - Target session IDs

**Returns:**
```json
{
  "broadcast_id": "uuid",
  "recipients": 10,
  "broadcasted_at": "timestamp"
}
```

**Example:**
```javascript
{
  "event_type": "feedback.requested",
  "event_data": {
    "interaction_id": "interaction-123",
    "question": "Was this response helpful?"
  },
  "target_sessions": ["session-1", "session-2"]
}
```

---

### Admin Operations

#### 56. `zerodb_admin_system_stats`
Get system-wide statistics (requires admin role).

**Parameters:**
- `include_details` (boolean, optional) - Include detailed metrics (default: false)

**Returns:**
```json
{
  "total_projects": 100,
  "total_users": 500,
  "total_vectors": 1000000,
  "total_storage_bytes": 10737418240,
  "active_sessions": 50,
  "api_calls_24h": 100000,
  "avg_response_time_ms": 150
}
```

**Example:**
```javascript
{
  "include_details": true
}
```

#### 57. `zerodb_admin_list_projects`
List all projects in system (requires admin role).

**Parameters:**
- `user_id` (string, optional) - Filter by user
- `limit` (number, optional) - Results per page (default: 100)
- `offset` (number, optional) - Pagination offset (default: 0)

**Returns:**
```json
{
  "projects": [
    {
      "project_id": "uuid",
      "project_name": "string",
      "user_id": "uuid",
      "created_at": "timestamp",
      "storage_bytes": 1048576
    }
  ],
  "total_count": 100
}
```

**Example:**
```javascript
{
  "limit": 500
}
```

#### 58. `zerodb_admin_user_usage`
Get user usage statistics (requires admin role).

**Parameters:**
- `user_id` (string, required) - User UUID
- `start_date` (string, optional) - Start date (ISO 8601)
- `end_date` (string, optional) - End date (ISO 8601)

**Returns:**
```json
{
  "user_id": "uuid",
  "project_count": 5,
  "vector_count": 10000,
  "storage_bytes": 10485760,
  "api_calls": 50000,
  "cost_estimate_usd": 25.50
}
```

**Example:**
```javascript
{
  "user_id": "user-123",
  "start_date": "2025-10-01T00:00:00Z"
}
```

#### 59. `zerodb_admin_health`
Get system health status (requires admin role).

**Parameters:**
- None

**Returns:**
```json
{
  "status": "healthy",
  "database": "connected",
  "storage": "healthy",
  "quantum_service": "operational",
  "cache": "healthy",
  "uptime_seconds": 86400,
  "last_check": "timestamp"
}
```

**Example:**
```javascript
{}
```

#### 60. `zerodb_admin_optimize`
Optimize database and storage (requires admin role).

**Parameters:**
- `optimization_type` (string, required) - "vacuum", "reindex", or "all"
- `tables` (array[string], optional) - Specific tables to optimize

**Returns:**
```json
{
  "optimized": true,
  "optimization_type": "all",
  "duration_ms": 30000,
  "space_freed_bytes": 1048576,
  "improvements": {
    "query_performance": 0.25,
    "storage_efficiency": 0.15
  }
}
```

**Example:**
```javascript
{
  "optimization_type": "all"
}
```

---

## Configuration

### Environment Variables

All configuration is done through environment variables. Set these in your MCP server configuration.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ZERODB_API_URL` | No | `https://api.ainative.studio` | ZeroDB API base URL |
| `ZERODB_PROJECT_ID` | **Yes** | - | Your ZeroDB project ID |
| `ZERODB_USERNAME` | **Yes** | - | Your ZeroDB account email |
| `ZERODB_PASSWORD` | **Yes** | - | Your ZeroDB account password |
| `ZERODB_API_TOKEN` | No | - | Pre-existing API token (optional, will be auto-generated) |
| `MCP_CONTEXT_WINDOW` | No | `8192` | Maximum tokens in context window |
| `MCP_RETENTION_DAYS` | No | `30` | Memory retention period in days |

### Authentication

The MCP server uses JWT authentication with automatic token renewal:

1. **Initial Authentication**: On startup, the server authenticates using username/password
2. **Token Storage**: Access token is stored in memory
3. **Automatic Renewal**: Token is automatically renewed every 25 minutes (tokens expire after 30 minutes)
4. **Manual Renewal**: Use `zerodb_renew_token` to manually renew if needed

### Security Best Practices

1. **Store credentials securely**: Use environment variables, never hardcode
2. **Use project-specific credentials**: Create separate projects for different applications
3. **Rotate passwords regularly**: Change passwords every 90 days
4. **Monitor API usage**: Check for unusual activity in project stats
5. **Limit token scope**: Use project-specific tokens when possible

---

## Examples

### Example 1: Building a Knowledge Base

```javascript
// 1. Create a project for your knowledge base
const project = await zerodb_create_project({
  project_name: "Product Documentation KB",
  description: "Searchable product documentation"
});

// 2. Upload documentation files
const file = await zerodb_upload_file({
  file_name: "user_guide.pdf",
  file_data: "base64data...",
  content_type: "application/pdf"
});

// 3. Store vectors for semantic search
// (Assume you've generated embeddings from the documentation)
const vector = await zerodb_store_vector({
  vector_embedding: [...], // 1536-dimensional vector
  document: "How to reset your password: Navigate to Settings...",
  metadata: {
    source: "user_guide.pdf",
    page: 15
  }
});

// 4. Search the knowledge base
const results = await zerodb_search_vectors({
  query_vector: [...], // User query embedding
  limit: 5,
  threshold: 0.75
});
```

### Example 2: Agent Memory with Context

```javascript
// 1. Store conversation in memory
await zerodb_store_memory({
  content: "User wants to book a flight to Paris",
  role: "user",
  session_id: "session-123"
});

await zerodb_store_memory({
  content: "I'll help you book a flight to Paris. What dates?",
  role: "assistant",
  session_id: "session-123"
});

// 2. Later in the conversation, get context
const context = await zerodb_get_context({
  session_id: "session-123",
  max_tokens: 4096
});

// Context includes all previous messages, token-optimized
```

### Example 3: RLHF Data Collection

```javascript
// 1. Start RLHF collection for session
await zerodb_rlhf_start({
  session_id: "session-456",
  collection_config: {
    collect_all_interactions: true
  }
});

// 2. Collect interactions during conversation
await zerodb_rlhf_interaction({
  session_id: "session-456",
  user_input: "What's the weather like?",
  agent_response: "I don't have access to real-time weather data",
  feedback_score: 3,
  metadata: {
    model: "claude-3-sonnet",
    response_time_ms: 800
  }
});

// 3. Collect error reports
await zerodb_rlhf_error({
  session_id: "session-456",
  error_type: "capability_limitation",
  error_message: "Agent cannot access real-time data",
  user_impact: "medium"
});

// 4. Get RLHF summary
const summary = await zerodb_rlhf_summary({
  group_by: "session",
  start_date: "2025-10-14T00:00:00Z"
});
```

### Example 4: Quantum-Enhanced Search

```javascript
// 1. Store vectors with quantum compression
const compressed = await zerodb_quantum_compress({
  vector_embedding: [...], // Original 1536 dimensions
  compression_ratio: 0.5,
  algorithm: "qaoa"
});

// Store compressed version
await zerodb_store_vector({
  vector_embedding: compressed.compressed_vector,
  document: "Product description...",
  metadata: {
    compressed: true,
    original_dimensions: 1536
  }
});

// 2. Perform quantum hybrid search
const results = await zerodb_quantum_hybrid_search({
  query_vector: [...],
  quantum_weight: 0.7, // Higher weight for quantum similarity
  limit: 10
});

// Results include both classical and quantum similarity scores
```

### Example 5: NoSQL Data Management

```javascript
// 1. Create a table for user profiles
const table = await zerodb_create_table({
  table_name: "user_profiles",
  schema: {
    user_id: "uuid",
    name: "string",
    email: "string",
    preferences: "json",
    created_at: "timestamp"
  }
});

// 2. Insert user data
await zerodb_insert_rows({
  table_id: table.table_id,
  rows: [
    {
      user_id: "user-1",
      name: "Alice Smith",
      email: "alice@example.com",
      preferences: { theme: "dark", language: "en" }
    }
  ]
});

// 3. Query users
const users = await zerodb_query_rows({
  table_id: table.table_id,
  filters: {
    email: { $contains: "@example.com" }
  }
});

// 4. Update preferences
await zerodb_update_rows({
  table_id: table.table_id,
  filters: { user_id: "user-1" },
  updates: {
    preferences: { theme: "light", language: "en" }
  }
});
```

### Example 6: Error Handling

```javascript
// All operations return structured responses with error handling
try {
  const result = await zerodb_store_vector({
    vector_embedding: [...],
    document: "Sample text"
  });

  if (result.isError) {
    console.error("Operation failed:", result.content[0].text);
    // Handle error appropriately
  } else {
    console.log("Success:", result.content[0].text);
  }
} catch (error) {
  // Handle unexpected errors
  console.error("Unexpected error:", error.message);
}
```

---

## Migration Guide

### Migrating from v1.x to v2.0.0

#### Breaking Changes

1. **API Endpoint Consolidation**
   - **v1.x**: Direct API calls to various endpoints
   - **v2.0**: All operations go through unified MCP execute endpoint

   **Impact**: No code changes needed if using MCP tools

2. **Tool Naming Convention**
   - **v1.x**: Some tools lacked `zerodb_` prefix
   - **v2.0**: All tools prefixed with `zerodb_`

   **Migration**:
   ```javascript
   // Old (v1.x)
   store_memory(...) → zerodb_store_memory(...)
   search_memory(...) → zerodb_search_memory(...)

   // New (v2.0)
   zerodb_store_memory(...) // Consistent prefix
   ```

3. **Parameter Changes**
   - **Memory operations**: `memory_metadata` → `metadata`
   - **Vector operations**: `vector_metadata` → `metadata`

   **Migration**:
   ```javascript
   // Old (v1.x)
   {
     content: "...",
     memory_metadata: { key: "value" }
   }

   // New (v2.0)
   {
     content: "...",
     metadata: { key: "value" }
   }
   ```

4. **New Required Environment Variables**
   - `ZERODB_PROJECT_ID` is now required (was optional in v1.x)

   **Migration**: Add to your config:
   ```json
   {
     "env": {
       "ZERODB_PROJECT_ID": "your-project-id"
     }
   }
   ```

#### New Features Available

1. **54 New Operations** - Full API coverage beyond memory and vector operations
2. **Quantum Compression** - Reduce vector storage by up to 50%
3. **NoSQL Tables** - Structured data storage and queries
4. **File Management** - Upload and manage files
5. **Event System** - Event-driven architecture support
6. **RLHF Collection** - Built-in feedback collection for model training
7. **Admin Tools** - System monitoring and optimization

#### Migration Steps

1. **Update Package**
   ```bash
   npm update ainative-zerodb-mcp-server
   # or
   npm install -g ainative-zerodb-mcp-server@2.0.0
   ```

2. **Update Configuration**
   - Add `ZERODB_PROJECT_ID` to environment variables
   - Update any custom tool names to include `zerodb_` prefix

3. **Test Existing Functionality**
   - All v1.x operations remain compatible
   - Test memory and vector operations still work

4. **Gradually Adopt New Features**
   - Start with new features that provide immediate value
   - Refer to API Reference for new operation documentation

#### Backward Compatibility

- All v1.x operations are supported in v2.0
- Existing data and projects are fully compatible
- No data migration required

---

## Troubleshooting

### Common Issues

#### 1. Authentication Failed

**Error**: `Authentication failed: Invalid credentials`

**Solutions**:
- Verify `ZERODB_USERNAME` and `ZERODB_PASSWORD` are correct
- Check that your account is active
- Try manual token renewal: `zerodb_renew_token`

#### 2. Project Not Found

**Error**: `Project not found: [project-id]`

**Solutions**:
- Verify `ZERODB_PROJECT_ID` is correct
- List your projects: `zerodb_list_projects`
- Create a new project: `zerodb_create_project`

#### 3. Vector Dimension Mismatch

**Error**: `vector must have exactly 1536 dimensions, got 768`

**Solutions**:
- Ensure you're using OpenAI's `text-embedding-3-small` (1536 dimensions)
- Or use `text-embedding-ada-002` (1536 dimensions)
- Do not use `text-embedding-3-large` (3072 dimensions)

#### 4. Token Expired

**Error**: `Token expired or invalid`

**Solutions**:
- The server should auto-renew tokens every 25 minutes
- Manually renew: `zerodb_renew_token`
- Check server logs for renewal errors

#### 5. Rate Limiting

**Error**: `Rate limit exceeded`

**Solutions**:
- Reduce request frequency
- Use batch operations where available
- Contact support for rate limit increases

### Debug Logging

Enable verbose logging by checking stderr output:

```bash
# The MCP server logs to stderr
# In Claude Desktop, check: ~/Library/Logs/Claude/mcp*.log
```

Log messages include:
- Token renewal attempts and status
- API call details (operation, params)
- Error messages with full context

### Getting Help

1. **Documentation**: https://docs.ainative.studio/zerodb
2. **GitHub Issues**: https://github.com/AINative-Studio/ainative-zerodb-mcp-server/issues
3. **Email Support**: support@ainative.studio
4. **Discord Community**: https://discord.gg/ainative

---

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup

```bash
# Clone repository
git clone https://github.com/AINative-Studio/ainative-zerodb-mcp-server.git
cd ainative-zerodb-mcp-server

# Install dependencies
npm install

# Run tests
npm test

# Lint code
npm run lint

# Run security audit
npm run security:audit
```

### Testing

```bash
# Run tests with coverage
npm test

# Watch mode for development
npm run test:watch

# CI mode
npm run test:ci
```

### Code Quality

- 90%+ test coverage required
- ESLint for code style
- No high/critical npm vulnerabilities
- All tests must pass before PR merge

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

## Changelog

### v2.0.0 (2025-10-14)

**Breaking Changes**:
- All operations now require `ZERODB_PROJECT_ID` environment variable
- Unified API endpoint for all operations
- Consistent `zerodb_` prefix for all tool names

**New Features**:
- Added 54 new operations (total 60)
- Quantum vector compression and optimization
- NoSQL table operations
- File storage and management
- Event-driven architecture support
- RLHF feedback collection
- Admin system monitoring and optimization
- 90%+ test coverage
- Automatic token renewal

**Improvements**:
- Better error handling and messages
- Improved documentation
- Enhanced security
- Performance optimizations

### v1.0.7 (2025-10-01)
- Initial public release
- Basic memory and vector operations
- Claude Desktop integration

---

**Built with ❤️ by [AINative Studio](https://ainative.studio)**

**Powered by ZeroDB - Enterprise Vector Search for AI**
