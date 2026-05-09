import { describe, it, expect } from 'vitest';
import { AppService } from './app.service';

describe('AppService', () => {
  it('getHello returns greeting', () => {
    expect(new AppService().getHello()).toBe('Hello World!');
  });
});
