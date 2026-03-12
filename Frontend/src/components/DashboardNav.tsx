import React from 'react';
import { useNavigate } from 'react-router-dom';
import './DashboardNav.css';

export const DashboardNav: React.FC = () => {
  const navigate = useNavigate();

  const dashboards = [
    {
      title: 'Dashboard Ejecutivo',
      description: 'Vista general del sistema',
      icon: 'EJ',
      path: '/dashboards/ejecutivo',
      color: '#3b82f6'
    },
    {
      title: 'Presupuestos',
      description: 'Análisis financiero',
      icon: 'PR',
      path: '/dashboards/presupuestos',
      color: '#10b981'
    },
    {
      title: 'Proyectos',
      description: 'Seguimiento de proyectos',
      icon: 'PY',
      path: '/dashboards/proyectos',
      color: '#f59e0b'
    },
    {
      title: 'Materiales',
      description: 'Gestión de inventario',
      icon: 'MT',
      path: '/dashboards/materiales',
      color: '#8b5cf6'
    },
    {
      title: 'Cobranza General',
      description: 'Control de cobranza y números rojos',
      icon: 'CB',
      path: '/dashboards/cobranza',
      color: '#ef4444'
    }
  ];

  return (
    <div className="dashboard-nav-container">
      <h2 className="dashboard-nav-title">Dashboards Analíticos</h2>
      <div className="dashboard-nav-grid">
        {dashboards.map((dashboard, index) => (
          <button
            key={index}
            className="dashboard-nav-card"
            onClick={() => navigate(dashboard.path)}
            style={{ borderLeftColor: dashboard.color }}
          >
            <div className="dashboard-nav-icon">{dashboard.icon}</div>
            <div className="dashboard-nav-content">
              <h3 className="dashboard-nav-card-title">{dashboard.title}</h3>
              <p className="dashboard-nav-card-description">{dashboard.description}</p>
            </div>
            <div className="dashboard-nav-arrow">→</div>
          </button>
        ))}
      </div>
    </div>
  );
};
