import { ImageResponse } from "next/og";

export const alt = "Kings Legend · Torneos y ligas de League of Legends";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Imagen para compartir en redes (Open Graph): noche azulada, oro y el emblema de la marca. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#010a13",
          backgroundImage:
            "radial-gradient(circle at 78% 45%, rgba(10,200,185,0.28), rgba(10,200,185,0) 42%), radial-gradient(circle at 10% 100%, rgba(200,170,110,0.22), rgba(200,170,110,0) 45%)",
          color: "#f0e6d2",
          padding: 64,
          position: "relative",
        }}
      >
        {/* Satori no entiende `inset`: hay que dar los cuatro lados. */}
        <div style={{ position: "absolute", top: 24, left: 24, right: 24, bottom: 24, border: "2px solid rgba(200,170,110,0.55)", display: "flex" }} />
        <svg width="420" height="420" viewBox="0 0 32 36" style={{ position: "absolute", right: 70, top: 105 }}>
          <path d="M16 1 30.5 9v18L16 35 1.5 27V9z" fill="#0a1428" stroke="#c8aa6e" strokeWidth="0.8" />
          <path d="M16 4.3 27.6 10.9v14.2L16 31.7 4.4 25.1V10.9z" fill="none" stroke="#c8aa6e" strokeOpacity="0.4" strokeWidth="0.3" />
          <path d="M8.2 23.8v-9l4 3.6L16 11.6l3.8 6.8 4-3.6v9z" fill="#d9bb7c" />
          <rect x="8.2" y="25" width="15.6" height="2.2" fill="#d9bb7c" />
          <path d="M16 16.8l1.7 2.6L16 22 14.3 19.4z" fill="#0ac8b9" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", maxWidth: 700 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: 6, color: "#0ac8b9" }}>LEAGUE OF LEGENDS · COMPETICIÓN</span>
            <span style={{ fontSize: 64, fontWeight: 800, fontStyle: "italic", color: "#e6cd94", marginTop: 18 }}>KINGS LEGEND</span>
            <div style={{ display: "flex", width: 260, height: 2, marginTop: 20, backgroundImage: "linear-gradient(90deg, #c8aa6e, rgba(200,170,110,0))" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 76, fontWeight: 800, fontStyle: "italic", lineHeight: 1 }}>COMPITE. GANA.</span>
            <span style={{ fontSize: 76, fontWeight: 800, fontStyle: "italic", lineHeight: 1, color: "#c8aa6e" }}>HAZTE LEYENDA.</span>
            <span style={{ fontSize: 28, marginTop: 28, color: "#c5cbd6" }}>Inscripciones, cuadros y clasificaciones</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
