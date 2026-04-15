import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import {
  fromPrismaRole,
  toPrismaRole,
  toPublicUser,
} from 'src/user/utils/user.mapper';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from 'src/user/dto/create-user.dto';
import { JwtPayload, PublicUser } from 'src/user/user.types';
import { Prisma } from 'generated/prisma/client';
import { RefreshDto } from './dto/refresh.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  //helpers
  private getAccessSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not set');
    }
    return secret;
  }

  private getRefreshSecret(): string {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) {
      throw new Error('JWT_REFRESH_SECRET is not set');
    }
    return secret;
  }

  private getAccessTtl(): string {
    return process.env.JWT_ACCESS_TTL ?? '15m';
  }

  private getRefreshTtl(): string {
    return process.env.JWT_REFRESH_TTL ?? '7d';
  }

  private getSaltRounds(): number {
    const parsed = Number(process.env.CRYPT_SALT);
    if (!Number.isFinite(parsed) || parsed <= 0) return 10;
    return parsed;
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

  private async issueTokens(
    payload: JwtPayload,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = this.jwtService.signAsync(payload, {
      secret: this.getAccessSecret(),
      expiresIn: this.getAccessTtl(),
    });
    const refreshToken = this.jwtService.signAsync(payload, {
      secret: this.getRefreshSecret(),
      expiresIn: this.getRefreshTtl(),
    });
    return { accessToken: await accessToken, refreshToken: await refreshToken };
  }

  private async saveRefreshHash(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const refreshTokenHash = await bcrypt.hash(
      refreshToken,
      this.getSaltRounds(),
    );
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshTokenHash },
    });
  }

  async login(
    loginDto: LoginDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { login: loginDto.login },
    });
    if (!user) {
      throw new ForbiddenException('Authentication failed');
    }

    const passwordOk = await bcrypt.compare(loginDto.password, user.password);
    if (!passwordOk) {
      throw new ForbiddenException('Authentication failed');
    }
    const payload: JwtPayload = {
      userId: user.id,
      role: fromPrismaRole(user.role),
      login: user.login,
    };
    const tokens = await this.issueTokens(payload);
    await this.saveRefreshHash(user.id, tokens.refreshToken);
    return tokens;
  }

  async signup(signupDto: SignupDto): Promise<PublicUser> {
    const existing = await this.prisma.user.findUnique({
      where: { login: signupDto.login },
    });
    if (existing) {
      throw new BadRequestException('Login already taken');
    }

    try {
      const hashedPassword = await bcrypt.hash(
        signupDto.password,
        this.getSaltRounds(),
      );

      const user = await this.prisma.user.create({
        data: {
          login: signupDto.login,
          password: hashedPassword,
          role: toPrismaRole(UserRole.VIEWER),
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

  async refreshToken(
    refreshTokenDto: RefreshDto,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    if (!refreshTokenDto.refreshToken) {
      throw new UnauthorizedException('No refresh token provided');
    }
    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync(
        refreshTokenDto.refreshToken,
        {
          secret: this.getRefreshSecret(),
        },
      );
    } catch {
      throw new ForbiddenException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.userId },
    });
    if (!user || !user.refreshTokenHash) {
      throw new ForbiddenException('Invalid refresh token');
    }
    const rtMatches = await bcrypt.compare(
      refreshTokenDto.refreshToken,
      user.refreshTokenHash,
    );
    if (!rtMatches) throw new ForbiddenException('Invalid refresh token');
    const newPayload: JwtPayload = {
      userId: user.id,
      role: fromPrismaRole(user.role),
      login: user.login,
    };
    const newTokens = await this.issueTokens(newPayload);
    await this.saveRefreshHash(user.id, newTokens.refreshToken);
    return newTokens;
  }
}
