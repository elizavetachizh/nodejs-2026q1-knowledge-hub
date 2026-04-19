import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { ArticleStatus, UserRole } from '../generated/prisma/enums';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  
  await prisma.comment.deleteMany();
  await prisma.article.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();


  const hashedPasswordAdmin = await bcrypt.hash('admin123', 10);
  const hashedPasswordEditor = await bcrypt.hash('editor123', 10);
  // users
  const admin = await prisma.user.create({
    data: {
      login: 'admin',
      password: hashedPasswordAdmin,
      role: UserRole.ADMIN,
    },
  });

  const editor = await prisma.user.create({
    data: {
      login: 'editor',
      password: hashedPasswordEditor,
      role: UserRole.EDITOR,
    },
  });

  // categories
  const backend = await prisma.category.upsert({
    where: { name: 'Backend' },
    update: {},
    create: { name: 'Backend', description: 'Backend topics' },
  });
  const devops = await prisma.category.upsert({
    where: { name: 'DevOps' },
    update: {},
    create: { name: 'DevOps', description: 'DevOps topics' },
  });
  const database = await prisma.category.upsert({
    where: { name: 'Database' },
    update: {},
    create: { name: 'Database', description: 'Database topics' },
  });

  // tags
  const tagNames = ['nodejs', 'nestjs', 'prisma', 'postgres', 'docker'];
  for (const name of tagNames) {
    await prisma.tag.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // articles
  const a1 = await prisma.article.create({
    data: {
      title: 'Nest basics',
      content: '...',
      status: ArticleStatus.DRAFT,
      authorId: admin.id,
      categoryId: backend.id,
      tags: {
        connect: [{ name: 'nodejs' }, { name: 'nestjs' }],
      },
    },
  });

  const a2 = await prisma.article.create({
    data: {
      title: 'Prisma guide',
      content: '...',
      status: ArticleStatus.PUBLISHED,
      authorId: editor.id,
      categoryId: database.id,
      tags: { connect: [{ name: 'prisma' }, { name: 'postgres' }] },
    },
  });

  await prisma.article.create({
    data: {
      title: 'Docker setup',
      content: '...',
      status: ArticleStatus.ARCHIVED,
      authorId: admin.id,
      categoryId: devops.id,
      tags: { connect: [{ name: 'docker' }] },
    },
  });

  await prisma.article.create({
    data: {
      title: 'Postgres tips',
      content: '...',
      status: ArticleStatus.PUBLISHED,
      authorId: editor.id,
      categoryId: database.id,
      tags: { connect: [{ name: 'postgres' }] },
    },
  });

  await prisma.article.create({
    data: {
      title: 'Node performance',
      content: '...',
      status: ArticleStatus.DRAFT,
      authorId: admin.id,
      categoryId: backend.id,
      tags: { connect: [{ name: 'nodejs' }] },
    },
  });

  // comments
  await prisma.comment.createMany({
    data: [
      { content: 'Great article', articleId: a1.id, authorId: editor.id },
      { content: 'Very useful', articleId: a2.id, authorId: admin.id },
      { content: 'Thanks!', articleId: a2.id, authorId: null },
    ],
  });
}

main()
  .catch(async (e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });