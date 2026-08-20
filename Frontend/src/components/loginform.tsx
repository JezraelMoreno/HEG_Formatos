import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./loginform.css";
import { setToken } from "../auth";
import API_URL from "../config";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre_usuario: email, contrasena: password }),
      });

      const data = await res.json();

      if (res.ok && data.success && data.token) {
        localStorage.setItem("usuario", email);
        setToken(data.token);
        setError("");
        navigate("/home");
        return;
      }
      setError(data?.message || "Credenciales incorrectas");
    } catch (error) {
      console.error("Error de conexión:", error);
      setError("Error de conexión con el servidor");
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-brand">
          <div className="login-brand-blob login-brand-blob-1" />
          <div className="login-brand-blob login-brand-blob-2" />
          <span className="login-brand-logo">
            <img src={`${API_URL}/assets/heg_logo.jpg`} alt="HEG" />
          </span>
          <div className="login-brand-copy">
            <h2>Gestión de proyectos y presupuestos</h2>
            <p>Pedidos, contabilidad, viáticos, dashboards y remisiones en un solo lugar.</p>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <span className="login-form-eyebrow">Bienvenido</span>
          <h2 className="login-form-title">Iniciar sesión</h2>

          {error && <p className="error">{error}</p>}

          <label htmlFor="login-usuario">Usuario</label>
          <div className="login-field">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <input
              id="login-usuario"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Tu usuario"
              required
            />
          </div>

          <label htmlFor="login-contrasena">Contraseña</label>
          <div className="login-field">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <input
              id="login-contrasena"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              required
            />
          </div>

          <a href="#login" className="login-forgot">¿Olvidaste tu contraseña?</a>

          <button type="submit" className="btn-primary login-submit">Entrar</button>
        </form>
      </div>
    </div>
  );
}
