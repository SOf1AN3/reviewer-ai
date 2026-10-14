import { ImageResponse } from "next/og";

/**
 * Image Open Graph générée par code (convention de fichier Next.js).
 *
 * Aucune dépendance externe : `next/og` embarque la police Geist-Regular
 * (`node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf`), utilisée
 * comme police par défaut. Aucune police Google distante n'est chargée.
 *
 * Le texte reste volontairement en latin : Geist ne couvre pas les caractères
 * arabes, et une baseline en « paper » rendrait des glyphes vides pour `ar`.
 */
export const alt = "PaperNote — analyse d'articles scientifiques par IA";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          backgroundColor: "#0f172a",
          color: "#f8fafc",
          fontFamily: "geist",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "28px",
          }}
        >
          {/* Cartouche logo, reprise du style « brutal » du site. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "96px",
              height: "96px",
              backgroundColor: "#facc15",
              border: "6px solid #f8fafc",
              fontSize: "52px",
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            PN
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                fontSize: "76px",
                fontWeight: 700,
                letterSpacing: "-1px",
              }}
            >
              PaperNote
            </div>
            <div
              style={{
                fontSize: "32px",
                color: "#94a3b8",
                marginTop: "4px",
              }}
            >
              Peer review augmenté par l&apos;IA
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "16px",
            }}
          >
            {["Note / 100", "8 critères", "Rapport complet"].map((label) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  padding: "12px 24px",
                  border: "4px solid #334155",
                  fontSize: "28px",
                  color: "#e2e8f0",
                }}
              >
                {label}
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: "26px",
              color: "#64748b",
            }}
          >
            PDF · DOCX · TEX · TXT · MD
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
