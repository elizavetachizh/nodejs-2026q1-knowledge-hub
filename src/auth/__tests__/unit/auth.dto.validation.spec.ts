import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { LoginDto } from 'src/auth/dto/login.dto';
import { LogoutDto, RefreshDto } from 'src/auth/dto/refresh.dto';
import { SignupDto } from 'src/auth/dto/signup.dto';
import { describe, it, expect } from 'vitest';

describe('AuthDtoValidation', () => {
  describe('LoginDto', () => {
    it('fails when password is empty', async () => {
      const loginDto = new LoginDto();
      loginDto.login = 'user1';
      loginDto.password = '';
      const errors = await validate(loginDto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('password');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('fails when login is empty', async () => {
      const loginDto = new LoginDto();
      loginDto.login = '';
      loginDto.password = 'secret';
      const errors = await validate(loginDto);
      expect(errors.some((e) => e.property === 'login')).toBe(true);
    });

    it('passes with valid payload', async () => {
      const loginDto = new LoginDto();
      loginDto.login = 'user1';
      loginDto.password = 'secret';
      expect(await validate(loginDto)).toHaveLength(0);
    });
  });

  describe('SignupDto', () => {
    it('fails when password is empty', async () => {
      const signupDto = new SignupDto();
      signupDto.login = 'user1';
      signupDto.password = '';
      const errors = await validate(signupDto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('password');
      expect(errors[0].constraints).toHaveProperty('isNotEmpty');
    });

    it('passes with valid payload', async () => {
      const signupDto = new SignupDto();
      signupDto.login = 'user1';
      signupDto.password = 'secret';
      expect(await validate(signupDto)).toHaveLength(0);
    });
  });

  describe('RefreshDto', () => {
    it('passes when refreshToken is omitted', async () => {
      const dto = plainToInstance(RefreshDto, {});
      expect(await validate(dto)).toHaveLength(0);
    });

    it('passes when refreshToken is empty string (@IsOptional skips only null/undefined)', async () => {
      const dto = plainToInstance(RefreshDto, { refreshToken: '' });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('fails when refreshToken is not a string', async () => {
      const dto = plainToInstance(RefreshDto, { refreshToken: 123 });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('refreshToken');
      expect(errors[0].constraints).toHaveProperty('isString');
    });
  });

  describe('LogoutDto', () => {
    it('passes when refreshToken is omitted', async () => {
      const dto = plainToInstance(LogoutDto, {});
      expect(await validate(dto)).toHaveLength(0);
    });

    it('passes when refreshToken is empty string', async () => {
      const dto = plainToInstance(LogoutDto, { refreshToken: '' });
      expect(await validate(dto)).toHaveLength(0);
    });

    it('fails when refreshToken is not a string', async () => {
      const dto = plainToInstance(LogoutDto, { refreshToken: true });
      const errors = await validate(dto);
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('refreshToken');
      expect(errors[0].constraints).toHaveProperty('isString');
    });
  });
});
