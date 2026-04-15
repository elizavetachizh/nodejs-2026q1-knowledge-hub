import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto, UserRole } from './dto/create-user.dto';
import {
  UpdatePasswordDto,
  UpdateUserRoleDto,
} from './dto/update-password.dto';
import { PublicUser } from './user.types';
import { PrismaService } from 'prisma/prisma.service';
import { toPrismaRole, toPublicUser } from './utils/user.mapper';
import { JwtPayload } from 'src/auth/auth.types';
import * as bcrypt from 'bcrypt';
import { Prisma } from 'generated/prisma/client';
import { UsersWriteService } from './user-credentials.service';

@Injectable()
export class UserService {
  private getSaltRounds(): number {
    return parseInt(process.env.CRYPT_SALT || '10');
  }

  private isPrismaUniqueConstraintError(
    error: unknown,
    field: string,
  ): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;

    if (error.code !== 'P2002') return false;
    const target = error.meta?.target;
    if (!Array.isArray(target)) return false;
    return target.includes(field);
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersWriteService: UsersWriteService,
  ) {}

  async getUsers(): Promise<PublicUser[]> {
    const users = await this.prisma.user.findMany();
    return users.map((user) => toPublicUser(user));
  }

  async getUser(id: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return toPublicUser(user);
  }

  async createUser(
    createUserDto: CreateUserDto,
    actor: JwtPayload,
  ): Promise<PublicUser> {
    if (actor.role === UserRole.ADMIN) {
      return this.usersWriteService.createUserWithPassword({
        login: createUserDto.login,
        password: createUserDto.password,
        role: createUserDto.role,
      });
    } else {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  async updateUser(
    id: string,
    updatePasswordDto: UpdatePasswordDto,
  ): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    const passwordOk = await bcrypt.compare(
      updatePasswordDto.oldPassword,
      user.password,
    );
    if (!passwordOk) {
      throw new ForbiddenException('Invalid password');
    }

    try {
      const hashedPassword = await bcrypt.hash(
        updatePasswordDto.newPassword,
        this.getSaltRounds(),
      );

      const user = await this.prisma.user.update({
        where: { id },
        data: {
          password: hashedPassword,
        },
      });
      return toPublicUser(user);
    } catch (error) {
      if (this.isPrismaUniqueConstraintError(error, 'login')) {
        throw new BadRequestException('Login already taken');
      }
      throw error;
    }
  }

  async updateUserRole(
    id: string,
    updateUserRoleDto: UpdateUserRoleDto,
    actor: JwtPayload,
  ): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    if (actor.role === UserRole.ADMIN) {
      const updatedUser = await this.prisma.user.update({
        where: { id },
        data: { role: toPrismaRole(updateUserRoleDto.role) },
      });
      return toPublicUser(updatedUser);
    } else {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  async deleteUser(id: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.article.updateMany({
        where: { authorId: id },
        data: { authorId: null },
      });
      await tx.user.delete({
        where: { id },
      });
    });
  }
}
