import { UserRole } from 'src/user/dto/create-user.dto';

export type JwtPayload = {
  userId: string;
  role: UserRole;
  login: string;
};

export type AuthRequest = { user: JwtPayload };
