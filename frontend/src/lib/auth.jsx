import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { login as loginRequest, register as registerRequest } from "./api";

const API_URL = import.meta.env.VITE_API_URL || "/api";
const AuthContext = createContext(null);

function parseJwtUserId(token) {
  if (!token) return null;
  try {
    const b64url = token.split(".")[1];
    if (!b64url) return null;
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return typeof payload.user_id === "number" ? payload.user_id : null;
  } catch {
    return null;
  }
}

function storedUserId() {
  const raw = localStorage.getItem("userId");
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : null;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("accessToken"));

  // userId as real state so components re-render when it resolves
  const [userId, setUserId] = useState(() => {
    const sid = storedUserId();
    if (sid) return sid;
    return parseJwtUserId(localStorage.getItem("accessToken"));
  });

  // Fallback: if logged in but userId still null, ask the backend
  useEffect(() => {
    const tok = localStorage.getItem("accessToken");
    if (!tok) return;
    if (storedUserId()) return; // already have it
    if (parseJwtUserId(tok)) {
      // JWT decode worked — persist and set
      const uid = parseJwtUserId(tok);
      localStorage.setItem("userId", String(uid));
      setUserId(uid);
      return;
    }
    // Last resort: fetch /users/me/
    fetch(`${API_URL}/users/me/`, {
      headers: { Authorization: `Bearer ${tok}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.id) {
          const id = Number(data.id);
          localStorage.setItem("userId", String(id));
          setUserId(id);
        }
      })
      .catch(() => {});
  }, [token]); // re-run when token changes (e.g., after login)

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(token),
      username: localStorage.getItem("username") || "",
      userId,
      async login(username, password) {
        await loginRequest(username, password);
        localStorage.setItem("username", username);
        const tok = localStorage.getItem("accessToken");
        const uid = parseJwtUserId(tok);
        if (uid) {
          localStorage.setItem("userId", String(uid));
          setUserId(uid);
        }
        setToken(tok);
      },
      async register(values) {
        await registerRequest(values);
        await loginRequest(values.username, values.password);
        localStorage.setItem("username", values.username);
        const tok = localStorage.getItem("accessToken");
        const uid = parseJwtUserId(tok);
        if (uid) {
          localStorage.setItem("userId", String(uid));
          setUserId(uid);
        }
        setToken(tok);
      },
      logout() {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("username");
        localStorage.removeItem("userId");
        setToken(null);
        setUserId(null);
      },
    }),
    [token, userId]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
