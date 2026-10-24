import { beforeAll, describe, expect, it } from "vitest";
import { createTestUser, useTestDb } from "@/test/db";
import type { Db } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { detectImageType, MAX_IMAGE_BYTES, storeImage } from "./service";

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const WEBP = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

describe("imágenes subidas", () => {
  let db: Db;
  beforeAll(async () => {
    db = await useTestDb();
  });

  it("reconoce el tipo real por la firma binaria, no por la extensión", () => {
    expect(detectImageType(PNG)).toBe("image/png");
    expect(detectImageType(JPEG)).toBe("image/jpeg");
    expect(detectImageType(WEBP)).toBe("image/webp");
    expect(detectImageType(SVG)).toBeNull();
    expect(detectImageType(new TextEncoder().encode("GIF89a"))).toBeNull();
  });

  it("rechaza SVG disfrazado de PNG y archivos demasiado grandes", async () => {
    const user = await createTestUser(db);
    const fake = new File([SVG], "logo.png", { type: "image/png" });
    await expect(storeImage(db, fake, { ownerId: user.id, kind: "team_logo", isPublic: true })).rejects.toSatisfy(
      (e) => e instanceof AppError && e.messageKey === "errors.invalidImage",
    );
    const big = new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], "grande.png", { type: "image/png" });
    await expect(storeImage(db, big, { ownerId: user.id, kind: "team_logo", isPublic: true })).rejects.toSatisfy(
      (e) => e instanceof AppError && e.messageKey === "errors.imageTooLarge",
    );
    const ok = await storeImage(db, new File([PNG], "logo.png", { type: "image/png" }), { ownerId: user.id, kind: "team_logo", isPublic: true });
    expect(ok).toMatch(/^[0-9a-f-]{36}$/);
  });
});
