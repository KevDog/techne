/**
 * Typed errors for the data layer. Use these to distinguish
 * "no result" (empty array) from "query failed" or "forbidden".
 *
 * Existing data fns still return [] on error to preserve backward
 * compatibility. New fns or refactors can throw DataError to push
 * meaningful failures up to the caller.
 */
export type DataErrorCode = 'NOT_FOUND' | 'FORBIDDEN' | 'QUERY_FAILED' | 'INVALID_SHAPE'

export class DataError extends Error {
  readonly code: DataErrorCode

  constructor(code: DataErrorCode, message: string) {
    super(message)
    this.name = 'DataError'
    this.code = code
  }
}

export function isDataError(e: unknown): e is DataError {
  return e instanceof DataError
}
