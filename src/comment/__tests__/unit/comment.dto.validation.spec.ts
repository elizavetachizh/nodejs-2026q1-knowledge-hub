import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { describe, it, expect } from 'vitest';
import { CreateCommentDto } from 'src/comment/dto/create-comment.dto';
import { UpdateCommentDto } from 'src/comment/dto/update-comment.dto';

const articleId = '550e8400-e29b-41d4-a716-446655440000';
const authorId = '660e8400-e29b-41d4-a716-446655440000';

describe('CommentDtoValidation', () => {
  describe('CreateCommentDto', () => {
    it('passes with content and articleId', async () => {
      const dto = new CreateCommentDto();
      dto.content = 'Nice read';
      dto.articleId = articleId;
      expect(await validate(dto)).toHaveLength(0);
    });

    it('passes with optional authorId', async () => {
      const dto = new CreateCommentDto();
      dto.content = 'Nice read';
      dto.articleId = articleId;
      dto.authorId = authorId;
      expect(await validate(dto)).toHaveLength(0);
    });

    it('fails when content is empty', async () => {
      const dto = new CreateCommentDto();
      dto.content = '';
      dto.articleId = articleId;
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'content')).toBe(true);
    });

    it('fails when articleId is not a UUID', async () => {
      const dto = new CreateCommentDto();
      dto.content = 'x';
      dto.articleId = 'nope';
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'articleId')).toBe(true);
    });

    it('fails when authorId is set but invalid UUID', async () => {
      const dto = plainToInstance(CreateCommentDto, {
        content: 'x',
        articleId,
        authorId: 'bad',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'authorId')).toBe(true);
    });
  });

  describe('UpdateCommentDto', () => {
    it('passes with non-empty content', async () => {
      const dto = new UpdateCommentDto();
      dto.content = 'Updated';
      expect(await validate(dto)).toHaveLength(0);
    });

    it('fails when content is empty', async () => {
      const dto = new UpdateCommentDto();
      dto.content = '';
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'content')).toBe(true);
    });
  });
});
