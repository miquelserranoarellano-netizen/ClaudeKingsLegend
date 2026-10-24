/** Resultado de una acción de servidor, tal como lo recibe el formulario. */
export type ActionState<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> }
  | null;
