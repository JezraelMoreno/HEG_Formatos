import { useNavigate } from "react-router-dom";

export function MainPage() {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Si luego agregas tokens o usuario logueado, aquí los borrarás:
    localStorage.removeItem("usuario");
    // Redirige al login
    navigate("/");
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: "20px",
      }}
    >
      <h1>Página Principal</h1>
      <button
        style={{
          backgroundColor: "#224c84ff",
          color: "white",
          border: "none",
          borderRadius: "8px",
          padding: "10px 20px",
          cursor: "pointer",
        }}
        onClick={handleLogout}
      >
        Cerrar sesión
      </button>
    </div>
  );
}
