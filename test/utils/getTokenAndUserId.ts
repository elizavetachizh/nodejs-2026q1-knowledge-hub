import { authRoutes } from '../endpoints';
import promoteUserRole from './promoteUserRole';
import { StatusCodes } from 'http-status-codes';

const getTokenAndUserId = async (request) => {
  const createUserDto = {
    login: `TEST_AUTH_LOGIN_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    password: 'Tu6!@#%&',
  };

  // create user (signup always yields a viewer per spec)
  const signupResponse = await request
    .post(authRoutes.signup)
    .set('Accept', 'application/json')
    .send(createUserDto);

  if (signupResponse.status !== StatusCodes.CREATED || !signupResponse.body?.id) {
    throw new Error(
      `Authorization setup failed on signup: ${signupResponse.status} ${JSON.stringify(signupResponse.body)}`,
    );
  }
  const mockUserId = signupResponse.body.id;

  // promote directly in DB so base tests run as admin and can mutate
  await promoteUserRole(mockUserId, 'admin');

  // get token after promotion so the JWT payload role === 'admin'
  const loginResponse = await request
    .post(authRoutes.login)
    .set('Accept', 'application/json')
    .send(createUserDto);

  if (loginResponse.status !== StatusCodes.OK || !loginResponse.body?.accessToken) {
    throw new Error(
      `Authorization setup failed on login: ${loginResponse.status} ${JSON.stringify(loginResponse.body)}`,
    );
  }
  const { accessToken, refreshToken } = loginResponse.body;

  const token = `Bearer ${accessToken}`;

  return {
    token,
    accessToken,
    refreshToken,
    mockUserId,
    login: createUserDto.login,
  };
};

export default getTokenAndUserId;
