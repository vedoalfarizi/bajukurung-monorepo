import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { exchangeCodeForToken } from "../utils/auth";

/**
 * Handles the Cognito Hosted UI redirect back to the app.
 * Exchanges the authorization code for a JWT, then navigates to /seller.
 */
export function SellerAuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (!code) {
      setError("Kode otorisasi tidak ditemukan.");
      return;
    }

    exchangeCodeForToken(code)
      .then(() => {
        // Remove the code from the URL before navigating
        navigate("/seller", { replace: true });
      })
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : "Gagal melakukan autentikasi."
        );
      });
  }, [navigate]);

  if (error) {
    return (
      <div style={containerStyle}>
        <p style={{ color: "#c62828" }}>{error}</p>
        <button
          onClick={() => navigate("/seller")}
          style={buttonStyle}
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <p style={{ color: "#555" }}>Memverifikasi sesi Anda...</p>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100vh",
  gap: 16,
};

const buttonStyle: React.CSSProperties = {
  padding: "10px 24px",
  background: "#333",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontSize: 14,
};
