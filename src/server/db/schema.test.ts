import { PGlite } from "@electric-sql/pglite";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { describe, expect, it } from "vitest";
import { migrationsFolder } from "./client";
import * as schema from "./schema";

const tables: PgTable[] = (Object.values(schema) as unknown[]).filter((value): value is PgTable => value instanceof PgTable);

/**
 * En Supabase el esquema `public` se publica en una API REST con los roles `anon` y `authenticated`. La
 * aplicación no la usa, así que todas las tablas llevan RLS sin políticas y esos roles no tienen permisos.
 * Estas pruebas evitan que una tabla nueva se quede abierta por olvido.
 */
describe("esquema preparado para Supabase", () => {
  it("todas las tablas del esquema activan RLS", () => {
    expect(tables.length).toBeGreaterThan(20);
    const withoutRls = tables.filter((table) => !getTableConfig(table).enableRLS).map((t) => getTableConfig(t).name);
    expect(withoutRls).toEqual([]);
  });

  it("tras las migraciones, la API pública de Supabase no puede leer ni escribir nada", async () => {
    const client = new PGlite();
    // Roles y permisos por defecto como los de un proyecto nuevo de Supabase.
    await client.exec(`
      create role anon nologin;
      create role authenticated nologin;
      grant usage on schema public to anon, authenticated;
      alter default privileges in schema public grant all on tables to anon, authenticated;
      alter default privileges in schema public grant all on sequences to anon, authenticated;
    `);
    await migrate(drizzle({ client }), { migrationsFolder: migrationsFolder() });

    const { rows: open } = await client.query<{ relname: string }>(`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
    `);
    expect(open).toEqual([]);

    const { rows: granted } = await client.query<{ grantee: string; table_name: string }>(`
      select grantee, table_name from information_schema.role_table_grants
      where table_schema = 'public' and grantee in ('anon', 'authenticated')
    `);
    expect(granted).toEqual([]);

    await client.exec("set role anon");
    await expect(client.query("select * from users")).rejects.toThrow(/permission denied/);
    await expect(client.query("select * from sessions")).rejects.toThrow(/permission denied/);
    await client.exec("reset role");
    await client.close();
  });
});
