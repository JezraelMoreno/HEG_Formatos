import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./mainPage.css";

type Proyecto = {
  id_proyecto: number;
  nombre: string;
  fecha_proyecto: string; // formato YYYY-MM-DD
};

export function MainPage() {
  const navigate = useNavigate();
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState("");

  const handleLogout = () => {
    localStorage.removeItem("usuario");
    navigate("/");
  };

  const cargarProyectos = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await fetch("http://localhost:3000/proyectos");
      const data = await res.json();
      if (res.ok && data.success) {
        setProyectos(data.data as Proyecto[]);
      } else {
        setError(data?.message || "Error cargando proyectos");
      }
    } catch (e) {
      setError("Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarProyectos();
  }, []);

  const abrirModal = () => setModalAbierto(true);
  const cerrarModal = () => {
    setModalAbierto(false);
    setNombre("");
    setFecha("");
    setError("");
  };

  const crearProyecto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre || !fecha) {
      setError("Completa nombre y fecha");
      return;
    }
    try {
      setError("");
      const res = await fetch("http://localhost:3000/proyectos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, fecha_proyecto: fecha }),
      });
      const data = await res.json();
      if (res.status === 201 && data.success) {
        cerrarModal();
        cargarProyectos();
      } else {
        setError(data?.message || "No se pudo crear el proyecto");
      }
    } catch (e) {
      setError("Error de conexión con el servidor");
    }
  };

  return (
    <div className="main-page">
      <h1 className="titulo">Página Principal</h1>

      <div className="actions">
        <button className="action-button create-button" onClick={abrirModal}>
          Crear proyecto
        </button>
        <button className="action-button logout-button" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </div>

      <div className="contenido">
        {loading && <p>Cargando proyectos...</p>}
        {error && <p className="error-text">{error}</p>}
        {!loading && !error && (
          <ul className="lista-proyectos">
            {proyectos.map((p) => (
              <li key={p.id_proyecto} className="item-proyecto">
                <span className="nombre">{p.nombre}</span>
                <span className="fecha">{p.fecha_proyecto}</span>
              </li>
            ))}
            {proyectos.length === 0 && <li>No hay proyectos aún</li>}
          </ul>
        )}
      </div>

      {modalAbierto && (
        <div className="modal-overlay" onClick={cerrarModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Crear proyecto</h3>
            {error && <p className="error-text">{error}</p>}
            <form onSubmit={crearProyecto} className="form-proyecto">
              <label>Nombre</label>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre del proyecto"
                required
              />
              <label>Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                required
              />
              <div className="modal-actions">
                <button type="button" className="action-button" onClick={cerrarModal}>
                  Cancelar
                </button>
                <button type="submit" className="action-button create-button">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
