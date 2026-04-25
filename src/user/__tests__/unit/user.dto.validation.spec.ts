import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateUserDto, UserRole } from 'src/user/dto/create-user.dto';
import { UpdatePasswordDto, UpdateUserRoleDto } from 'src/user/dto/update-password.dto';
import { describe, it, expect } from 'vitest';

describe('UserDtoValidation', () => {
  describe('CreateUserDto', () => {
    it('passes with login, password and default optional role', async () => {
      const dto = new CreateUserDto();
      dto.login = 'user1';
      dto.password = 'password1';
      expect(await validate(dto)).toHaveLength(0);
    });

    it('passes with explicit role', async () => {
      const dto = new CreateUserDto();
      dto.login = 'user1';
      dto.password = 'password1';
      dto.role = UserRole.EDITOR;
      expect(await validate(dto)).toHaveLength(0);
    });

    it('fails when login is empty', async () => {
      const dto = new CreateUserDto();
      dto.login = '';
      dto.password = 'password1';
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'login')).toBe(true);
    });

    it('fails when password is empty', async () => {
      const dto = new CreateUserDto();
      dto.login = 'user1';
      dto.password = '';
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });

    it('fails when role is not a valid enum value', async () => {
      const dto = plainToInstance(CreateUserDto, {
        login: 'user1',
        password: 'password1',
        role: 'superadmin',
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'role')).toBe(true);
    });
  });

  describe('UpdatePasswordDto', () => {
    it('passes with both passwords set', async () => {
      const dto = new UpdatePasswordDto();
      dto.oldPassword = 'password1';
      dto.newPassword = 'password2';
      expect(await validate(dto)).toHaveLength(0);
    });

    it('fails when oldPassword is empty', async () => {
      const dto = new UpdatePasswordDto();
      dto.oldPassword = '';
      dto.newPassword = 'password2';
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'oldPassword')).toBe(true);
    });

    it('fails when newPassword is empty', async () => {
      const dto = new UpdatePasswordDto();
      dto.oldPassword = 'password1';
      dto.newPassword = '';
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'newPassword')).toBe(true);
    });
  });

  describe('UpdateUserRoleDto', () => {
    it('passes with valid role', async () => {
      const dto = new UpdateUserRoleDto();
      dto.role = UserRole.ADMIN;
      expect(await validate(dto)).toHaveLength(0);
    });

    it('fails when role is invalid', async () => {
      const dto = plainToInstance(UpdateUserRoleDto, { role: 'guest' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'role')).toBe(true);
    });
  });
});
