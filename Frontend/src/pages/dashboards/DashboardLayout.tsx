import React from 'react';
import { useNavigate } from 'react-router-dom';
import './DashboardLayout.css';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const navigate = useNavigate();

  return (
    <div className="dashboard-layout">
      <nav className="dashboard-navbar">
        <button className="nav-back-button" onClick={() => navigate('/home')}>
          ← Volver al Inicio
        </button>
        <div className="nav-links">
          <button onClick={() => navigate('/dashboards/ejecutivo')} className="nav-link">
            Ejecutivo
          </button>
          <button onClick={() => navigate('/dashboards/presupuestos')} className="nav-link">
            Presupuestos
          </button>
          <button onClick={() => navigate('/dashboards/proyectos')} className="nav-link">
            Proyectos
          </button>
          <button onClick={() => navigate('/dashboards/materiales')} className="nav-link">
            Materiales
          </button>
        </div>
      </nav>
      <div className="dashboard-content">
        {children}
      </div>
    </div>
  );
};
