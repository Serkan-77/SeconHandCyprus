"use client";

// Replaces the root layout when it fails, so it cannot use the app's styles.
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          background: "#ffffff",
          color: "#111318",
          padding: 16,
          textAlign: "center",
        }}
      >
        <title>Bir sorun oluştu</title>
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Bir şeyler ters gitti.</h1>
          <p style={{ fontSize: 14, color: "#5b6170", marginBottom: 24 }}>
            Site şu anda yüklenemedi. Birazdan tekrar dene.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              minHeight: 48,
              padding: "0 24px",
              borderRadius: 12,
              border: 0,
              background: "#111318",
              color: "#fff",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Tekrar dene
          </button>
        </div>
      </body>
    </html>
  );
}
