import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CreateCommentDto } from './dto/create-comment.dto';
import { randomUUID } from 'node:crypto';
import { Comment } from './comment.types';
import { ArticleService } from '../article/article.service';

@Injectable()
export class CommentService {
  private comments: Comment[] = [];
  constructor(
    @Inject(forwardRef(() => ArticleService))
    private readonly articleService: ArticleService,
  ) {}

  getComments(articleId: string): Comment[] {
    return this.comments.filter((comment) => comment.articleId === articleId);
  }

  getComment(id: string): Comment {
    const comment = this.comments.find((comment) => comment.id === id);
    if (!comment) {
      throw new NotFoundException(`Comment with id ${id} not found`);
    }
    return comment;
  }

  createComment(createCommentDto: CreateCommentDto): Comment {
    const article = this.articleService.findArticleById(
      createCommentDto.articleId,
    );
    if (!article) {
      throw new UnprocessableEntityException(
        `Article with id ${createCommentDto.articleId} does not exist`,
      );
    }
    const comment: Comment = {
      id: randomUUID(),
      content: createCommentDto.content,
      articleId: createCommentDto.articleId,
      authorId: createCommentDto.authorId,
      createdAt: new Date().getTime(),
    };
    this.comments.push(comment);
    return comment;
  }

  deleteComment(id: string): void {
    const comment = this.comments.find((comment) => comment.id === id);
    if (!comment) {
      throw new NotFoundException(`Comment with id ${id} not found`);
    }
    this.comments = this.comments.filter((comment) => comment.id !== id);
  }

  deleteCommentByArticleId(articleId: string): void {
    this.comments = this.comments.filter((c) => c.articleId !== articleId);
  }
  deleteCommentByAuthorId(authorId: string): void {
    this.comments = this.comments.filter((c) => c.authorId !== authorId);
  }
}
