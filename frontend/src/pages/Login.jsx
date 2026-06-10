import React from "react";
import { LogIn } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";

export default function Login() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState("login");
  const [values, setValues] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");

  function change(event) {
    setValues((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      if (mode === "login") await auth.login(values.username, values.password);
      else await auth.register(values);
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="auth-panel">
      <h1>{mode === "login" ? "Sign in" : "Create account"}</h1>
      <form onSubmit={submit}>
        <label>
          Username
          <input name="username" value={values.username} onChange={change} required />
        </label>
        {mode === "register" && (
          <label>
            Email
            <input name="email" value={values.email} onChange={change} type="email" />
          </label>
        )}
        <label>
          Password
          <input name="password" value={values.password} onChange={change} type="password" required />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="primary-button">
          <LogIn size={16} />
          {mode === "login" ? "Sign in" : "Register"}
        </button>
      </form>
      <button className="link-button" onClick={() => setMode(mode === "login" ? "register" : "login")}>
        {mode === "login" ? "Create an account" : "Use existing account"}
      </button>
    </section>
  );
}
