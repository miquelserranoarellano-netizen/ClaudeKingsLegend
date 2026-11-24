import { afterEach, describe, expect, it, vi } from "vitest";
import { audit } from "./audit";
import { isMailConfigured, mailProvider, parseFrom, sendMail } from "./mail";

// El fallo se guarda en la auditoría: aquí no hay base de datos, solo se comprueba qué se guardaría.
vi.mock("./audit", () => ({ audit: vi.fn(async () => {}) }));
vi.mock("./db/client", async (importOriginal) => ({ ...(await importOriginal<typeof import("./db/client")>()), getDb: vi.fn(async () => ({})) }));

const MAIL_VARS = ["MAIL_FROM", "RESEND_API_KEY", "SMTP_HOST"] as const;
const saved = Object.fromEntries(MAIL_VARS.map((name) => [name, process.env[name]]));

afterEach(() => {
  for (const name of MAIL_VARS) {
    if (saved[name] === undefined) delete process.env[name];
    else process.env[name] = saved[name];
  }
  vi.unstubAllGlobals();
});

describe("correo", () => {
  it("sin remitente no hay correo, aunque haya proveedor", () => {
    delete process.env.MAIL_FROM;
    process.env.RESEND_API_KEY = "re_prueba";
    expect(isMailConfigured()).toBe(false);
  });

  it("Resend tiene prioridad sobre SMTP", () => {
    process.env.MAIL_FROM = "Kings Legend <no-responder@example.test>";
    process.env.SMTP_HOST = "smtp.example.test";
    process.env.RESEND_API_KEY = "re_prueba";
    expect(mailProvider()).toBe("resend");
    delete process.env.RESEND_API_KEY;
    expect(mailProvider()).toBe("smtp");
  });

  it("envía con la API de Resend y falla si la API responde con error", async () => {
    process.env.MAIL_FROM = "Kings Legend <no-responder@example.test>";
    process.env.RESEND_API_KEY = "re_prueba";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendMail({ to: "jugador@example.test", subject: "Hola", text: "Enlace" })).resolves.toBe("sent");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_prueba");
    expect(JSON.parse(String(init.body))).toEqual({
      from: "Kings Legend <no-responder@example.test>",
      to: ["jugador@example.test"],
      subject: "Hola",
      text: "Enlace",
    });

    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 422 }));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(sendMail({ to: "jugador@example.test", subject: "Hola", text: "Enlace" })).rejects.toThrow("Resend respondió 422");
    // El fallo queda registrado (Better Auth se traga los errores de sus correos), sin el destinatario.
    expect(logged).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logged.mock.calls[0])).not.toContain("jugador@example.test");
    expect(audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "mail.failed", entityType: "mail", data: { subject: "Hola", reason: "Resend respondió 422" } }));
    expect(JSON.stringify(vi.mocked(audit).mock.calls)).not.toContain("jugador@example.test");
    logged.mockRestore();
  });
});

describe("remitente de los correos (MAIL_FROM)", () => {
  it("separa el nombre y la dirección", () => {
    expect(parseFrom("Kings Legend <liga.kings@gmail.com>")).toEqual({ name: "Kings Legend", email: "liga.kings@gmail.com" });
    expect(parseFrom('"Kings Legend" <liga@ejemplo.es>')).toEqual({ name: "Kings Legend", email: "liga@ejemplo.es" });
  });

  it("entiende el remitente aunque falten los < >", () => {
    expect(parseFrom("Kings Legend kingslegend.liga@gmail.com")).toEqual({ name: "Kings Legend", email: "kingslegend.liga@gmail.com" });
  });

  it("acepta solo la dirección", () => {
    expect(parseFrom("liga.kings@gmail.com")).toEqual({ email: "liga.kings@gmail.com" });
    expect(parseFrom("<liga.kings@gmail.com>")).toEqual({ email: "liga.kings@gmail.com" });
  });
});
