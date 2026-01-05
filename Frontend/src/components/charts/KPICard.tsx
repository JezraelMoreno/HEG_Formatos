import React from 'react';
import '../styles/KPICard.css';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  icon?: string;
  color?: string;
}

export const KPICard: React.FC<KPICardProps> = ({
  title,
  value,
  subtitle,
  trend,
  icon,
  color = '#3b82f6'
}) => {
  return (
    <div className="kpi-card" style={{ borderLeftColor: color }}>
      <div className="kpi-header">
        <span className="kpi-title">{title}</span>
        {icon && <span className="kpi-icon">{icon}</span>}
      </div>
      <div className="kpi-value">{value}</div>
      {subtitle && <div className="kpi-subtitle">{subtitle}</div>}
      {trend && (
        <div className={`kpi-trend ${trend.isPositive ? 'positive' : 'negative'}`}>
          <span>{trend.isPositive ? '↑' : '↓'}</span>
          <span>{Math.abs(trend.value)}%</span>
        </div>
      )}
    </div>
  );
};
