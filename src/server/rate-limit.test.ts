import { beforeAll, describe, expect, it } from "vitest";
import { useTestDb } from "@/test/db";
import type { Db } from "./db/client";
import { consumeRateLimit } from "./rate-limit";

describe("límite de peticiones", () => {
  let db: Db;
  beforeAll(async () => {
    db = await useTestDb();
  });

  it("permite hasta el máximo dentro de la ventana y después bloquea con tiempo de espera", async () => {
    const rule = { window: 60, max: 3 };
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await consumeRateLimit(db, "prueba:a", rule));
    expect(results.slice(0, 3).every((r) => r.allowed)).toBe(true);
    expect(results[3]!.allowed).toBe(false);
    expect(results[3]!.retryAfter).toBeGreaterThan(0);
    expect(results[3]!.retryAfter).toBeLessThanOrEqual(60);
  });

  it("cada clave cuenta por separado", async () => {
    const rule = { window: 60, max: 1 };
    expect((await consumeRateLimit(db, "prueba:b", rule)).allowed).toBe(true);
    expect((await consumeRateLimit(db, "prueba:c", rule)).allowed).toBe(true);
    expect((await consumeRateLimit(db, "prueba:b", rule)).allowed).toBe(false);
  });

  it("las peticiones simultáneas no se cuelan por encima del máximo", async () => {
    const rule = { window: 60, max: 5 };
    const results = await Promise.all(Array.from({ length: 12 }, () => consumeRateLimit(db, "prueba:simultanea", rule)));
    expect(results.filter((r) => r.allowed)).toHaveLength(5);
  });
});
