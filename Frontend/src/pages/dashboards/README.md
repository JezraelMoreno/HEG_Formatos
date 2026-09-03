# Módulo de Dashboards

Este módulo proporciona dashboards analíticos por proyecto para el sistema de gestión de proyectos HEG Formatos.

## Flujo de navegación

1. `/dashboards` → `ProjectSelector.tsx`: lista los proyectos (filtrados a los asignados si el usuario es Supervisor) y al elegir uno navega al dashboard Ejecutivo de ese proyecto.
2. `/dashboards/:projectId/ejecutivo|presupuestos|general|materiales|cobranza` → cada dashboard, siempre scoped a un proyecto.
3. `/dashboards/proyectos` → `DashboardProyectos.tsx`: vista agregada de portafolio (todos los proyectos), sin `:projectId`.

## Dashboards disponibles

### Dashboard Ejecutivo (`/dashboards/:projectId/ejecutivo`)
Vista general del proyecto: KPIs de presupuesto/avance y gráficas de estado.

### Dashboard de Presupuestos (`/dashboards/:projectId/presupuestos`)
Análisis financiero del proyecto: presupuesto por familia (cristal/aluminio/misceláneos), ejecutado vs disponible.

### Dashboard General (`/dashboards/:projectId/general`)
Estado y avance general del proyecto.

### Dashboard de Materiales (`/dashboards/:projectId/materiales`)
Gestión de inventario y explosión de insumos del proyecto.

### Dashboard de Cobranza (`/dashboards/:projectId/cobranza`)
Resumen y facturas de cobranza del proyecto.

### Dashboard de Proyectos (`/dashboards/proyectos`)
Vista de portafolio completo (todos los proyectos), no scoped a uno solo.

## Estructura de archivos

```
Frontend/src/pages/dashboards/
├── DashboardEjecutivo.tsx      # Dashboard ejecutivo (por proyecto)
├── DashboardPresupuestos.tsx   # Dashboard de presupuestos (por proyecto)
├── DashboardGeneral.tsx        # Dashboard general (por proyecto)
├── DashboardMateriales.tsx     # Dashboard de materiales (por proyecto)
├── DashboardCobranza.tsx       # Dashboard de cobranza (por proyecto)
├── DashboardProyectos.tsx      # Dashboard de portafolio (todos los proyectos)
├── DashboardLayout.tsx         # Layout común con navegación
├── DashboardLayout.css         # Estilos del layout
├── ProjectSelector.tsx         # Selector de proyecto, punto de entrada a /dashboards
├── dashboards.css              # Estilos compartidos
└── README.md                   # Esta documentación

Frontend/src/components/charts/
├── KPICard.tsx                 # Componente para tarjetas KPI
├── BarChart.tsx                # Componente de gráfica de barras
├── PieChart.tsx                # Componente de gráfica circular
├── LineChart.tsx                # Componente de gráfica de líneas
└── styles/
    ├── KPICard.css             # Estilos de KPI cards
    └── charts.css              # Estilos de gráficas
```

## API Endpoints

Todos requieren autenticación JWT; los endpoints por proyecto verifican además que un Supervisor tenga ese proyecto asignado:

- `GET /api/dashboard/proyecto/:id/ejecutivo`
- `GET /api/dashboard/proyecto/:id/presupuestos`
- `GET /api/dashboard/proyecto/:id/general`
- `GET /api/dashboard/proyecto/:id/materiales`
- `GET /proyectos/:id/cobranza-resumen` y `GET /proyectos/:id/cobranza-facturas`
- `GET /api/dashboard/proyectos` (portafolio, sin scoping por proyecto)

## Dependencias

- **recharts**: biblioteca de gráficas para React
- **react-router-dom**: navegación entre dashboards

## Características técnicas

- Responsive, con loading/error states por dashboard.
- TypeScript, totalmente tipado.
- Los datos se obtienen al cargar cada dashboard (sin polling).
