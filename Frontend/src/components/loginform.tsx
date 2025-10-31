import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./loginform.css";
import { setToken } from "../auth";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch("http://localhost:3000/login", {
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
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>Iniciar Sesión</h2>

        {error && <p className="error">{error}</p>}

        <label>Usuario</label>
        <input
          type="text"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Usuario"
          required
        />

        <label>Contraseña</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="********"
          required
        />

        <button type="submit">Entrar</button>
      </form>
    </div>
  );
}
