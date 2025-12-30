import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class GameService {
  constructor(private prisma: PrismaService) {}

  async createGame(data: Prisma.GameCreateInput) {
    return this.prisma.game.create({
      data,
    });
  }

  async saveGameResult(data: {
    whiteId?: number;
    blackId?: number;
    whiteAiId?: number;
    blackAiId?: number;
    pgn: string;
    result: string;
  }) {
    return this.prisma.game.create({
      data: {
        white: data.whiteId ? { connect: { id: data.whiteId } } : undefined,
        black: data.blackId ? { connect: { id: data.blackId } } : undefined,
        whiteAi: data.whiteAiId ? { connect: { id: data.whiteAiId } } : undefined,
        blackAi: data.blackAiId ? { connect: { id: data.blackAiId } } : undefined,
        pgn: data.pgn,
        result: data.result,
      },
    });
  }

  async getGamesByUserId(userId: number) {
    return this.prisma.game.findMany({
      where: {
        OR: [
          { whiteId: userId },
          { blackId: userId },
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        white: { select: { username: true } },
        black: { select: { username: true } },
        whiteAi: { select: { name: true } },
        blackAi: { select: { name: true } },
      },
    });
  }

  // In-memory room management (for MVP, can be moved to Redis later)
  // Extended to hold active game state
  private rooms = new Map<string, {
    roomId: string;
    roomName?: string;
    hostId: number;
    hostUsername: string;
    guestId?: number;
    guestUsername?: string;
    status: 'waiting' | 'playing' | 'finished';
    createdAt: Date;
    // Game State
    whiteId?: number;
    blackId?: number;
    pgn: string;
  }>();

  createRoom(hostId: number, hostUsername: string, roomName?: string) {
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const room = {
      roomId,
      roomName: roomName || `${hostUsername}'s room`,
      hostId,
      hostUsername,
      status: 'waiting' as const,
      createdAt: new Date(),
      pgn: '',
    };
    this.rooms.set(roomId, room);
    return room;
  }

  joinRoom(roomId: string, guestId: number, guestUsername: string) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('Room not found');
    }
    if (room.status !== 'waiting') {
      throw new Error('Room is not available');
    }
    if (room.hostId === guestId) {
      throw new Error('Cannot join your own room');
    }
    if (room.guestId) {
      throw new Error('Room is full');
    }

    room.guestId = guestId;
    room.guestUsername = guestUsername;
    room.status = 'playing';
    
    // Assign colors (Host = White by default for now)
    room.whiteId = room.hostId;
    room.blackId = guestId;
    
    this.rooms.set(roomId, room);
    return room;
  }

  getAvailableRooms() {
    return Array.from(this.rooms.values())
      .filter(room => room.status === 'waiting')
      .map(({ roomId, roomName, hostUsername, createdAt }) => ({
        roomId,
        roomName,
        hostUsername,
        createdAt,
      }));
  }

  getRoom(roomId: string) {
    return this.rooms.get(roomId);
  }

  deleteRoom(roomId: string) {
    this.rooms.delete(roomId);
  }
}
