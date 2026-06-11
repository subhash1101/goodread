import React, { createContext, useContext, useMemo, useState } from "react";
import { login as loginRequest, register as registerRequest } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem("accessToken"));

  const value = useMemo(
    () => ({
      isAuthenticated: Boolean(token),
      username: localStorage.getItem("username") || "",
      async login(username, password) {
        await loginRequest(username, password);
        localStorage.setItem("username", username);
        setToken(localStorage.getItem("accessToken"));
      },
      async register(values) {
        await registerRequest(values);
        await loginRequest(values.username, values.password);
        localStorage.setItem("username", values.username);
        setToken(localStorage.getItem("accessToken"));
      },
      logout() {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("username");
        setToken(null);
      },
    }),
    [token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
