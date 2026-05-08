import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { toPrismaConversationRole } from './utils/conversation-role.mapper';
import { ConversationUserRole } from './rag.types';

@Injectable()
export class RagConversationService {
  constructor(private readonly prisma: PrismaService) {}
  private readonly conversationMaxMessages = Number(
    process.env.RAG_CONVERSATION_MAX_MESSAGES ?? 20,
  );

  private normalizeLimit(limit?: number): number {
    const raw = Number(limit ?? this.conversationMaxMessages);
    if (!Number.isFinite(raw) || raw <= 0) return 20;
    return Math.floor(raw);
  }

  async appendUserMessage(conversationId: string, question: string) {
    return this.prisma.ragConversationMessage.create({
      data: {
        conversationId,
        role: toPrismaConversationRole(ConversationUserRole.USER),
        content: question,
      },
    });
  }
  async appendAssistantMessage(conversationId: string, answer: string) {
    return this.prisma.ragConversationMessage.create({
      data: {
        conversationId,
        role: toPrismaConversationRole(ConversationUserRole.ASSISTANT),
        content: answer,
      },
    });
  }
  async getHistory(conversationId: string) {
    return this.prisma.ragConversationMessage.findMany({
      where: {
        conversationId,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }
  async getRecentHistory(conversationId: string, limit?: number) {
    const normalizedLimit = this.normalizeLimit(limit);
    const messages = await this.prisma.ragConversationMessage.findMany({
      where: {
        conversationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: normalizedLimit,
    });
    return messages.reverse();
  }
  async trimHistory(conversationId: string, limit?: number) {
    const normalizedLimit = this.normalizeLimit(limit);
    const messages = await this.prisma.ragConversationMessage.findMany({
      where: {
        conversationId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: { id: true },
    });
    if (messages.length <= normalizedLimit) return 0;

    const toDelete = messages.slice(normalizedLimit).map((m) => m.id);
    const result = await this.prisma.ragConversationMessage.deleteMany({
      where: {
        id: {
          in: toDelete,
        },
      },
    });
    return result.count;
  }
}
