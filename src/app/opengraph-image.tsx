import { ImageResponse } from "next/og";

export const alt = "Kings Legend · Torneos y ligas de League of Legends";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Imagen para compartir en redes (Open Graph) con la marca provisional. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0e1220", color: "white", padding: 72, position: "relative" }}>
        <div style={{ position: "absolute", right: 120, top: -40, width: 160, height: 760, background: "#d0103a", transform: "skewX(-20deg)" }} />
        <div style={{ position: "absolute", right: 300, top: -40, width: 30, height: 760, background: "white", opacity: 0.85, transform: "skewX(-20deg)" }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <svg width="72" height="72" viewBox="0 0 32 32">
              <path d="M0 4a4 4 0 0 1 4-4h20l8 8v20a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4z" fill="#d0103a" />
              <path d="M7 21.5V11.2l4.6 4.1L16 7.5l4.4 7.8 4.6-4.1v10.3z" fill="#fff" />
              <rect x="7" y="23" width="18" height="2.6" fill="#fff" />
            </svg>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1 }}>KINGS</span>
              <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: 10, color: "#d0103a" }}>LEGEND</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 760 }}>
            <span style={{ fontSize: 84, fontWeight: 800, lineHeight: 1, letterSpacing: -2 }}>COMPITE. GANA.</span>
            <span style={{ fontSize: 84, fontWeight: 800, lineHeight: 1, letterSpacing: -2, color: "#d0103a" }}>HAZTE LEYENDA.</span>
            <span style={{ fontSize: 30, marginTop: 28, opacity: 0.8 }}>Torneos y ligas de League of Legends</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
