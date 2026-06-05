import { ConversationUserRole as PrismaConversationUserRole } from 'generated/prisma/enums';
import { ConversationUserRole } from '../rag.types';

export function toPrismaConversationRole(
  role: ConversationUserRole,
): PrismaConversationUserRole {
  switch (role) {
    case ConversationUserRole.ASSISTANT:
      return PrismaConversationUserRole.ASSISTANT;
    case ConversationUserRole.USER:
    default:
      return PrismaConversationUserRole.USER;
  }
}

export function fromPrismaConversationRole(
  role: PrismaConversationUserRole,
): ConversationUserRole {
  switch (role) {
    case PrismaConversationUserRole.ASSISTANT:
      return ConversationUserRole.ASSISTANT;
    case PrismaConversationUserRole.USER:
    default:
      return ConversationUserRole.USER;
  }
}
