import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const aiModels = [
    {
      name: 'Stockfish Level 1 (Beginner)',
      rating: 400,
      type: 'stockfish',
      config: { depth: 1, skillLevel: 0, moveOverhead: 1000 },
    },
    {
      name: 'Stockfish Level 3 (Novice)',
      rating: 800,
      type: 'stockfish',
      config: { depth: 3, skillLevel: 5, moveOverhead: 1000 },
    },
    {
      name: 'Stockfish Level 5 (Intermediate)',
      rating: 1200,
      type: 'stockfish',
      config: { depth: 5, skillLevel: 10, moveOverhead: 1000 },
    },
    {
      name: 'Stockfish Level 10 (Advanced)',
      rating: 1600,
      type: 'stockfish',
      config: { depth: 10, skillLevel: 15, moveOverhead: 1000 },
    },
    {
      name: 'Stockfish Level 15 (Master)',
      rating: 2000,
      type: 'stockfish',
      config: { depth: 15, skillLevel: 20, moveOverhead: 1000 },
    },
    {
      name: 'Stockfish Max (Grandmaster)',
      rating: 2800,
      type: 'stockfish',
      config: { depth: 20, skillLevel: 20, moveOverhead: 1000 },
    },
  ];

  console.log('Seeding AI Models...');

  for (const model of aiModels) {
    const ai = await prisma.aiModel.upsert({
      where: { name: model.name },
      update: {
        rating: model.rating,
        type: model.type,
        config: model.config,
      },
      create: {
        name: model.name,
        rating: model.rating,
        type: model.type,
        config: model.config,
      },
    });
    console.log(`Upserted AI: ${ai.name} (Rating: ${ai.rating})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
