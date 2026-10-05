import "server-only";

export class AppError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message);
  }
}

export function storageError(): AppError {
  return new AppError("STORAGE_UNAVAILABLE", "Model storage is unavailable. Check the database setup and permissions.", 503);
}
