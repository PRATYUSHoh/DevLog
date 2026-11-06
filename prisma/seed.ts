import bcrypt from 'bcryptjs';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.warn('[DevLog Seed] DATABASE_URL not set; skipping database seed.');
    return;
  }

  // Use the PrismaPg adapter if in Prisma 7 environment
  const { PrismaClient } = require('@prisma/client');
  const { PrismaPg } = require('@prisma/adapter-pg');
  const adapter = new PrismaPg({ connectionString: dbUrl });
  const prisma = new PrismaClient({ adapter });

  console.log('[DevLog Seed] Starting database seed for integration test suite...');

  const adminHash = await bcrypt.hash('admin1234', 10);
  const demoHash = await bcrypt.hash('demo1234', 10);
  const pratHash = await bcrypt.hash('12345678', 10);

  // 1. Seed Core Engineering Team (id: 1)
  await prisma.team.upsert({
    where: { id: 1 },
    update: {
      name: 'Core Engineering',
      description: 'Primary engineering team maintaining backend infrastructure and APIs.',
      password: 'devteam123',
      ownerId: 1
    },
    create: {
      id: 1,
      name: 'Core Engineering',
      description: 'Primary engineering team maintaining backend infrastructure and APIs.',
      password: 'devteam123',
      ownerId: 1
    }
  });

  // 2. Seed Admin User (id: 1)
  await prisma.user.upsert({
    where: { id: 1 },
    update: {
      username: 'admin',
      email: 'admin@devlog.com',
      hash: adminHash,
      isMember: true,
      isAdmin: true,
      teamId: 1
    },
    create: {
      id: 1,
      username: 'admin',
      email: 'admin@devlog.com',
      hash: adminHash,
      isMember: true,
      isAdmin: true,
      teamId: 1
    }
  });

  // 3. Seed Demo Member User (id: 2)
  await prisma.user.upsert({
    where: { id: 2 },
    update: {
      username: 'demo_member',
      email: 'demo@devlog.com',
      hash: demoHash,
      isMember: true,
      isAdmin: false,
      teamId: 1
    },
    create: {
      id: 2,
      username: 'demo_member',
      email: 'demo@devlog.com',
      hash: demoHash,
      isMember: true,
      isAdmin: false,
      teamId: 1
    }
  });

  // 4. Seed User 3 (id: 3)
  await prisma.user.upsert({
    where: { id: 3 },
    update: {
      username: 'pratyush',
      email: 'prat@gmail.com',
      hash: pratHash,
      isMember: true,
      isAdmin: true,
      teamId: 1
    },
    create: {
      id: 3,
      username: 'pratyush',
      email: 'prat@gmail.com',
      hash: pratHash,
      isMember: true,
      isAdmin: true,
      teamId: 1
    }
  });

  // 5. Seed Post 1 (id: 1)
  await prisma.post.upsert({
    where: { id: 1 },
    update: {
      title: 'How we handle payment retry logic at Razorpay',
      content: 'At Razorpay we use exponential backoff with jitter for transient gateway errors. This ensures downstream acquirers are not overwhelmed during micro-outages while keeping checkout latency minimal for successful retries. We also monitor p99 response times and dynamically throttle retries if error thresholds exceed 5%.',
      isPublished: true,
      authorId: 1,
      teamId: 1
    },
    create: {
      id: 1,
      title: 'How we handle payment retry logic at Razorpay',
      content: 'At Razorpay we use exponential backoff with jitter for transient gateway errors. This ensures downstream acquirers are not overwhelmed during micro-outages while keeping checkout latency minimal for successful retries. We also monitor p99 response times and dynamically throttle retries if error thresholds exceed 5%.',
      isPublished: true,
      authorId: 1,
      teamId: 1
    }
  });

  // 6. Seed Folder 1 (id: 1)
  await prisma.folder.upsert({
    where: { id: 1 },
    update: {
      name: 'Architecture Diagrams',
      userId: 1,
      teamId: 1
    },
    create: {
      id: 1,
      name: 'Architecture Diagrams',
      userId: 1,
      teamId: 1
    }
  });

  // 7. Align PostgreSQL autoincrement sequences so subsequent creates don't collide with seeded IDs
  try {
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"User"', 'id'), coalesce(max(id),0) + 1, false) FROM "User";`);
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Team"', 'id'), coalesce(max(id),0) + 1, false) FROM "Team";`);
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Post"', 'id'), coalesce(max(id),0) + 1, false) FROM "Post";`);
    await prisma.$executeRawUnsafe(`SELECT setval(pg_get_serial_sequence('"Folder"', 'id'), coalesce(max(id),0) + 1, false) FROM "Folder";`);
  } catch (err: any) {
    // Non-fatal if sequences aren't standard or table is empty
  }

  console.log('[DevLog Seed] Database seeded successfully.');
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[DevLog Seed] Error during seed:', err);
  process.exit(1);
});
