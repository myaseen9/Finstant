const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    const summary = await prisma.dashboard_summary.findFirst({
      orderBy: { row_number: 'desc' }
    });
    console.log("Summary:", summary);

    const inflows = await prisma.cash_inflows.findMany({
      take: 5,
      orderBy: { row_number: 'desc' }
    });
    console.log("Inflows:", inflows);
  } catch (e) {
    console.error("Prisma Error:", e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
