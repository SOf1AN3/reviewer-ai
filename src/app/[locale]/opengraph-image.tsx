import { ImageResponse } from "next/og";

/**
 * Image Open Graph générée par code (convention de fichier Next.js).
 *
 * Aucune dépendance externe : `next/og` embarque la police Geist-Regular
 * (`node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf`), utilisée
 * comme police par défaut. Aucune police Google distante n'est chargée.
 *
 * Palette du design system « Atmospheric Intelligence » (thème sombre,
 * canonical) : fond `#121414`, encre `#F2F1EB`, accents teal `#A6C9C5` et
 * ambre `#E87C3E`, halo teal `rgba(79,133,139,.28)`.
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
          backgroundColor: "#121414",
          color: "#F2F1EB",
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
          {/* Cartouche logo : bloc teal, liseré ambre et halo teal. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "96px",
              height: "96px",
              backgroundColor: "#A6C9C5",
              border: "6px solid #E87C3E",
              boxShadow: "0 0 96px rgba(79,133,139,0.28)",
              fontSize: "52px",
              fontWeight: 700,
              color: "#121414",
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
                color: "#A6C9C5",
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
            {[
              { label: "Note / 100", accent: true },
              { label: "8 critères", accent: false },
              { label: "Rapport complet", accent: false },
            ].map(({ label, accent }) => (
              <div
                key={label}
                style={{
                  display: "flex",
                  padding: "12px 24px",
                  border: `4px solid ${accent ? "#E87C3E" : "rgba(166,201,197,0.35)"}`,
                  fontSize: "28px",
                  color: accent ? "#E87C3E" : "#F2F1EB",
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
              color: "rgba(242,241,235,0.6)",
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
