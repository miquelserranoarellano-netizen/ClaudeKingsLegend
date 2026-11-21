import { afterEach, describe, expect, it, vi } from "vitest";
import { isMailConfigured, mailProvider, sendMail } from "./mail";

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
    await expect(sendMail({ to: "jugador@example.test", subject: "Hola", text: "Enlace" })).rejects.toThrow("Resend respondió 422");
  });
});
