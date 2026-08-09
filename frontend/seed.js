const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminPassword = await bcrypt.hash('admin123', 10);
  const userPassword = await bcrypt.hash('user123', 10);

  console.log('Seeding Application Users...');

  const admin = await prisma.app_user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password_hash: adminPassword,
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin',
      designation: 'System Administrator',
      is_active: true
    }
  });

  const user = await prisma.app_user.upsert({
    where: { username: 'lucas' },
    update: {},
    create: {
      username: 'lucas',
      password_hash: userPassword,
      first_name: 'Lucas',
      last_name: 'Martinez',
      role: 'user'
    }
  });

  console.log('Created Admin:', admin.username);
  console.log('Created User:', user.username);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
