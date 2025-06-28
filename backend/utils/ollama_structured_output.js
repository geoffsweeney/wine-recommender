// Ollama Structured Output Reference Implementation
// Requires: npm install ollama zod
// Compatible with Cline and Roo Code AI assistants

const { Ollama } = require('ollama');
const { z } = require('zod');

class OllamaStructuredClient {
  constructor(options = {}) {
    this.ollama = new Ollama({
      host: options.host || 'http://localhost:11434',
      ...options
    });
    this.model = options.model || 'llama3.1';
    this.defaultOptions = {
      temperature: options.temperature || 0.1, // Lower temp for more consistent structured output
      num_predict: options.numPredict || 2048,
      ...options.defaultOptions
    };
  }

  /**
   * Generate structured output with JSON schema validation
   * @param {string} prompt - The user prompt
   * @param {Object} schema - JSON schema object
   * @param {Object} zodSchema - Optional Zod schema for additional validation
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Parsed and validated JSON response
   */
  async generateStructured(prompt, schema, zodSchema = null, options = {}) {
    try {
      const response = await this.ollama.chat({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        format: schema,
        ...this.defaultOptions,
        ...options
      });

      // Parse the JSON response
      const parsedData = JSON.parse(response.message.content);

      // Optional Zod validation for additional type safety
      if (zodSchema) {
        return zodSchema.parse(parsedData);
      }

      return parsedData;
    } catch (error) {
      if (error.name === 'ZodError') {
        throw new Error(`Schema validation failed: ${error.message}`);
      }
      throw new Error(`Ollama request failed: ${error.message}`);
    }
  }

  /**
   * Generate with retry logic for robustness
   * @param {string} prompt 
   * @param {Object} schema 
   * @param {Object} zodSchema 
   * @param {number} maxRetries 
   * @param {Object} options 
   * @returns {Promise<Object>}
   */
  async generateWithRetry(prompt, schema, zodSchema = null, maxRetries = 3, options = {}) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.generateStructured(prompt, schema, zodSchema, options);
      } catch (error) {
        lastError = error;
        console.warn(`Attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          // Add more explicit instructions on retry
          const retryPrompt = `${prompt}\n\nIMPORTANT: Respond with valid JSON only, following the exact schema format provided.`;
          prompt = retryPrompt;
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Check if the model is available
   * @returns {Promise<boolean>}
   */
  async isModelAvailable() {
    try {
      const models = await this.ollama.list();
      return models.models.some(m => m.name.includes(this.model));
    } catch (error) {
      console.error('Failed to check model availability:', error.message);
      return false;
    }
  }

  /**
   * Pull model if not available
   * @returns {Promise<void>}
   */
  async ensureModel() {
    const available = await this.isModelAvailable();
    if (!available) {
      console.log(`Pulling model: ${this.model}...`);
      await this.ollama.pull({ model: this.model });
      console.log(`Model ${this.model} pulled successfully`);
    }
  }
}

// Example schemas and usage - optimized for AI coding assistants
const schemas = {
  // Text analysis schema - useful for content analysis
  textAnalysis: {
    type: "object",
    properties: {
      sentiment: {
        type: "string",
        enum: ["positive", "negative", "neutral"]
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1
      },
      keywords: {
        type: "array",
        items: { type: "string" }
      },
      summary: {
        type: "string"
      }
    },
    required: ["sentiment", "confidence", "summary"]
  },

  // Code analysis schema - perfect for AI coding assistants
  codeAnalysis: {
    type: "object",
    properties: {
      language: { type: "string" },
      complexity: {
        type: "string",
        enum: ["low", "medium", "high"]
      },
      issues: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: { type: "string" },
            line: { type: "number" },
            description: { type: "string" },
            severity: { type: "string", enum: ["info", "warning", "error"] }
          },
          required: ["type", "description", "severity"]
        }
      },
      suggestions: {
        type: "array",
        items: { type: "string" }
      },
      testCoverage: { type: "string" },
      performance: { type: "string" }
    },
    required: ["language", "complexity", "issues", "suggestions"]
  },

  // File structure analysis - useful for project organization
  fileStructure: {
    type: "object",
    properties: {
      files: {
        type: "array",
        items: {
          type: "object",
          properties: {
            path: { type: "string" },
            type: { type: "string", enum: ["file", "directory"] },
            purpose: { type: "string" },
            importance: { type: "string", enum: ["critical", "important", "optional"] }
          },
          required: ["path", "type", "purpose", "importance"]
        }
      },
      structure_quality: { type: "string", enum: ["excellent", "good", "needs_improvement"] },
      recommendations: {
        type: "array",
        items: { type: "string" }
      }
    },
    required: ["files", "structure_quality"]
  },

  // API documentation schema - for generating docs
  apiDocumentation: {
    type: "object",
    properties: {
      endpoints: {
        type: "array",
        items: {
          type: "object",
          properties: {
            method: { type: "string", enum: ["GET", "POST", "PUT", "DELETE", "PATCH"] },
            path: { type: "string" },
            description: { type: "string" },
            parameters: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  type: { type: "string" },
                  required: { type: "boolean" },
                  description: { type: "string" }
                },
                required: ["name", "type", "required"]
              }
            },
            responses: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  status: { type: "number" },
                  description: { type: "string" }
                },
                required: ["status", "description"]
              }
            }
          },
          required: ["method", "path", "description"]
        }
      }
    },
    required: ["endpoints"]
  },

  // Task planning schema
  taskPlanning: {
    type: "object",
    properties: {
      tasks: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "number" },
            title: { type: "string" },
            description: { type: "string" },
            priority: {
              type: "string",
              enum: ["low", "medium", "high"]
            },
            estimatedHours: { type: "number" },
            dependencies: {
              type: "array",
              items: { type: "number" }
            }
          },
          required: ["id", "title", "description", "priority", "estimatedHours"]
        }
      },
      totalEstimatedHours: { type: "number" },
      criticalPath: {
        type: "array",
        items: { type: "number" }
      }
    },
    required: ["tasks", "totalEstimatedHours"]
  }
};

// Corresponding Zod schemas for additional validation
const zodSchemas = {
  textAnalysis: z.object({
    sentiment: z.enum(['positive', 'negative', 'neutral']),
    confidence: z.number().min(0).max(1),
    keywords: z.array(z.string()).optional(),
    summary: z.string().min(10)
  }),

  productRecommendation: z.object({
    recommendations: z.array(z.object({
      name: z.string().min(1),
      price: z.number().positive(),
      rating: z.number().min(1).max(5),
      reason: z.string().min(10)
    })),
    totalRecommendations: z.number().min(0)
  }),

  taskPlanning: z.object({
    tasks: z.array(z.object({
      id: z.number().positive(),
      title: z.string().min(1),
      description: z.string().min(10),
      priority: z.enum(['low', 'medium', 'high']),
      estimatedHours: z.number().positive(),
      dependencies: z.array(z.number()).optional()
    })),
    totalEstimatedHours: z.number().positive(),
    criticalPath: z.array(z.number()).optional()
  })
};

// Usage examples for AI assistants like Cline/Roo
async function examples() {
  const client = new OllamaStructuredClient({
    model: 'llama3.1',
    temperature: 0.1
  });

  // Ensure model is available
  console.log('Checking if model is available...');
  await client.ensureModel();

  try {
    // Example 1: Text Analysis - useful for content moderation, sentiment analysis
    console.log('=== Text Analysis Example ===');
    const textAnalysis = await client.generateStructured(
      "Analyze this customer review: 'The product was okay, delivery was slow but customer service was helpful. Mixed feelings overall.'",
      schemas.textAnalysis,
      zodSchemas.textAnalysis
    );
    console.log('Analysis Result:', JSON.stringify(textAnalysis, null, 2));

    // Example 2: Code Analysis - useful for AI coding assistants
    console.log('\n=== Code Analysis Example ===');
    const codeAnalysis = await client.generateStructured(
      `Analyze this JavaScript function:
      function processUser(user) {
        if (!user.name) return null;
        return { id: user.id, name: user.name.toUpperCase() };
      }`,
      schemas.codeAnalysis || {
        type: "object",
        properties: {
          complexity: { type: "string", enum: ["low", "medium", "high"] },
          issues: { type: "array", items: { type: "string" } },
          suggestions: { type: "array", items: { type: "string" } },
          testCoverage: { type: "string" }
        },
        required: ["complexity", "issues", "suggestions"]
      }
    );
    console.log('Code Analysis:', JSON.stringify(codeAnalysis, null, 2));

    // Example 3: Task Planning - useful for project management
    console.log('\n=== Task Planning Example ===');
    const taskPlan = await client.generateStructured(
      "Create a project plan for building a simple e-commerce website. Include 5-7 tasks with dependencies.",
      schemas.taskPlanning,
      zodSchemas.taskPlanning
    );
    console.log('Task Plan:', JSON.stringify(taskPlan, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Utility function to create custom schemas
function createCustomSchema(properties, required = []) {
  return {
    type: "object",
    properties,
    required
  };
}

// Export for use in other modules
module.exports = { 
  OllamaStructuredClient, 
  schemas, 
  zodSchemas, 
  createCustomSchema 
};

// Run examples if this file is executed directly (Node.js CommonJS check)
if (require.main === module) {
  examples().catch(console.error);
}