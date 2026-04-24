import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { describe, it, expect } from 'vitest';
import {
  ArticleStatus,
  CreateArticleDto,
} from 'src/article/dto/create-article.dto';
import { UpdateArticleDto } from 'src/article/dto/update-article.dto';

const validAuthorId = '550e8400-e29b-41d4-a716-446655440000';
const validCategoryId = '660e8400-e29b-41d4-a716-446655440000';

describe('ArticleDtoValidation', () => {
  describe('CreateArticleDto', () => {
    it('passes with title and content only', async () => {
      const dto = new CreateArticleDto();
      dto.title = 'title1';
      dto.content = 'content1';
      expect(await validate(dto)).toHaveLength(0);
    });

    it('passes when deserialized from plain object with valid optionals', async () => {
      const dto = plainToInstance(CreateArticleDto, {
        title: 'title1',
        content: 'content1',
        status: ArticleStatus.DRAFT,
        authorId: validAuthorId,
        categoryId: validCategoryId,
        tags: ['a', 'b'],
      });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('fails when title is empty', async () => {
      const dto = new CreateArticleDto();
      dto.title = '';
      dto.content = 'content1';
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'title')).toBe(true);
    });

    it('fails when content is empty', async () => {
      const dto = new CreateArticleDto();
      dto.title = 'title1';
      dto.content = '';
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'content')).toBe(true);
    });

    it('fails when status is not a valid enum value', async () => {
      const dto = plainToInstance(CreateArticleDto, {
        title: 'title1',
        content: 'content1',
        status: 'invalid',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'status')).toBe(true);
    });

    it('fails when authorId is set but not a UUID', async () => {
      const dto = new CreateArticleDto();
      dto.title = 'title1';
      dto.content = 'content1';
      dto.authorId = 'not-a-uuid';
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'authorId')).toBe(true);
    });

    it('fails when categoryId is set but not a UUID', async () => {
      const dto = new CreateArticleDto();
      dto.title = 'title1';
      dto.content = 'content1';
      dto.categoryId = 'not-a-uuid';
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'categoryId')).toBe(true);
    });

    it('fails when tags is not an array', async () => {
      const dto = plainToInstance(CreateArticleDto, {
        title: 'title1',
        content: 'content1',
        tags: 'oops',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'tags')).toBe(true);
    });

    it('fails when a tag is not a string', async () => {
      const dto = plainToInstance(CreateArticleDto, {
        title: 'title1',
        content: 'content1',
        tags: ['ok', 1],
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'tags')).toBe(true);
    });
  });

  describe('UpdateArticleDto', () => {
    it('passes with title and content only', async () => {
      const dto = new UpdateArticleDto();
      dto.title = 'title1';
      dto.content = 'content1';
      expect(await validate(dto)).toHaveLength(0);
    });

    it('passes with all optional fields set to valid values', async () => {
      const dto = new UpdateArticleDto();
      dto.title = 'title1';
      dto.content = 'content1';
      dto.status = ArticleStatus.PUBLISHED;
      dto.authorId = validAuthorId;
      dto.categoryId = validCategoryId;
      dto.tags = ['tag1', 'tag2'];
      expect(await validate(dto)).toHaveLength(0);
    });

    it('fails when title is empty', async () => {
      const dto = new UpdateArticleDto();
      dto.title = '';
      dto.content = 'content1';
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'title')).toBe(true);
    });

    it('fails when content is empty', async () => {
      const dto = new UpdateArticleDto();
      dto.title = 'title1';
      dto.content = '';
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'content')).toBe(true);
    });

    it('fails when status is not a valid enum value', async () => {
      const dto = plainToInstance(UpdateArticleDto, {
        title: 'title1',
        content: 'content1',
        status: 'invalid',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'status')).toBe(true);
    });

    it('fails when authorId is set but not a UUID', async () => {
      const dto = new UpdateArticleDto();
      dto.title = 'title1';
      dto.content = 'content1';
      dto.authorId = 'not-a-uuid';
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'authorId')).toBe(true);
    });

    it('fails when categoryId is set but not a UUID', async () => {
      const dto = new UpdateArticleDto();
      dto.title = 'title1';
      dto.content = 'content1';
      dto.categoryId = 'not-a-uuid';
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'categoryId')).toBe(true);
    });

    it('fails when tags is not an array', async () => {
      const dto = plainToInstance(UpdateArticleDto, {
        title: 'title1',
        content: 'content1',
        tags: {},
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'tags')).toBe(true);
    });
  });
});
