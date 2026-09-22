import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const username = 'admin';
  const password = 'admin123';
  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.v2_User.upsert({
    where: { username },
    update: {},
    create: {
      username,
      passwordHash,
      fullName: 'مدیر سیستم',
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log(`Admin user ready: ${admin.username} (${admin.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
