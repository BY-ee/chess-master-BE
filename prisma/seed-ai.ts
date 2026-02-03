import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const aiModels = [
    {
      name: 'Rookie Ralph',
      rating: 400,
      type: 'defensive',
      description: 'A cautious beginner who avoids risks but misses opportunities.',
      config: { depth: 1, skillLevel: 0, moveOverhead: 1000 },
      imageUrl: '/images/bots/rookie-ralph.png',
    },
    {
      name: 'Careful Carla',
      rating: 800,
      type: 'defensive',
      description: 'Plays solidly and waits for you to make a mistake.',
      config: { depth: 3, skillLevel: 5, moveOverhead: 1000 },
      imageUrl: '/images/bots/careful-carla.png',
    },
    {
      name: 'Balanced Ben',
      rating: 1200,
      type: 'balanced',
      description: 'An intermediate player with a well-rounded style.',
      config: { depth: 5, skillLevel: 10, moveOverhead: 1000 },
      imageUrl: '/images/bots/balanced-ben.png',
    },
    {
      name: 'Aggressive Alex',
      rating: 1200,
      type: 'aggressive',
      description: 'Attacks relentlessly, often sacrificing material for initiative.',
      config: { depth: 5, skillLevel: 10, moveOverhead: 1000 },
      imageUrl: '/images/bots/aggressive-alex.png',
    },
    {
      name: 'Strategic Sarah',
      rating: 1600,
      type: 'balanced',
      description: 'Prefers long-term planning and positional play.',
      config: { depth: 10, skillLevel: 15, moveOverhead: 1000 },
      imageUrl: '/images/bots/strategic-sarah.png',
    },
    {
      name: 'Tactical Tom',
      rating: 1600,
      type: 'aggressive',
      description: 'Excels in complications and tactical skirmishes.',
      config: { depth: 10, skillLevel: 15, moveOverhead: 1000 },
      imageUrl: '/images/bots/tactical-tom.png',
    },
    {
      name: 'Master Mike',
      rating: 2000,
      type: 'aggressive',
      description: 'A master tactician who punishes every inaccurate move.',
      config: { depth: 15, skillLevel: 20, moveOverhead: 1000 },
      imageUrl: '/images/bots/master-mike.png',
    },
    {
      name: 'Grandmaster',
      rating: 2800,
      type: 'balanced',
      description: 'Near-perfect play. Good luck!',
      config: { depth: 20, skillLevel: 20, moveOverhead: 1000 },
      imageUrl: '/images/bots/grandmaster.png',
    },
  ];

  console.log('Seeding AI Models...');

  for (const model of aiModels) {
    const ai = await prisma.aiModel.upsert({
      where: { name: model.name },
      update: {
        rating: model.rating,
        type: model.type,
        description: model.description,
        config: model.config,
        imageUrl: model.imageUrl,
      },
      create: {
        name: model.name,
        rating: model.rating,
        type: model.type,
        description: model.description,
        config: model.config,
        imageUrl: model.imageUrl,
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
