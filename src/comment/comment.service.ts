import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Comment } from './comment.types';
import { PrismaService } from 'prisma/prisma.service';
import { toCommentDto } from './utils/comment.mapper';
import { JwtPayload } from '../auth/auth.types';
import { UserRole } from '../user/dto/create-user.dto';

@Injectable()
export class CommentService {
  constructor(private readonly prisma: PrismaService) {}

  private assertEditorOwnsComment(actor: JwtPayload, authorId: string | null) {
    if (actor.role === UserRole.ADMIN) return;
    if (actor.role === UserRole.EDITOR) {
      if (!authorId) {
        throw new ForbiddenException(
          'Editor can not modify comment without author',
        );
      }
      if (authorId !== actor.userId) {
        throw new ForbiddenException('Editor can modify only own comments');
      }
      return;
    }

    throw new ForbiddenException('Insufficient permissions');
  }

  async getComments(articleId: string): Promise<Comment[]> {
    const raws = await this.prisma.comment.findMany({
      where: { articleId },
      include: {
        author: true,
      },
    });
    return raws.map((row) => toCommentDto(row));
  }

  async getComment(id: string): Promise<Comment> {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
    });
    if (!comment) {
      throw new NotFoundException(`Comment with id ${id} not found`);
    }
    return toCommentDto(comment);
  }

  async createComment(
    createCommentDto: CreateCommentDto,
    actor: JwtPayload,
  ): Promise<Comment> {
    let finalAuthorId: string | null;
    const article = await this.prisma.article.findUnique({
      where: { id: createCommentDto.articleId },
    });
    if (!article) {
      throw new UnprocessableEntityException(
        `Article with id ${createCommentDto.articleId} does not exist`,
      );
    }

    if (actor.role === UserRole.ADMIN) {
      finalAuthorId = createCommentDto.authorId;
    } else if (actor.role === UserRole.EDITOR) {
      finalAuthorId = actor.userId;
    } else {
      throw new ForbiddenException('Insufficient permissions');
    }
    this.assertEditorOwnsComment(actor, finalAuthorId);

    const comment = await this.prisma.comment.create({
      data: {
        content: createCommentDto.content,
        articleId: createCommentDto.articleId,
        authorId: actor.userId,
      },
      include: {
        author: true,
      },
    });
    return toCommentDto(comment);
  }

  async deleteComment(id: string, actor: JwtPayload): Promise<void> {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
    });
    if (!comment) {
      throw new NotFoundException(`Comment with id ${id} not found`);
    }
    this.assertEditorOwnsComment(actor, comment.authorId);
    await this.prisma.comment.delete({
      where: { id },
    });
  }
}
