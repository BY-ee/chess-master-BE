
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const games = await prisma.game.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        whiteId: true,
        blackId: true,
        result: true,
        createdAt: true
      }
    });

    console.log(JSON.stringify(games, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
