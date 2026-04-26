import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

type Role = 'viewer' | 'editor' | 'admin';
type DbRole = 'VIEWER' | 'EDITOR' | 'ADMIN';

const toDbRole = (role: Role): DbRole => {
  if (role === 'admin') {
    return 'ADMIN';
  }

  if (role === 'editor') {
    return 'EDITOR';
  }

  return 'VIEWER';
};

const promoteUserRole = async (userId: string, role: Role): Promise<void> => {
  var connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not defined');
  }

  var pool = new Pool({ connectionString });
  var adapter = new PrismaPg(pool);
  var prisma = new PrismaClient({ adapter });

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        role: toDbRole(role),
      },
    });
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
};

export default promoteUserRole;