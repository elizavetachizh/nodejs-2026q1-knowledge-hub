import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Comment } from './comment.types';
import { PrismaService } from 'prisma/prisma.service';
import { toCommentDto } from './utils/comment.mapper';

@Injectable()
export class CommentService {
  constructor(private readonly prisma: PrismaService) {}

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

  async createComment(createCommentDto: CreateCommentDto): Promise<Comment> {
    const article = await this.prisma.article.findUnique({
      where: { id: createCommentDto.articleId },
    });
    if (!article) {
      throw new UnprocessableEntityException(
        `Article with id ${createCommentDto.articleId} does not exist`,
      );
    }
    const comment = await this.prisma.comment.create({
      data: {
        content: createCommentDto.content,
        articleId: createCommentDto.articleId,
        authorId: createCommentDto.authorId,
      },
      include: {
        author: true,
      },
    });
    return toCommentDto(comment);
  }

  async deleteComment(id: string): Promise<void> {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
    });
    if (!comment) {
      throw new NotFoundException(`Comment with id ${id} not found`);
    }
    await this.prisma.comment.delete({
      where: { id },
    });
  }

  async deleteCommentByArticleId(articleId: string): Promise<void> {
    await this.prisma.comment.deleteMany({
      where: { articleId },
    });
  }
  async deleteCommentByAuthorId(authorId: string): Promise<void> {
    await this.prisma.comment.deleteMany({
      where: { authorId },
    });
  }
}
