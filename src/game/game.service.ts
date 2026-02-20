import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { GameException, GameErrorCode } from './game.exception';
import { GameGateway } from './game.gateway';

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
  hostRating: number;
  hostCountry: string;
  guestRating?: number;
  isEnding?: boolean; // Lock for game over processing
}

interface MatchmakingPlayer {
  userId: number;
  username: string;
  rating?: number;
  joinedAt: Date;
}

@Injectable()
export class GameService {
  // Constants
  private readonly DEFAULT_RATING = 1200;
  private readonly ROOM_CLEANUP_TIMEOUT = 180; // 3 minutes
  private readonly WAITING_ROOM_CLEANUP_TIMEOUT = 600; // 10 minutes
  private readonly REMATCH_EXPIRATION_MS = 60000; // 1 minute
  private readonly MATCHMAKING_TIMEOUT_MS = 60000; // 1 minute
  private readonly MATCHMAKING_INITIAL_RANGE = 100;
  private readonly MATCHMAKING_RANGE_EXPANSION_RATE = 10;
  private readonly MATCHMAKING_ESTIMATED_WAIT_FACTOR = 5;

  // Matchmaking queue (in-memory for MVP, can be moved to Redis later)
  private matchmakingQueue: MatchmakingPlayer[] = [];
  private matchmakingTimeouts = new Map<number, NodeJS.Timeout>();

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => GameGateway)) private gameGateway: GameGateway,
  ) {}

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

  /**
   * Calculate new rating using ELO system
   */
  private calculateNewRating(currentRating: number, opponentRating: number, actualScore: number, kFactor: number = 32): number {
    const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - currentRating) / 400));
    return Math.round(currentRating + kFactor * (actualScore - expectedScore));
  }

  async saveGameResult(data: {
    whiteId?: number;
    blackId?: number;
    whiteAiId?: number;
    blackAiId?: number;
    pgn: string;
    result: string;
  }) {
    // Wrap everything in a transaction to ensure data integrity
    return this.prisma.$transaction(async (tx) => {
      // 1. Save the game record
      const game = await tx.game.create({
        data: {
          white: data.whiteId ? { connect: { id: data.whiteId } } : undefined,
          black: data.blackId ? { connect: { id: data.blackId } } : undefined,
          whiteAi: data.whiteAiId ? { connect: { id: data.whiteAiId } } : undefined,
          blackAi: data.blackAiId ? { connect: { id: data.blackAiId } } : undefined,
          pgn: data.pgn,
          result: data.result,
        },
      });

      let ratingChanges: { white?: { old: number, new: number }, black?: { old: number, new: number } } | undefined;

      // 2. Update Stats
      
      // Case A: User vs User (PvP) - Update ELO Ratings
      if (data.whiteId && data.blackId) {
        // Fetch users inside transaction to get latest ratings
        const whiteUser = await tx.user.findUnique({ where: { id: data.whiteId } });
        const blackUser = await tx.user.findUnique({ where: { id: data.blackId } });

        if (whiteUser && blackUser) {
          let whiteScore = 0.5;
          let blackScore = 0.5;

          if (data.result === '1-0') {
            whiteScore = 1;
            blackScore = 0;
          } else if (data.result === '0-1') {
            whiteScore = 0;
            blackScore = 1;
          }

          const newWhiteRating = this.calculateNewRating(whiteUser.rating, blackUser.rating, whiteScore);
          const newBlackRating = this.calculateNewRating(blackUser.rating, whiteUser.rating, blackScore);

          // Update Users
          await tx.user.update({
            where: { id: data.whiteId },
            data: { rating: newWhiteRating },
          });

          await tx.user.update({
            where: { id: data.blackId },
            data: { rating: newBlackRating },
          });

          ratingChanges = {
            white: { old: whiteUser.rating, new: newWhiteRating },
            black: { old: blackUser.rating, new: newBlackRating },
          };
        }
      }
      
      // Case B: User vs AI
      else if (data.whiteId && data.blackAiId) {
        // User is White
        let outcome: 'win' | 'loss' | 'draw' = 'draw';
        if (data.result === '1-0') outcome = 'win';
        else if (data.result === '0-1') outcome = 'loss';
        
        // Use local helper but adapted for transaction?
        // The helper `updateUserAiStats` uses `this.prisma` directly which is outside transaction.
        // We should inline the logic or pass `tx` to helper. 
        // For simplicity contributing to file size, I'll inline the simple upsert here using `tx`.
        await tx.userAiStats.upsert({
            where: { userId_aiModelId: { userId: data.whiteId, aiModelId: data.blackAiId } },
            create: { userId: data.whiteId, aiModelId: data.blackAiId, wins: outcome === 'win' ? 1 : 0, losses: outcome === 'loss' ? 1 : 0, draws: outcome === 'draw' ? 1 : 0 },
            update: { wins: outcome === 'win' ? { increment: 1 } : undefined, losses: outcome === 'loss' ? { increment: 1 } : undefined, draws: outcome === 'draw' ? { increment: 1 } : undefined },
        });
      }
      else if (data.blackId && data.whiteAiId) {
         // User is Black
         let outcome: 'win' | 'loss' | 'draw' = 'draw';
         if (data.result === '0-1') outcome = 'win';
         else if (data.result === '1-0') outcome = 'loss';

         await tx.userAiStats.upsert({
            where: { userId_aiModelId: { userId: data.blackId, aiModelId: data.whiteAiId } },
            create: { userId: data.blackId, aiModelId: data.whiteAiId, wins: outcome === 'win' ? 1 : 0, losses: outcome === 'loss' ? 1 : 0, draws: outcome === 'draw' ? 1 : 0 },
            update: { wins: outcome === 'win' ? { increment: 1 } : undefined, losses: outcome === 'loss' ? { increment: 1 } : undefined, draws: outcome === 'draw' ? { increment: 1 } : undefined },
        });
      }

      return { game, ratingChanges };
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
  private rooms = new Map<string, Room>();
  private activeRoomNames = new Set<string>(); // Optimized O(1) name lookup

  // Helper to clear timeout safely
  private clearCleanupTimer(roomId: string) {
    const room = this.rooms.get(roomId);
    if (room?.cleanupTimer) {
      clearTimeout(room.cleanupTimer);
      room.cleanupTimer = undefined;
    }
  }

  scheduleRoomCleanup(roomId: string, seconds: number = this.ROOM_CLEANUP_TIMEOUT) {
    this.clearCleanupTimer(roomId);
    
    const room = this.rooms.get(roomId);
    if (!room) return;

    const timeout = setTimeout(() => {
      console.log(`Auto-deleting room ${roomId} after ${seconds}s`);
      // Notify connected clients that room is expiring
      this.gameGateway.notifyRoomExpired(roomId);
      this.deleteRoom(roomId);
    }, seconds * 1000);

    room.cleanupTimer = timeout;
  }

  async createRoom(hostId: number, hostUsername: string, roomName?: string) {
    const finalRoomName = roomName?.trim() || `${hostUsername}'s room`;

    // Check for duplicate room name (Case-insensitive) O(1)
    if (this.activeRoomNames.has(finalRoomName.toLowerCase())) {
      throw new GameException(GameErrorCode.ROOM_NAME_CONFLICT, 'Room name already exists');
    }

    const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Fetch user details for richer room metadata
    const user = await this.prisma.user.findUnique({
      where: { id: hostId },
      select: { rating: true, country: true },
    });

    const room: Room = {
      roomId,
      roomName: finalRoomName,
      hostId,
      hostUsername,
      hostRating: user?.rating ?? this.DEFAULT_RATING,
      hostCountry: user?.country ?? 'KR',
      guestId: undefined,
      guestUsername: undefined,
      status: 'waiting',
      createdAt: new Date(),
      pgn: '',
      whiteId: hostId, // Assign Host as White immediately
      blackId: undefined,
    };
    this.rooms.set(roomId, room);
    this.activeRoomNames.add(finalRoomName.toLowerCase());
    
    // Auto-cleanup waiting room after 10 minutes (600 seconds) if no one joins
    this.scheduleRoomCleanup(roomId, this.WAITING_ROOM_CLEANUP_TIMEOUT);
    
    // Return room data without the timeout object to avoid circular reference in JSON
    const { cleanupTimer, ...roomData } = room;
    
    // Broadcast room creation to lobby
    this.gameGateway.notifyRoomCreated(roomData);
    
    return roomData;
  }

  async joinRoom(roomId: string, guestId: number, guestUsername: string) {
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

    // Optimistic locking: Reserve the spot synchronously
    room.guestId = guestId;

    try {
      // Fetch guest rating from database
      const guestUser = await this.prisma.user.findUnique({
        where: { id: guestId },
        select: { rating: true },
      });

      room.guestUsername = guestUsername;
      room.guestRating = guestUser?.rating ?? this.DEFAULT_RATING;
      room.status = 'playing';
      
      // Clear the waiting cleanup timer as the game is starting
      this.clearCleanupTimer(roomId);
      
      // Assign colors (Host is already White)
      room.blackId = guestId;
      
      this.rooms.set(roomId, room);
      return room;
    } catch (error) {
      // Revert reservation on error
      room.guestId = undefined;
      throw error;
    }
  }

  getAvailableRooms(query?: { 
    search?: string; 
    ratingMin?: number; 
    ratingMax?: number; 
    country?: string; 
    limit?: number; 
    cursor?: string 
  }) {
    let rooms = Array.from(this.rooms.values())
      .filter(room => room.status === 'waiting');

    // 1. Filtering
    if (query?.search) {
      const lowerSearch = query.search.toLowerCase();
      rooms = rooms.filter(room => 
        (room.roomName?.toLowerCase().includes(lowerSearch) || 
         room.hostUsername.toLowerCase().includes(lowerSearch))
      );
    }

    if (query?.country) {
      rooms = rooms.filter(room => room.hostCountry === query.country);
    }

    if (query?.ratingMin !== undefined) {
      rooms = rooms.filter(room => room.hostRating >= query.ratingMin!);
    }

    if (query?.ratingMax !== undefined) {
      rooms = rooms.filter(room => room.hostRating <= query.ratingMax!);
    }

    // 2. Sorting (Newest first)
    rooms.sort((a, b) => {
      const timeDiff = b.createdAt.getTime() - a.createdAt.getTime();
      if (timeDiff !== 0) return timeDiff;
      // Secondary sort by roomId for stability
      return a.roomId.localeCompare(b.roomId);
    });

    // 3. Pagination (Cursor-based)
    const limit = query?.limit ?? 10;
    let paginatedRooms = rooms;
    let nextCursor: string | null = null;

    if (query?.cursor) {
      const cursorIndex = rooms.findIndex(r => r.roomId === query.cursor);
      if (cursorIndex !== -1) {
        // Start AFTER the cursor
        paginatedRooms = rooms.slice(cursorIndex + 1);
      }
    }

    // Slice to limit
    if (paginatedRooms.length > limit) {
      // Fix: Cursor should point to the LAST item of the CURRENT page (index limit-1)
      // So that the next request starts AFTER it (index limit).
      nextCursor = paginatedRooms[limit - 1].roomId;
      paginatedRooms = paginatedRooms.slice(0, limit);
    } else {
      nextCursor = null;
    }

    // 4. Map to DTO
    const data = paginatedRooms.map(({ roomId, roomName, hostUsername, hostRating, hostCountry, createdAt }) => ({
      roomId,
      roomName,
      hostUsername,
      hostRating,
      hostCountry,
      createdAt,
    }));

    return {
      data,
      nextCursor,
      total: rooms.length // Optional: Total matching count
    };
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
    let latestActiveRoom: Room | undefined;
    let latestFinishedRoom: Room | undefined;
    
    for (const room of this.rooms.values()) {
      if (room.whiteId === userId || room.blackId === userId) {
        if (room.status === 'playing' || room.status === 'waiting') {
          latestActiveRoom = room; // Update to the most recent active room
        } else if (room.status === 'finished') {
          latestFinishedRoom = room; // Update to the most recent finished room
        }
      }
    }
    
    return latestActiveRoom || latestFinishedRoom;
  }

  /**
   * Build players info object from a Room for event payloads
   */
  getPlayersInfo(room: Room) {
    const resolvePlayer = (playerId?: number) => {
      if (!playerId) return undefined;
      if (playerId === room.hostId) {
        return { username: room.hostUsername, rating: room.hostRating };
      }
      return { username: room.guestUsername || 'Unknown', rating: room.guestRating };
    };

    return {
      white: resolvePlayer(room.whiteId),
      black: resolvePlayer(room.blackId),
    };
  }

  getRoom(roomId: string) {
    return this.rooms.get(roomId);
  }

  deleteRoom(roomId: string) {
    this.clearCleanupTimer(roomId);
    
    const room = this.rooms.get(roomId);
    if (room && room.roomName) {
      this.activeRoomNames.delete(room.roomName.toLowerCase());
    }

    this.rooms.delete(roomId);
    this.gameGateway.notifyRoomDeleted(roomId);
  }

  requestRematch(roomId: string, userId: number) {
    const room = this.rooms.get(roomId);
    if (!room || room.status !== 'finished') {
      throw new GameException(GameErrorCode.ROOM_EXPIRED, 'Room not valid for rematch');
    }

    // Check if room is within 3-minute hard TTL
    const now = new Date();
    if (room.finishedAt && (now.getTime() - room.finishedAt.getTime() > (this.ROOM_CLEANUP_TIMEOUT * 1000))) {
       throw new GameException(GameErrorCode.ROOM_EXPIRED, 'Room expired');
    }

    room.rematchRequestedBy = userId;
    // Set 60-second acceptance window
    room.rematchExpiresAt = new Date(Date.now() + this.REMATCH_EXPIRATION_MS); 
    
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

  // ==================== Matchmaking System ====================

  /**
   * Join matchmaking queue
   * @param userId User ID
   * @param username Username
   * @returns Queue position and estimated wait time
   */
  async joinMatchmaking(userId: number, username: string) {
    // Check if user is already in queue
    const existingIndex = this.matchmakingQueue.findIndex(p => p.userId === userId);
    if (existingIndex !== -1) {
      return {
        queuePosition: existingIndex + 1,
        estimatedWait: this.matchmakingQueue.length * this.MATCHMAKING_ESTIMATED_WAIT_FACTOR,
      };
    }

    // Fetch user rating from database
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { rating: true },
    });

    // Add to queue
    const player: MatchmakingPlayer = {
      userId,
      username,
      rating: user?.rating || this.DEFAULT_RATING,
      joinedAt: new Date(),
    };

    this.matchmakingQueue.push(player);

    console.log(`User ${username} (ID: ${userId}) joined matchmaking queue. Queue size: ${this.matchmakingQueue.length}`);

    // Set timeout (60 seconds default, can be configured)
    const timeout = setTimeout(() => {
      this.handleMatchmakingTimeout(userId);
    }, this.MATCHMAKING_TIMEOUT_MS);

    this.matchmakingTimeouts.set(userId, timeout);

    // Try to find a match immediately
    const match = await this.tryToMatch(userId);

    return {
      queuePosition: this.matchmakingQueue.findIndex(p => p.userId === userId) + 1,
      estimatedWait: this.matchmakingQueue.length * this.MATCHMAKING_ESTIMATED_WAIT_FACTOR,
      matched: match !== null,
      matchData: match,
    };
  }

  /**
   * Leave matchmaking queue
   * @param userId User ID
   */
  leaveMatchmaking(userId: number) {
    const index = this.matchmakingQueue.findIndex(p => p.userId === userId);
    
    if (index === -1) {
      return { success: false, message: 'Not in queue' };
    }

    // Remove from queue
    this.matchmakingQueue.splice(index, 1);

    // Clear timeout
    const timeout = this.matchmakingTimeouts.get(userId);
    if (timeout) {
      clearTimeout(timeout);
      this.matchmakingTimeouts.delete(userId);
    }

    console.log(`User ${userId} left matchmaking queue. Queue size: ${this.matchmakingQueue.length}`);

    return { success: true, message: 'Left queue' };
  }

  /**
   * Try to find a match for a user
   * Uses simple ELO-based matchmaking with expanding search range
   * @param userId User ID
   * @returns Match data if found, null otherwise
   */
  private async tryToMatch(userId: number): Promise<{ roomId: string; opponentId: number } | null> {
    const playerIndex = this.matchmakingQueue.findIndex(p => p.userId === userId);
    if (playerIndex === -1) return null;

    const player = this.matchmakingQueue[playerIndex];
    
    // Search for opponent with similar rating
    // Start with ±100 rating difference, expand over time
    const waitTime = (Date.now() - player.joinedAt.getTime()) / 1000; // seconds
    const ratingRange = this.MATCHMAKING_INITIAL_RANGE + (waitTime * this.MATCHMAKING_RANGE_EXPANSION_RATE);

    for (let i = 0; i < this.matchmakingQueue.length; i++) {
      if (i === playerIndex) continue; // Skip self

      const opponent = this.matchmakingQueue[i];
      const ratingDiff = Math.abs((player.rating || this.DEFAULT_RATING) - (opponent.rating || this.DEFAULT_RATING));

      if (ratingDiff <= ratingRange) {
        // Match found! Create room
        console.log(`Match found: ${player.username} (${player.rating}) vs ${opponent.username} (${opponent.rating})`);

        // Remove both players from queue
        this.matchmakingQueue.splice(Math.max(playerIndex, i), 1);
        this.matchmakingQueue.splice(Math.min(playerIndex, i), 1);

        // Clear timeouts
        this.clearMatchmakingTimeout(player.userId);
        this.clearMatchmakingTimeout(opponent.userId);

        // Randomly assign colors
        const [whitePlayer, blackPlayer] = Math.random() < 0.5 
          ? [player, opponent] 
          : [opponent, player];

        // Create room automatically
        // Append timestamp to ensure uniqueness if players match again quickly (before old room cleanup)
        const roomName = `Match: ${whitePlayer.username} vs ${blackPlayer.username} (${Date.now()})`;
        const room = await this.createRoom(whitePlayer.userId, whitePlayer.username, roomName);
        
        // Immediately assign both players
        room.guestId = blackPlayer.userId;
        room.guestUsername = blackPlayer.username;
        room.guestRating = blackPlayer.rating ?? this.DEFAULT_RATING;
        room.blackId = blackPlayer.userId;
        room.status = 'playing';
        this.rooms.set(room.roomId, room);

        return {
          roomId: room.roomId,
          opponentId: opponent.userId,
        };
      }
    }

    return null; // No match found
  }

  /**
   * Handle matchmaking timeout
   * @param userId User ID
   */
  private handleMatchmakingTimeout(userId: number) {
    const index = this.matchmakingQueue.findIndex(p => p.userId === userId);
    
    if (index !== -1) {
      const player = this.matchmakingQueue[index];
      console.log(`Matchmaking timeout for user ${player.username} (ID: ${userId})`);
      
      // Remove from queue
      this.matchmakingQueue.splice(index, 1);
      this.matchmakingTimeouts.delete(userId);

      // Gateway will emit timeout event
    }
  }

  /**
   * Clear matchmaking timeout
   * @param userId User ID
   */
  private clearMatchmakingTimeout(userId: number) {
    const timeout = this.matchmakingTimeouts.get(userId);
    if (timeout) {
      clearTimeout(timeout);
      this.matchmakingTimeouts.delete(userId);
    }
  }

  /**
   * Get matchmaking queue info (for debugging/monitoring)
   */
  getMatchmakingQueueInfo() {
    return {
      queueSize: this.matchmakingQueue.length,
      players: this.matchmakingQueue.map(p => ({
        userId: p.userId,
        username: p.username,
        rating: p.rating,
        waitTime: Math.floor((Date.now() - p.joinedAt.getTime()) / 1000),
      })),
    };
  }

  /**
   * Check if user is in matchmaking queue
   */
  isInMatchmakingQueue(userId: number): boolean {
    return this.matchmakingQueue.some(p => p.userId === userId);
  }
}
