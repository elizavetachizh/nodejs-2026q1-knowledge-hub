import {
  ArgumentMetadata,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { describe, it, expect } from 'vitest';

const paramMeta: ArgumentMetadata = {
  type: 'param',
  metatype: String,
  data: 'id',
};

describe('ParseUUIDPipe', () => {
  it('returns the same string for a valid UUID', async () => {
    const pipe = new ParseUUIDPipe();
    const id = '550e8400-e29b-41d4-a716-446655440000';
    await expect(pipe.transform(id, paramMeta)).resolves.toBe(id);
  });

  it('accepts UUID when version is fixed to 4', async () => {
    const pipe = new ParseUUIDPipe({ version: '4' });
    const id = '550e8400-e29b-41d4-a716-446655440000';
    await expect(pipe.transform(id, paramMeta)).resolves.toBe(id);
  });

  it('throws BadRequestException for malformed string', async () => {
    const pipe = new ParseUUIDPipe();
    await expect(
      pipe.transform('not-a-uuid', paramMeta),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws BadRequestException for empty string', async () => {
    const pipe = new ParseUUIDPipe();
    await expect(pipe.transform('', paramMeta)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('throws BadRequestException when UUID is not v4 but v4 is required', async () => {
    const pipe = new ParseUUIDPipe({ version: '4' });
    const v1 = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
    await expect(pipe.transform(v1, paramMeta)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('optional pipe allows undefined', async () => {
    const pipe = new ParseUUIDPipe({ optional: true });
    await expect(pipe.transform(undefined, paramMeta)).resolves.toBeUndefined();
  });
});
