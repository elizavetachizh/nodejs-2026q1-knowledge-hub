import { authRoutes } from '../endpoints';
import promoteUserRole from './promoteUserRole';
import { StatusCodes } from 'http-status-codes';

const getUserTokenByRole = async (
  request,
  role: 'admin' | 'editor' | 'viewer',
  // kept for signature compatibility with existing RBAC specs; unused now
  // because role promotion happens directly via Prisma
  _adminHeaders?: Record<string, string>,
) => {
  const login = `TEST_RBAC_${role.toUpperCase()}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const password = 'TestPass123!';

  // Create user via signup (defaults to viewer)
  const signupResponse = await request
    .post(authRoutes.signup)
    .set({ Accept: 'application/json' })
    .send({ login, password });

  if (signupResponse.status !== StatusCodes.CREATED || !signupResponse.body?.id) {
    throw new Error(
      `Failed to create ${role} user: ${signupResponse.status} ${JSON.stringify(signupResponse.body)}`,
    );
  }
  const { id: userId } = signupResponse.body;

  if (!userId) {
    throw new Error(`Failed to create ${role} user`);
  }

  if (role !== 'viewer') {
    await promoteUserRole(userId, role);
  }

  // Login AFTER promotion so JWT payload carries the correct role
  const loginResponse = await request
    .post(authRoutes.login)
    .set({ Accept: 'application/json' })
    .send({ login, password });

  if (loginResponse.status !== StatusCodes.OK || !loginResponse.body?.accessToken) {
    throw new Error(
      `Failed to login as ${role} user: ${loginResponse.status} ${JSON.stringify(loginResponse.body)}`,
    );
  }
  const { accessToken } = loginResponse.body;

  if (!accessToken) {
    throw new Error(`Failed to login as ${role} user`);
  }

  return {
    token: `Bearer ${accessToken}`,
    userId,
    login,
    role,
  };
};

export default getUserTokenByRole;
