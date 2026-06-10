const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

function authHeaders() {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let detail = "Request failed";
    try {
      const payload = await response.json();
      detail = payload.detail || JSON.stringify(payload);
    } catch {
      detail = response.statusText;
    }
    throw new Error(detail);
  }

  if (response.status === 204) return null;
  return response.json();
}

export const unwrap = (payload) => payload?.results || payload || [];

export async function login(username, password) {
  const payload = await api("/auth/login/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  localStorage.setItem("accessToken", payload.access);
  localStorage.setItem("refreshToken", payload.refresh);
  return payload;
}

export async function register(values) {
  return api("/auth/register/", {
    method: "POST",
    body: JSON.stringify(values),
  });
}
