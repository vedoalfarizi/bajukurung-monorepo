import { useEffect } from "react";
import { isAuthenticated, redirectToLogin } from "../utils/auth";

interface RequireAuthProps {
  children: React.ReactNode;
}

/**
 * Wraps seller-only routes. Redirects to Cognito Hosted UI if no valid JWT.
 */
export function RequireAuth({ children }: RequireAuthProps) {
  useEffect(() => {
    if (!isAuthenticated()) {
      redirectToLogin();
    }
  }, []);

  if (!isAuthenticated()) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          color: "#888",
        }}
      >
        Mengalihkan ke halaman login...
      </div>
    );
  }

  return <>{children}</>;
}
