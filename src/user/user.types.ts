import { UserRole } from './dto/create-user.dto';

export type InternalUser = {
  id: string;
  login: string;
  password: string; // only inside the service
  role: UserRole;
  createdAt: number;
  updatedAt: number;
};

export type PublicUser = Omit<InternalUser, 'password'>;
