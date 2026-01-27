import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { GameException, GameErrorCode } from './game.exception';

export interface Room {
  roomId: string;
  roomName?: string;
  hostId: number;
  hostUsername: string;
  guestId?: number;
  guestUsername?: string;
  status: 'waiting' | 'playing' | 'finished';
  createdAt: Date;
  whiteId?: number;
  blackId?: number;
  pgn: string;
  finishedAt?: Date;
  rematchRequestedBy?: number;
  rematchExpiresAt?: Date;
  cleanupTimer?: NodeJS.Timeout;
}

@Injectable()
export class GameService {
  constructor(private prisma: PrismaService) {}

  async createGame(data: Prisma.GameCreateInput) {
    return this.prisma.game.create({
      data,
    });
  }

  // Helper to update User vs AI stats
  private async updateUserAiStats(userId: number, aiModelId: number, result: 'win' | 'loss' | 'draw') {
    const stats = await this.prisma.userAiStats.upsert({
      where: {
        userId_aiModelId: {
          userId,
          aiModelId,
        },
      },
      create: {
        userId,
        aiModelId,
        wins: result === 'win' ? 1 : 0,
        losses: result === 'loss' ? 1 : 0,
        draws: result === 'draw' ? 1 : 0,
      },
      update: {
        wins: result === 'win' ? { increment: 1 } : undefined,
        losses: result === 'loss' ? { increment: 1 } : undefined,
        draws: result === 'draw' ? { increment: 1 } : undefined,
      },
    });
    return stats;
  }

  async saveGameResult(data: {
    whiteId?: number;
    blackId?: number;
    whiteAiId?: number;
    blackAiId?: number;
    pgn: string;
    result: string;
  }) {
    // 1. Save the game record
    const game = await this.prisma.game.create({
      data: {
        white: data.whiteId ? { connect: { id: data.whiteId } } : undefined,
        black: data.blackId ? { connect: { id: data.blackId } } : undefined,
        whiteAi: data.whiteAiId ? { connect: { id: data.whiteAiId } } : undefined,
        blackAi: data.blackAiId ? { connect: { id: data.blackAiId } } : undefined,
        pgn: data.pgn,
        result: data.result,
      },
    });

    // 2. Update Stats if it's a User vs AI game
    // Case A: User is White, AI is Black
    if (data.whiteId && data.blackAiId) {
      // 1-0 = Win, 0-1 = Loss, 1/2-1/2 = Draw
      let outcome: 'win' | 'loss' | 'draw' = 'draw';
      if (data.result === '1-0') outcome = 'win';
      else if (data.result === '0-1') outcome = 'loss';
      
      await this.updateUserAiStats(data.whiteId, data.blackAiId, outcome);
    }
    
    // Case B: User is Black, AI is White
    else if (data.blackId && data.whiteAiId) {
       // 0-1 = Win (for Black), 1-0 = Loss
       let outcome: 'win' | 'loss' | 'draw' = 'draw';
       if (data.result === '0-1') outcome = 'win';
       else if (data.result === '1-0') outcome = 'loss';

       await this.updateUserAiStats(data.blackId, data.whiteAiId, outcome);
    }

    return game;
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
  private rooms = new Map<string, Room>();

  // Helper to clear timeout safely
  private clearCleanupTimer(roomId: string) {
    const room = this.rooms.get(roomId);
    if (room?.cleanupTimer) {
      clearTimeout(room.cleanupTimer);
      room.cleanupTimer = undefined;
    }
  }

  scheduleRoomCleanup(roomId: string, seconds: number = 180) {
    this.clearCleanupTimer(roomId);
    
    const room = this.rooms.get(roomId);
    if (!room) return;

    const timeout = setTimeout(() => {
      console.log(`Auto-deleting room ${roomId} after ${seconds}s`);
      this.deleteRoom(roomId);
    }, seconds * 1000);

    room.cleanupTimer = timeout;
  }

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
      whiteId: hostId, // Assign Host as White immediately
      blackId: undefined
    };
    this.rooms.set(roomId, room);
    return room;
  }

  joinRoom(roomId: string, guestId: number, guestUsername: string) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new GameException(GameErrorCode.ROOM_NOT_FOUND, 'Room not found');
    }
    if (room.status !== 'waiting') {
      throw new GameException(GameErrorCode.ROOM_NOT_AVAILABLE, 'Room is not available');
    }
    if (room.hostId === guestId) {
      throw new GameException(GameErrorCode.INVALID_ACTION, 'Cannot join your own room');
    }
    if (room.guestId) {
      throw new GameException(GameErrorCode.ROOM_FULL, 'Room is full');
    }

    room.guestId = guestId;
    room.guestUsername = guestUsername;
    room.status = 'playing';
    
    // Assign colors (Host is already White)
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

  getUserActiveRooms(userId: number) {
    return Array.from(this.rooms.values())
      .filter(room => 
        (room.status === 'playing' || room.status === 'waiting') && 
        (room.whiteId === userId || room.blackId === userId)
      )
      .map(({ roomId, roomName, hostUsername, status, createdAt }) => ({
        roomId,
        roomName,
        hostUsername,
        status,
        createdAt,
      }));
  }

  findRoomByUserId(userId: number) {
    for (const room of this.rooms.values()) {
      if (room.whiteId === userId || room.blackId === userId) {
        return room;
      }
    }
    return undefined;
  }

  getRoom(roomId: string) {
    return this.rooms.get(roomId);
  }

  deleteRoom(roomId: string) {
    this.clearCleanupTimer(roomId);
    this.rooms.delete(roomId);
  }

  requestRematch(roomId: string, userId: number) {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'finished') {
      throw new GameException(GameErrorCode.ROOM_EXPIRED, 'Room not valid for rematch');
    }

    // Check if room is within 3-minute hard TTL
    const now = new Date();
    if (room.finishedAt && (now.getTime() - room.finishedAt.getTime() > 180000)) {
       throw new GameException(GameErrorCode.ROOM_EXPIRED, 'Room expired');
    }

    room.rematchRequestedBy = userId;
    // Set 60-second acceptance window
    room.rematchExpiresAt = new Date(Date.now() + 60000); 
    
    return {
      rematchExpiresAt: room.rematchExpiresAt
    };
  }

  acceptRematch(roomId: string, userId: number) {
    const room = this.rooms.get(roomId);
    if (!room) throw new GameException(GameErrorCode.ROOM_NOT_FOUND, 'Room not found');
    
    // Check if a rematch was requested
    if (!room.rematchRequestedBy || !room.rematchExpiresAt) {
      throw new GameException(GameErrorCode.NO_REMATCH_REQUEST, 'No rematch requested');
    }

    // Prevent accepting one's own request
    if (room.rematchRequestedBy === userId) {
      throw new GameException(GameErrorCode.INVALID_ACTION, 'Cannot accept your own request');
    }

    // Check 60-second window
    if (new Date() > room.rematchExpiresAt) {
      // Clear request if expired
      room.rematchRequestedBy = undefined;
      room.rematchExpiresAt = undefined;
      throw new GameException(GameErrorCode.REMATCH_EXPIRED, 'Rematch request expired');
    }

    // Valid rematch: Reset game state
    room.status = 'playing';
    room.pgn = '';
    room.finishedAt = undefined;
    room.rematchRequestedBy = undefined;
    room.rematchExpiresAt = undefined;
    
    // Swap colors for rematch (optional standard practice)
    const oldWhite = room.whiteId;
    room.whiteId = room.blackId;
    room.blackId = oldWhite;

    return room;
  }

  declineRematch(roomId: string, userId: number) {
    const room = this.rooms.get(roomId);
    if (!room) throw new GameException(GameErrorCode.ROOM_NOT_FOUND, 'Room not found');

    if (!room.rematchRequestedBy) {
      throw new GameException(GameErrorCode.NO_REMATCH_REQUEST, 'No active rematch request');
    }

    // Clear request
    room.rematchRequestedBy = undefined;
    room.rematchExpiresAt = undefined;

    return room;
  }
}
