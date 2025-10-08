#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

class ZeroDBMCPServer {
  constructor() {
    this.apiUrl = process.env.ZERODB_API_BASE_URL || 'https://api.ainative.studio';
    this.projectId = process.env.ZERODB_PROJECT_ID;
    this.apiToken = process.env.ZERODB_API_KEY;
    this.email = process.env.ZERODB_EMAIL || 'admin@ainative.studio';
    this.password = process.env.ZERODB_PASSWORD || 'Admin2025!Secure';
    this.contextWindow = parseInt(process.env.MCP_CONTEXT_WINDOW || '8192');
    this.retentionDays = parseInt(process.env.MCP_RETENTION_DAYS || '30');
    this.tokenExpiry = null;
    
    this.server = new Server(
      {
        name: 'zerodb-mcp',
        version: '1.0.4',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupTools();
    this.setupHandlers();
    this.setupTokenRenewal();
  }

  setupTools() {
    // Define MCP tools for ZeroDB integration
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
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
        {
          name: 'zerodb_store_vector',
          description: 'Store vector embedding with metadata (must be exactly 1536 dimensions)',
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
              document: { type: 'string', description: 'Source document' },
              metadata: { type: 'object', description: 'Document metadata' },
              namespace: { type: 'string', description: 'Vector namespace', default: 'windsurf' }
            },
            required: ['vector_embedding', 'document']
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
              threshold: { type: 'number', description: 'Similarity threshold', default: 0.7 }
            },
            required: ['query_vector']
          }
        },
        {
          name: 'zerodb_renew_token',
          description: 'Manually renew authentication token',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      ],
    }));
  }

  setupHandlers() {
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Check token expiry before each request
        await this.ensureValidToken();

        switch (name) {
          case 'zerodb_store_memory':
            return await this.storeMemory(args);
          
          case 'zerodb_search_memory':
            return await this.searchMemory(args);
          
          case 'zerodb_get_context':
            return await this.getContext(args);
          
          case 'zerodb_store_vector':
            return await this.storeVector(args);
          
          case 'zerodb_search_vectors':
            return await this.searchVectors(args);
          
          case 'zerodb_renew_token':
            return await this.manualTokenRenewal();
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error executing ${name}: ${error.message}`
          }],
          isError: true
        };
      }
    });
  }

  async ensureValidToken() {
    // Check if token needs renewal (5 minutes before expiry)
    if (!this.apiToken || !this.tokenExpiry || Date.now() > (this.tokenExpiry - 5 * 60 * 1000)) {
      await this.renewToken();
    }
  }

  async renewToken() {
    try {
      console.error('Renewing authentication token...');
      
      const response = await axios.post(
        `${this.apiUrl}/v1/auth/login`,
        new URLSearchParams({
          username: this.email,
          password: this.password
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000 // 10 second timeout
        }
      );

      if (response.data && response.data.access_token) {
        this.apiToken = response.data.access_token;
        this.tokenExpiry = Date.now() + ((response.data.expires_in || 1800) * 1000); // Default 30 minutes
        console.error('Token renewed successfully');
        return true;
      } else {
        throw new Error('Invalid response format: missing access_token');
      }
    } catch (error) {
      console.error('Token renewal failed:', error.response?.data || error.message);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  async manualTokenRenewal() {
    try {
      await this.renewToken();
      return {
        content: [{
          type: 'text',
          text: `Token renewed successfully. Expires at: ${new Date(this.tokenExpiry).toISOString()}`
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Token renewal failed: ${error.message}`
        }],
        isError: true
      };
    }
  }

  setupTokenRenewal() {
    // Renew token every 25 minutes (tokens expire after 30 minutes)
    setInterval(async () => {
      try {
        await this.renewToken();
      } catch (error) {
        console.error('Automatic token renewal failed:', error.message);
      }
    }, 25 * 60 * 1000);
  }

  validateVectorDimensions(vector, operation) {
    if (!Array.isArray(vector)) {
      throw new Error(`${operation}: vector_embedding must be an array`);
    }
    if (vector.length !== 1536) {
      throw new Error(`${operation}: vector must have exactly 1536 dimensions, got ${vector.length}`);
    }
    if (!vector.every(val => typeof val === 'number' && !isNaN(val))) {
      throw new Error(`${operation}: all vector values must be valid numbers`);
    }
  }

  async storeMemory(args) {
    try {
      const memoryData = {
        content: args.content,
        agent_id: args.agent_id || uuidv4(),
        session_id: args.session_id || uuidv4(),
        role: args.role,
        metadata: args.metadata || {}
      };

      console.error(`Storing memory for agent: ${memoryData.agent_id}, session: ${memoryData.session_id}`);

      const response = await axios.post(
        `${this.apiUrl}/v1/zerodb/memory/`,
        memoryData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      return {
        content: [{
          type: 'text',
          text: `Memory stored successfully with ID: ${response.data.memory_id || 'unknown'}`
        }]
      };
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message;
      return {
        content: [{
          type: 'text',
          text: `Error storing memory: ${errorMsg}`
        }],
        isError: true
      };
    }
  }

  async searchMemory(args) {
    try {
      const params = {
        limit: args.limit || 10
      };

      if (args.session_id) params.session_id = args.session_id;
      if (args.agent_id) params.agent_id = args.agent_id;
      if (args.role) params.role = args.role;

      console.error(`Searching memory with params:`, params);

      const response = await axios.get(
        `${this.apiUrl}/v1/zerodb/memory/`,
        {
          params,
          headers: {
            'Authorization': `Bearer ${this.apiToken}`
          },
          timeout: 15000
        }
      );

      const results = response.data.results || [];
      if (results.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No memories found matching the search criteria.'
          }]
        };
      }

      const formattedResults = results.map(memory =>
        `[${memory.created_at}] ${memory.role}: ${memory.content}`
      ).join('\n');

      return {
        content: [{
          type: 'text',
          text: `Found ${results.length} memories:\n\n${formattedResults}`
        }]
      };
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message;
      return {
        content: [{
          type: 'text',
          text: `Error searching memory: ${errorMsg}`
        }],
        isError: true
      };
    }
  }

  async getContext(args) {
    try {
      const params = {
        limit: 50 // Get recent memories for context
      };

      if (args.session_id) params.session_id = args.session_id;
      if (args.agent_id) params.agent_id = args.agent_id;

      console.error(`Getting context with params:`, params);

      const response = await axios.get(
        `${this.apiUrl}/v1/zerodb/memory/`,
        {
          params,
          headers: {
            'Authorization': `Bearer ${this.apiToken}`
          },
          timeout: 15000
        }
      );

      const contextData = response.data;

      return {
        content: [{
          type: 'text',
          text: `Context Window (${contextData.total_messages || 0} messages, ${contextData.estimated_tokens || 0} tokens):\n\n${JSON.stringify(contextData, null, 2)}`
        }]
      };
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message;
      return {
        content: [{
          type: 'text',
          text: `Error getting context: ${errorMsg}`
        }],
        isError: true
      };
    }
  }

  async storeVector(args) {
    try {
      // Validate vector dimensions
      this.validateVectorDimensions(args.vector_embedding, 'storeVector');

      const vectorData = {
        vector_embedding: args.vector_embedding,
        document: args.document,
        vector_metadata: args.metadata || {},
        namespace: args.namespace || 'windsurf',
        source: 'windsurf-mcp'
      };

      console.error(`Storing vector in namespace: ${vectorData.namespace}`);

      const response = await axios.post(
        `${this.apiUrl}/v1/zerodb/vectors/`,
        vectorData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      return {
        content: [{
          type: 'text',
          text: `Vector stored successfully with ID: ${response.data.vector_id}`
        }]
      };
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message;
      return {
        content: [{
          type: 'text',
          text: `Error storing vector: ${errorMsg}`
        }],
        isError: true
      };
    }
  }

  async searchVectors(args) {
    try {
      // Validate vector dimensions
      this.validateVectorDimensions(args.query_vector, 'searchVectors');

      const searchData = {
        query_vector: args.query_vector,
        namespace: args.namespace,
        limit: args.limit || 10,
        similarity_threshold: args.threshold || 0.7
      };

      console.error(`Searching vectors with threshold: ${searchData.similarity_threshold}`);

      const response = await axios.post(
        `${this.apiUrl}/v1/zerodb/vectors/search`,
        searchData,
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      const results = response.data.results || [];
      if (results.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No similar vectors found matching the search criteria.'
          }]
        };
      }

      const formattedResults = results.map(vector =>
        `Score: ${vector.similarity?.toFixed(3) || 'N/A'} | ${vector.document} | ${JSON.stringify(vector.metadata || {})}`
      ).join('\n');

      return {
        content: [{
          type: 'text',
          text: `Found ${results.length} similar vectors:\n\n${formattedResults}`
        }]
      };
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message;
      return {
        content: [{
          type: 'text',
          text: `Error searching vectors: ${errorMsg}`
        }],
        isError: true
      };
    }
  }

  buildContextWindow(memories, maxTokens = 8192) {
    // Simple token estimation (4 chars = 1 token)
    let tokenCount = 0;
    const contextMessages = [];

    // Sort memories by timestamp (most recent first)
    const sortedMemories = memories.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    for (const memory of sortedMemories) {
      const estimatedTokens = Math.ceil(memory.content.length / 4);
      
      if (tokenCount + estimatedTokens > maxTokens) {
        break;
      }

      contextMessages.unshift({
        role: memory.role,
        content: memory.content,
        timestamp: memory.created_at,
        memory_id: memory.memory_id,
        agent_id: memory.agent_id,
        session_id: memory.session_id
      });

      tokenCount += estimatedTokens;
    }

    return {
      session_id: memories[0]?.session_id || 'unknown',
      agent_id: memories[0]?.agent_id || 'unknown',
      total_tokens: tokenCount,
      memory_count: contextMessages.length,
      messages: contextMessages,
      timestamp: new Date().toISOString()
    };
  }

  async start() {
    try {
      // Initial token acquisition
      if (!this.apiToken) {
        await this.renewToken();
      }

      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      console.error('ZeroDB MCP Server v1.0.4 running on stdio');
      console.error(`API URL: ${this.apiUrl}`);
      console.error(`Using public endpoints: /v1/zerodb/*`);
      console.error(`Token expires: ${this.tokenExpiry ? new Date(this.tokenExpiry).toISOString() : 'Unknown'}`);
    } catch (error) {
      console.error('Failed to start ZeroDB MCP Server:', error.message);
      process.exit(1);
    }
  }
}

// Start the server
if (require.main === module) {
  const server = new ZeroDBMCPServer();
  server.start().catch(console.error);
}

module.exports = ZeroDBMCPServer;