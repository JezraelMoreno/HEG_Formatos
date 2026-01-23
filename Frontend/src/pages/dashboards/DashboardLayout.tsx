import React from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import './DashboardLayout.css';

interface DashboardLayoutProps {
  children: React.ReactNode;
  projectName?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, projectName }) => {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const location = useLocation();

  const getCurrentTab = () => {
    const path = location.pathname;
    if (path.includes('/ejecutivo')) return 'ejecutivo';
    if (path.includes('/presupuestos')) return 'presupuestos';
    if (path.includes('/general')) return 'general';
    if (path.includes('/materiales')) return 'materiales';
    if (path.includes('/cobranza')) return 'cobranza';
    return '';
  };

  const currentTab = getCurrentTab();

  return (
    <div className="dashboard-layout">
      <nav className="dashboard-navbar">
        <button className="nav-back-button" onClick={() => navigate('/dashboards')}>
          ← Cambiar Proyecto
        </button>
        {projectName && (
          <div className="nav-project-name">
            <span className="project-label">Proyecto:</span>
            <span className="project-title">{projectName}</span>
          </div>
        )}
        <div className="nav-links">
          <button
            onClick={() => navigate(`/dashboards/${projectId}/ejecutivo`)}
            className={`nav-link ${currentTab === 'ejecutivo' ? 'active' : ''}`}
          >
            Ejecutivo
          </button>
          <button
            onClick={() => navigate(`/dashboards/${projectId}/presupuestos`)}
            className={`nav-link ${currentTab === 'presupuestos' ? 'active' : ''}`}
          >
            Presupuestos
          </button>
          <button
            onClick={() => navigate(`/dashboards/${projectId}/general`)}
            className={`nav-link ${currentTab === 'general' ? 'active' : ''}`}
          >
            General
          </button>
          <button
            onClick={() => navigate(`/dashboards/${projectId}/materiales`)}
            className={`nav-link ${currentTab === 'materiales' ? 'active' : ''}`}
          >
            Materiales
          </button>
          <button
            onClick={() => navigate(`/dashboards/${projectId}/cobranza`)}
            className={`nav-link ${currentTab === 'cobranza' ? 'active' : ''}`}
          >
            Cobranza
          </button>
        </div>
      </nav>
      <div className="dashboard-content">
        {children}
      </div>
    </div>
  );
};
