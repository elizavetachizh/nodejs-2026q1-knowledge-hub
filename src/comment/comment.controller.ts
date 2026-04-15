import {
  Controller,
  Get,
  Post,
  Param,
  ParseUUIDPipe,
  Body,
  HttpCode,
  Delete,
  Query,
  Req,
} from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { CommentService } from './comment.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { PageDto } from 'src/common/dto/page-query.dto';
import { sortData } from 'src/common/utils/sort';
import { Comment } from './comment.types';
import { AuthRequest } from '../auth/auth.types';

@ApiTags('Comment')
@Controller('comment')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Get()
  @ApiQuery({
    name: 'articleId',
    required: true,
    type: String,
    description: 'Article id to fetch comments',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    type: String,
    description: 'Sort by field',
  })
  @ApiQuery({
    name: 'order',
    required: false,
    type: String,
    description: 'Sort order',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Limit number',
  })
  async getComments(
    @Query('articleId', ParseUUIDPipe) articleId: string,
    @Query('sortBy') sortBy?: string,
    @Query('order') order?: 'asc' | 'desc',
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query() rawQuery?: Record<string, unknown>,
  ): Promise<Comment[] | PageDto<Comment>> {
    const comments: Comment[] =
      await this.commentService.getComments(articleId);
    const hasSorting =
      typeof rawQuery?.sortBy === 'string' &&
      (rawQuery.sortBy as string).length > 0;
    const sortedComments = hasSorting
      ? sortData<Comment>(comments, sortBy, order, ['content', 'authorId'])
      : comments;
    const hasPagination =
      rawQuery?.page !== undefined || rawQuery?.limit !== undefined;
    if (hasPagination) {
      const safePage = page ?? 1;
      const safeLimit = limit ?? 10;
      const pagedComments = sortedComments.slice(
        (safePage - 1) * safeLimit,
        safePage * safeLimit,
      );
      return new PageDto(
        pagedComments,
        sortedComments.length,
        safePage,
        safeLimit,
      );
    }
    return sortedComments;
  }

  @Get(':id')
  async getComment(@Param('id', ParseUUIDPipe) id: string) {
    return this.commentService.getComment(id);
  }

  @Post()
  async createComment(
    @Req() request: AuthRequest,
    @Body() createCommentDto: CreateCommentDto,
  ) {
    return this.commentService.createComment(createCommentDto, request.user);
  }

  @Delete(':id')
  @HttpCode(204)
  async deleteComment(
    @Req() request: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.commentService.deleteComment(id, request.user);
  }
}
