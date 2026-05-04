"use client";

/**
 * Installation loop — intro screen.
 *
 * Outer black layer is fully opaque from frame 1 (no fade-in) so the
 * shader stack underneath is never briefly visible during a cycle's
 * intro. Only the text content fades in.
 */
export function InstallationIntro() {
  return (
    <div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black px-8 text-center"
    >
      <div style={{ animation: "installationContentFade 1400ms ease-out forwards", opacity: 0 }}>
        <div
          className="text-white/90"
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontWeight: 300,
            fontSize: "clamp(3.5rem, 8vw, 6rem)",
            letterSpacing: "-0.02em",
            lineHeight: 1.05,
            textAlign: "center",
          }}
        >
          Resonance
        </div>

        <div
          className="text-white/55 mt-3"
          style={{
            fontFamily: "'Cormorant Garamond', Georgia, serif",
            fontStyle: "italic",
            fontWeight: 300,
            fontSize: "clamp(1.1rem, 2.4vw, 1.7rem)",
            letterSpacing: "0.01em",
            textAlign: "center",
          }}
        >
          A contemplative listening room
        </div>

        <p
          className="text-white/40 mt-12 max-w-xl mx-auto"
          style={{
            fontFamily: "var(--font-geist-sans)",
            fontWeight: 400,
            fontSize: "clamp(0.85rem, 1.4vw, 1rem)",
            lineHeight: 1.7,
            textAlign: "center",
          }}
        >
          Composed music drives a slow audiovisual landscape — shaders, light,
          AI-curated imagery — that never repeats verbatim. Recline. Stay as long
          or as briefly as you wish.
        </p>

        <div
          className="text-white/25 mt-16"
          style={{
            fontFamily: "var(--font-geist-mono)",
            fontSize: "0.72rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            textAlign: "center",
          }}
        >
          by Karel Barnoski
        </div>
      </div>

      <style jsx>{`
        @keyframes installationContentFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
