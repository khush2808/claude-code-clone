import { getPrismaClient, isDatabaseAvailable } from '../db/prisma';
import { memoryStorageService, Conversation } from './memory-storage.service';
import {
  BaseMessage,
  HumanMessage,
  AIMessage,
  ToolMessage,
} from '@langchain/core/messages';

/**
 * Conversation Service
 * 
 * PRIMARY: In-memory storage (all reads, all writes)
 * SECONDARY: Database storage (optional, for future features like resume/dashboard)
 * 
 * Strategy:
 * - All reads come from in-memory (fast, session-based)
 * - All writes go to in-memory first (primary)
 * - Also write to DB if available (secondary, for persistence)
 */

export class ConversationService {
  private dbAvailable: boolean | null = null;

  /**
   * Check if database is available (cached result)
   */
  private async checkDatabaseAvailability(): Promise<boolean> {
    if (this.dbAvailable === null) {
      this.dbAvailable = await isDatabaseAvailable();
    }
    return this.dbAvailable;
  }

  /**
   * Create conversation
   * - Always creates in memory (primary)
   * - Also creates in DB if available (secondary)
   */
  async createConversation(userId: string = 'default-user', title?: string): Promise<Conversation> {
    // Always create in memory first (primary)
    const conversation = memoryStorageService.createConversation(userId, title);

    // Also create in DB if available (secondary, for future features)
    const useDb = await this.checkDatabaseAvailability();
    const prisma = getPrismaClient();

    if (useDb && prisma) {
      try {
        await prisma.conversation.create({
          data: {
            id: conversation.id, // Use same ID for consistency
            userId,
            title: conversation.title,
          },
        });
      } catch (error) {
        // If DB fails, mark as unavailable but continue
        this.dbAvailable = false;
        // Don't throw - memory storage is primary
      }
    }

    return conversation;
  }

  /**
   * Get conversation
   * - Always reads from memory (primary)
   * - DB is only for future resume/dashboard features
   */
  async getConversation(id: string): Promise<Conversation | null> {
    // Always read from memory (primary)
    return memoryStorageService.getConversation(id);
  }

  /**
   * Save messages
   * - Always saves to memory (primary)
   * - Also saves to DB if available (secondary)
   */
  async saveMessages(
    conversationId: string,
    messages: BaseMessage[]
  ): Promise<void> {
    // Always save to memory first (primary)
    memoryStorageService.saveMessages(conversationId, messages);

    // Also save to DB if available (secondary)
    const useDb = await this.checkDatabaseAvailability();
    const prisma = getPrismaClient();

    if (useDb && prisma) {
      try {
        const messageData = messages.map((message) => ({
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
        }));

        await prisma.message.createMany({
          data: messageData,
        });
      } catch (error) {
        // If DB fails, mark as unavailable but continue
        this.dbAvailable = false;
        // Don't throw - memory storage is primary
      }
    }
  }

  /**
   * Save tool execution
   * - Always saves to memory (primary)
   * - Also saves to DB if available (secondary)
   */
  async saveToolExecution(
    conversationId: string,
    toolName: string,
    input: any,
    output: any,
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' = 'COMPLETED'
  ): Promise<void> {
    // Always save to memory first (primary)
    memoryStorageService.saveToolExecution(
      conversationId,
      toolName,
      input,
      output,
      status
    );

    // Also save to DB if available (secondary)
    const useDb = await this.checkDatabaseAvailability();
    const prisma = getPrismaClient();

    if (useDb && prisma) {
      try {
        await prisma.toolExecution.create({
          data: {
            conversationId,
            toolName,
            input,
            output,
            status,
          },
        });
      } catch (error) {
        // If DB fails, mark as unavailable but continue
        this.dbAvailable = false;
        // Don't throw - memory storage is primary
      }
    }
  }

  /**
   * Update state
   * - Always updates memory (primary)
   * - Also updates DB if available (secondary)
   */
  async updateState(
    conversationId: string,
    state: any,
    step: number
  ): Promise<void> {
    // Always update memory first (primary)
    memoryStorageService.updateState(conversationId, state, step);

    // Also update DB if available (secondary)
    const useDb = await this.checkDatabaseAvailability();
    const prisma = getPrismaClient();

    if (useDb && prisma) {
      try {
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { state },
        });

        await prisma.stateCheckpoint.create({
          data: {
            conversationId,
            state,
            step,
          },
        });
      } catch (error) {
        // If DB fails, mark as unavailable but continue
        this.dbAvailable = false;
        // Don't throw - memory storage is primary
      }
    }
  }

  /**
   * Get conversation messages
   * - Always reads from memory (primary, fast, session-based)
   */
  async getConversationMessages(
    conversationId: string,
    limit: number = 20
  ): Promise<BaseMessage[]> {
    // Always read from memory (primary)
    return memoryStorageService.getConversationMessages(conversationId, limit);
  }

  /**
   * Map LangChain message types to Prisma enum
   */
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

export const conversationService = new ConversationService();
