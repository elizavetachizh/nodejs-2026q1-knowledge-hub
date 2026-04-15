import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { PublicUser } from './user.types';
import { PrismaService } from 'prisma/prisma.service';
import { toPrismaRole, toPublicUser } from './utils/user.mapper';
import { User } from 'generated/prisma/browser';

@Injectable()
export class UserService {
  private getSaltRounds():number{
    return parseInt(process.env.CRYPT_SALT || '10');
  }
  private async findUserOrThrow(id: string): Promise<User>{
    const user = await this.prisma.user.findUnique({
      where: { id },
    });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }
  constructor(private readonly prisma: PrismaService) {}

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

  async createUser(createUserDto: CreateUserDto): Promise<PublicUser> {
    const user = await this.prisma.user.create({
      data: {
        login: createUserDto.login,
        password: createUserDto.password,
        role: toPrismaRole(createUserDto.role),
      },
    });
    return toPublicUser(user);
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
    if (user.password !== updatePasswordDto.oldPassword) {
      throw new ForbiddenException('Invalid password');
    }
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: {
        password: updatePasswordDto.newPassword,
      },
    });
    return toPublicUser(updatedUser);
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
