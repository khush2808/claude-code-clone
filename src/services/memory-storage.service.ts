import {
  BaseMessage,
  HumanMessage,
  AIMessage,
  ToolMessage,
} from '@langchain/core/messages';

/**
 * In-memory storage service - PRIMARY storage for CLI sessions
 * All reads during a session come from here
 * All writes go here first, then optionally to database
 */

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  state?: any;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  messages: Message[];
  toolCalls: ToolExecution[];
}

interface Message {
  id: string;
  conversationId: string;
  role: 'USER' | 'ASSISTANT' | 'TOOL';
  content: string;
  metadata?: any;
  createdAt: Date;
}

interface ToolExecution {
  id: string;
  conversationId: string;
  toolName: string;
  input: any;
  output?: any;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  error?: string;
  durationMs?: number;
  createdAt: Date;
  updatedAt: Date;
}

export class MemoryStorageService {
  private conversations: Map<string, Conversation> = new Map();
  private messageIdCounter = 0;
  private toolExecutionIdCounter = 0;

  createConversation(userId: string = 'default-user', title?: string): Conversation {
    const id = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    
    const conversation: Conversation = {
      id,
      userId,
      title: title || `Conversation ${now.toISOString()}`,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      messages: [],
      toolCalls: [],
    };

    this.conversations.set(id, conversation);
    return conversation;
  }

  getConversation(id: string): Conversation | null {
    return this.conversations.get(id) || null;
  }

  saveMessages(conversationId: string, messages: BaseMessage[]): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return;
    }

    const messageData: Message[] = messages.map((message) => ({
      id: `msg_${++this.messageIdCounter}`,
      conversationId,
      role: this.mapMessageRole(message),
      content:
        typeof message.content === 'string'
          ? message.content
          : JSON.stringify(message.content),
      metadata: {
        tool_calls:
          message instanceof AIMessage ? message.tool_calls : undefined,
        tool_call_id:
          message instanceof ToolMessage ? message.tool_call_id : undefined,
        name: message instanceof ToolMessage ? message.name : undefined,
      },
      createdAt: new Date(),
    }));

    conversation.messages.push(...messageData);
    conversation.updatedAt = new Date();
  }

  saveToolExecution(
    conversationId: string,
    toolName: string,
    input: any,
    output: any,
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' = 'COMPLETED'
  ): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return;
    }

    const now = new Date();
    const toolExecution: ToolExecution = {
      id: `tool_${++this.toolExecutionIdCounter}`,
      conversationId,
      toolName,
      input,
      output,
      status,
      createdAt: now,
      updatedAt: now,
    };

    conversation.toolCalls.push(toolExecution);
    conversation.updatedAt = now;
  }

  updateState(conversationId: string, state: any, step: number): void {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return;
    }

    conversation.state = state;
    conversation.updatedAt = new Date();
  }

  getConversationMessages(
    conversationId: string,
    limit: number = 20
  ): BaseMessage[] {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return [];
    }

    // Get most recent messages (last N)
    const recentMessages = conversation.messages
      .slice(-limit)
      .map((msg) => {
        const metadata = msg.metadata as any;

        switch (msg.role) {
          case 'USER':
            return new HumanMessage(msg.content);
          case 'ASSISTANT':
            return new AIMessage({
              content: msg.content,
              tool_calls: metadata?.tool_calls,
            });
          case 'TOOL':
            return new ToolMessage({
              content: msg.content,
              tool_call_id: metadata?.tool_call_id,
              name: metadata?.name,
            });
          default:
            return new HumanMessage(msg.content);
        }
      });

    return recentMessages;
  }

  private mapMessageRole(message: BaseMessage): 'USER' | 'ASSISTANT' | 'TOOL' {
    if (message instanceof HumanMessage) {
      return 'USER';
    } else if (message instanceof AIMessage) {
      return 'ASSISTANT';
    } else if (message instanceof ToolMessage) {
      return 'TOOL';
    } else {
      return 'USER';
    }
  }
}

export const memoryStorageService = new MemoryStorageService();

