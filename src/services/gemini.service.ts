import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from '@google/generative-ai';
import {
  BaseMessage,
  HumanMessage,
  AIMessage,
  ToolMessage,
} from '@langchain/core/messages';

export class GeminiService {
  private client: GoogleGenerativeAI;
  private model: any;

  constructor() {
    this.client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    this.model = this.client.getGenerativeModel({
      model: 'gemini-3.5-flash-lite',
      safetySettings: [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
        },
      ],
    });
  }

  async generateResponse(
    messages: BaseMessage[],
    tools: any[] = [],
    workingDirectory?: string
  ): Promise<any> {
    try {
      // Convert LangChain messages to Gemini format
      const geminiMessages = this.convertMessagesToGemini(messages);

      // Convert tools to Gemini format
      const geminiTools = this.convertToolsToGemini(tools);

      // Configure model with tools if available
      let modelToUse = this.model;
      if (geminiTools.length > 0) {
        modelToUse = this.client.getGenerativeModel({
          model: 'gemini-3.5-flash-lite',
          tools: geminiTools,
          safetySettings: [
            {
              category: HarmCategory.HARM_CATEGORY_HARASSMENT,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
            {
              category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
          ],
        });
      }

      // Use generateContent directly instead of the deprecated SDK's chat
      // helper. That helper rewrites functionResponse turns to the legacy
      // "function" role, which Gemini 3-series models reject.
      const result = await modelToUse.generateContent({
        contents: geminiMessages,
        systemInstruction: {
          role: 'system',
          parts: [
            {
              text: `You are a proactive AI coding assistant with MCP tool access.

CORE PRINCIPLES:
1. Working Directory: ${workingDirectory || process.cwd()}
2. ALWAYS use tools - never fabricate or assume information
3. Use full absolute paths for file operations
4. Execute immediately without asking for confirmation unless genuinely ambiguous

TOOL USAGE RULES:
- To see files: list_directory or list_allowed_directories first
- To read content: read_file or read_multiple_files with full paths
- To create/modify: write_file with full path
- When user says "here" or "current directory", use: ${
                workingDirectory || process.cwd()
              }

WORKFLOW:
1. Understand the request
2. Use tools to gather needed information
3. Execute the action with tools
4. Report results concisely

EXAMPLES:
User: "list files" → list_directory("${workingDirectory || process.cwd()}")
User: "read package.json" → read_file("${
                workingDirectory || process.cwd()
              }/package.json")
User: "create test.js" → write_file("${
                workingDirectory || process.cwd()
              }/test.js", <content>)
User: "summarize the project" → list_directory → read relevant files → provide summary

Be direct, use tools proactively, and complete tasks efficiently.`,
            },
          ],
        },
      });

      // Parse the response
      const response = result.response;
      const text = response.text();

      // Check for function calls
      const functionCalls = response.functionCalls();
      const modelParts = response.candidates?.[0]?.content?.parts || [];

      return {
        content: text ? [{ type: 'text', text }] : [],
        function_calls: functionCalls || [],
        model_parts: modelParts,
        stop_reason:
          functionCalls && functionCalls.length > 0 ? 'tool_use' : 'end_turn',
      };
    } catch (error) {
      throw error;
    }
  }

  // Convert LangChain messages to Gemini format
  private convertMessagesToGemini(messages: BaseMessage[]): any[] {
    const geminiMessages: any[] = [];

    for (const message of messages) {
      if (message instanceof HumanMessage) {
        geminiMessages.push({
          role: 'user',
          parts: [{ text: message.content }],
        });
      } else if (message instanceof AIMessage) {
        const preservedParts = (message.additional_kwargs as any)
          ?.gemini_parts;
        if (Array.isArray(preservedParts) && preservedParts.length > 0) {
          geminiMessages.push({
            role: 'model',
            parts: preservedParts,
          });
          continue;
        }

        const parts: any[] = [];

        // Add text content
        if (message.content && typeof message.content === 'string') {
          parts.push({ text: message.content });
        }

        // Add function calls if present
        if (message.tool_calls) {
          for (const toolCall of message.tool_calls) {
            const toolCallAny = toolCall as any;
            parts.push({
              functionCall: {
                name: toolCallAny.function.name,
                args: JSON.parse(toolCallAny.function.arguments),
              },
            });
          }
        }

        geminiMessages.push({
          role: 'model',
          parts,
        });
      } else if (message instanceof ToolMessage) {
        // Gemini represents function responses as a user turn containing a
        // functionResponse part. The legacy "function" role is rejected by
        // Gemini 3-series models.
        const toolMsg = message as any;
        let responseContent;

        // Parse content if it's a string
        if (typeof message.content === 'string') {
          try {
            responseContent = JSON.parse(message.content);
          } catch {
            // If parsing fails, wrap it as text
            responseContent = { result: message.content };
          }
        } else {
          responseContent = message.content;
        }

        geminiMessages.push({
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: toolMsg.name || 'unknown_tool',
                response: responseContent,
              },
            },
          ],
        });
      }
    }

    return geminiMessages;
  }

  
   // Convert tools to Gemini format

  private convertToolsToGemini(tools: any[]): any[] {
    return tools.map((tool) => {
      // Clean up the inputSchema - remove JSON Schema metadata that Gemini doesn't accept
      const cleanSchema = this.cleanJsonSchema(tool.inputSchema);

      return {
        functionDeclarations: [
          {
            name: tool.name,
            description: tool.description || 'No description provided',
            parameters: cleanSchema,
          },
        ],
      };
    });
  }

  /**
   * Clean JSON Schema to match Gemini's expectations
   * Gemini accepts a subset of OpenAPI 3.0 rather than full JSON Schema.
   */
  private cleanJsonSchema(schema: any): any {
    if (!schema || typeof schema !== 'object') {
      return { type: 'object', properties: {} };
    }

    const declaredTypes = Array.isArray(schema.type)
      ? schema.type
      : schema.type
        ? [schema.type]
        : [];
    const nullable = declaredTypes.includes('null') || schema.nullable === true;
    const nonNullType = declaredTypes.find((type: unknown) => type !== 'null');
    const supportedTypes = new Set([
      'string',
      'number',
      'integer',
      'boolean',
      'array',
      'object',
    ]);
    const inferredType = schema.properties
      ? 'object'
      : schema.items
        ? 'array'
        : 'string';

    const cleaned: any = {
      type:
        typeof nonNullType === 'string' && supportedTypes.has(nonNullType)
          ? nonNullType
          : inferredType,
    };

    if (nullable) {
      cleaned.nullable = true;
    }

    if (schema.properties) {
      cleaned.properties = {};
      for (const [key, value] of Object.entries(schema.properties)) {
        cleaned.properties[key] = this.cleanJsonSchema(value);
      }
    }

    if (schema.items) {
      cleaned.items = this.cleanJsonSchema(schema.items);
    }

    if (schema.required && Array.isArray(schema.required)) {
      cleaned.required = schema.required;
    }

    if (schema.description) {
      cleaned.description = schema.description;
    }

    // Gemini's Schema enum is string[]; numeric/boolean JSON Schema enums
    // must be omitted instead of changing the tool's expected argument type.
    if (
      Array.isArray(schema.enum) &&
      schema.enum.every((value: unknown) => typeof value === 'string')
    ) {
      cleaned.enum = schema.enum;
    }

    if (schema.format) {
      cleaned.format = schema.format;
    }

    return cleaned;
  }
}

export const geminiService = new GeminiService();
