export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError };

export type ActionError =
  | { code: 'UNAUTHORIZED' }
  | { code: 'FORBIDDEN' }
  | { code: 'VALIDATION'; details: unknown }
  | { code: 'NOT_FOUND' }
  | { code: 'CONFLICT'; message?: string }
  | { code: 'INTERNAL' };
