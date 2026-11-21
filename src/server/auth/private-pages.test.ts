import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Las zonas privadas (/dashboard y /admin) no tienen un *proxy* delante (en Cloudflare no funciona bien):
 * cada página comprueba la sesión en el servidor con su propia ruta, de modo que, sin sesión, se redirige
 * al acceso y después se vuelve exactamente a esa página. Esta prueba impide que una página nueva lo olvide.
 */
const appDir = path.join(process.cwd(), "src", "app");

function pagesUnder(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return pagesUnder(full);
    return entry.name === "page.tsx" ? [full] : [];
  });
}

/** Ruta pública de un `page.tsx` (`src/app/dashboard/equipos/[id]/page.tsx` → `/dashboard/equipos/${id}`). */
function routeOf(file: string): string {
  const segments = path
    .relative(appDir, path.dirname(file))
    .split(path.sep)
    .filter((segment) => !segment.startsWith("("))
    .map((segment) => segment.replace(/^\[(.+)\]$/, "${$1}"));
  return `/${segments.join("/")}`;
}

describe("páginas privadas", () => {
  const pages = [...pagesUnder(path.join(appDir, "dashboard")), ...pagesUnder(path.join(appDir, "admin"))];

  it("hay páginas que comprobar", () => {
    expect(pages.length).toBeGreaterThan(20);
  });

  it.each(pages.map((file) => [routeOf(file), file]))("%s comprueba la sesión con su propia ruta", (route, file) => {
    const source = readFileSync(file, "utf8");
    const guard = source.match(/require(User|AdminArea|PlatformAdmin)\(\s*([`"])(.*?)\2\s*\)/);
    // `/admin` y `/dashboard` pueden usar el valor por defecto de la función.
    const defaultOk = /require(User|AdminArea|PlatformAdmin)\(\)/.test(source) && (route === "/admin" || route === "/dashboard");
    expect(guard || defaultOk, `${file} debe llamar a requireUser/requireAdminArea/requirePlatformAdmin`).toBeTruthy();
    if (guard) expect(guard[3]).toBe(route);
  });
});
