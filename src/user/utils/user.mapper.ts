import { UserRole } from "../dto/create-user.dto";
import { UserRole as PrismaUserRole } from '../../../generated/prisma/enums';
import { PublicUser } from "../user.types";

export function toPrismaRole (role?: UserRole): PrismaUserRole {
    switch (role) {
      case UserRole.ADMIN:
        return PrismaUserRole.ADMIN;
      case UserRole.EDITOR:
        return PrismaUserRole.EDITOR;
      case UserRole.VIEWER:
      default:
        return PrismaUserRole.VIEWER;
    }
  }
  export function fromPrismaRole (role: PrismaUserRole): UserRole {
    switch (role) {
      case PrismaUserRole.ADMIN:
        return UserRole.ADMIN;
      case PrismaUserRole.EDITOR:
        return UserRole.EDITOR;
      case PrismaUserRole.VIEWER:
      default:
        return UserRole.VIEWER;
    }
  }
  export function toPublicUser(row: {
    id: string;
    login: string;
    role: PrismaUserRole;
    createdAt: Date;
    updatedAt: Date;
  }): PublicUser {
    return {
      id: row.id,
      login: row.login,
      role: fromPrismaRole(row.role),
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt.getTime(),
    };
  }