/**
 * Cognito Hosted UI authentication utilities.
 *
 * Flow:
 *  1. Unauthenticated user visits /seller/* → redirected to Cognito Hosted UI.
 *  2. Cognito redirects back to VITE_COGNITO_REDIRECT_URI with ?code=...
 *  3. /seller/callback exchanges the code for tokens via Cognito's /oauth2/token endpoint.
 *  4. id_token (JWT) is stored in sessionStorage; user is redirected to /seller.
 */

const COGNITO_DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN ?? "";
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID ?? "";
const REDIRECT_URI = import.meta.env.VITE_COGNITO_REDIRECT_URI ?? "";

const TOKEN_KEY = "seller_id_token";

// ── Token storage ─────────────────────────────────────────────────────────────

export function storeToken(idToken: string): void {
  sessionStorage.setItem(TOKEN_KEY, idToken);
}

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  const token = getToken();
  if (!token) return false;
  try {
    // Decode JWT payload (no signature verification — API Gateway handles that)
    const payload = JSON.parse(atob(token.split(".")[1]));
    const now = Math.floor(Date.now() / 1000);
    return typeof payload.exp === "number" && payload.exp > now;
  } catch {
    return false;
  }
}

// ── Cognito Hosted UI redirect ────────────────────────────────────────────────

export function redirectToLogin(): void {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: "openid email",
  });
  window.location.href = `${COGNITO_DOMAIN}/oauth2/authorize?${params.toString()}`;
}

export function redirectToLogout(): void {
  clearToken();
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    logout_uri: REDIRECT_URI,
  });
  window.location.href = `${COGNITO_DOMAIN}/logout?${params.toString()}`;
}

// ── Authorization code exchange ───────────────────────────────────────────────

export async function exchangeCodeForToken(code: string): Promise<void> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code,
  });

  const res = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Token exchange failed: ${res.status}`);
  }

  const data = await res.json();
  if (!data.id_token) {
    throw new Error("No id_token in token response");
  }
  storeToken(data.id_token);
}

// ── Authenticated fetch helper ────────────────────────────────────────────────

/**
 * Wraps fetch with `Authorization: Bearer {jwt}` header.
 * Throws if no valid token is present.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const token = getToken();
  if (!token) {
    throw new Error("Not authenticated");
  }
  return fetch(input, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}
