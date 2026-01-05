export enum GameErrorCode {
  ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',
  ROOM_EXPIRED = 'ROOM_EXPIRED',
  ROOM_FULL = 'ROOM_FULL',
  ROOM_NOT_AVAILABLE = 'ROOM_NOT_AVAILABLE',
  REMATCH_EXPIRED = 'REMATCH_EXPIRED',
  NO_REMATCH_REQUEST = 'NO_REMATCH_REQUEST',
  INVALID_ACTION = 'INVALID_ACTION', // Joining own room, accepting own request
  GENERIC_ERROR = 'GENERIC_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
}

export class GameException extends Error {
  constructor(public code: GameErrorCode, message: string) {
    super(message);
    this.name = 'GameException';
  }
}
