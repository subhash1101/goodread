const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

function authHeaders() {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function api(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const includeAuth = options.auth ?? true;
  const response = await request(path, options, includeAuth);

  if (response.status === 401 && method === "GET" && localStorage.getItem("accessToken")) {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    return parseResponse(await request(path, options, false));
  }

  return parseResponse(response);
}

async function request(path, options, includeAuth) {
  const { auth, ...fetchOptions } = options;
  return fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      ...(includeAuth ? authHeaders() : {}),
      ...(fetchOptions.headers || {}),
    },
  });
}

async function parseResponse(response) {
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
    auth: false,
    body: JSON.stringify({ username, password }),
  });
  localStorage.setItem("accessToken", payload.access);
  localStorage.setItem("refreshToken", payload.refresh);
  return payload;
}

export async function register(values) {
  return api("/auth/register/", {
    method: "POST",
    auth: false,
    body: JSON.stringify(values),
  });
}
