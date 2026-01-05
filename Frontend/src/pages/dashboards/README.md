# Módulo de Dashboards

Este módulo proporciona cuatro dashboards analíticos para el sistema de gestión de proyectos HEG Formatos.

## Dashboards Disponibles

### 1. Dashboard Ejecutivo (`/dashboards/ejecutivo`)
Vista general del sistema con métricas clave:
- **KPIs**: Total de proyectos, proyectos activos, presupuesto total y ejecutado
- **Gráficas**:
  - Distribución de proyectos por estado (Pie Chart)
  - Proyectos completados por mes (Bar Chart)
  - Tendencia de presupuesto mensual (Line Chart)
- **Alertas**: Notificaciones sobre presupuesto y estado de proyectos

### 2. Dashboard de Presupuestos (`/dashboards/presupuestos`)
Análisis financiero detallado:
- **KPIs**: Presupuesto total, ejecutado, disponible y eficiencia de gasto
- **Gráficas**:
  - Distribución por categoría (Cristal, Aluminio, Misceláneos)
  - Top 10 proyectos por inversión
  - Análisis de variación: Planeado vs Ejecutado
- **Resumen**: Categoría con mayor gasto, proyecto más costoso, promedio por proyecto

### 3. Dashboard de Proyectos (`/dashboards/proyectos`)
Seguimiento y control de proyectos:
- **KPIs**: Total de proyectos, en progreso, completados, tasa de completación
- **Gráficas**:
  - Distribución por estado
  - Proyectos completados e iniciados por mes
- **Proyectos Críticos**: Tabla con proyectos que requieren atención (presupuesto >60% o <30 días restantes)
- **Insights**: Recomendaciones basadas en el estado actual

### 4. Dashboard de Materiales (`/dashboards/materiales`)
Gestión de inventario y explosión de insumos:
- **KPIs**: Total de materiales, valor del inventario, materiales críticos, proveedores activos
- **Gráficas**:
  - Top 10 materiales más utilizados
  - Distribución de costos por categoría
  - Proveedores principales
  - Tendencia de costos mensual
- **Proyección de Compras**: Tabla con materiales requeridos vs disponibles, déficit y costo estimado
- **Análisis**: Recomendaciones para optimización

## Estructura de Archivos

```
Frontend/src/pages/dashboards/
├── DashboardEjecutivo.tsx      # Dashboard ejecutivo
├── DashboardPresupuestos.tsx   # Dashboard de presupuestos
├── DashboardProyectos.tsx      # Dashboard de proyectos
├── DashboardMateriales.tsx     # Dashboard de materiales
├── DashboardLayout.tsx         # Layout común con navegación
├── DashboardLayout.css         # Estilos del layout
├── dashboards.css              # Estilos compartidos
└── README.md                   # Esta documentación

Frontend/src/components/charts/
├── KPICard.tsx                 # Componente para tarjetas KPI
├── BarChart.tsx                # Componente de gráfica de barras
├── PieChart.tsx                # Componente de gráfica circular
├── LineChart.tsx               # Componente de gráfica de líneas
└── styles/
    ├── KPICard.css            # Estilos de KPI cards
    └── charts.css             # Estilos de gráficas

Frontend/src/components/
└── DashboardNav.tsx            # Navegación a dashboards (para MainPage)
```

## API Endpoints

Todos los endpoints requieren autenticación JWT:

- `GET /api/dashboard/ejecutivo` - Datos del dashboard ejecutivo
- `GET /api/dashboard/presupuestos` - Datos del dashboard de presupuestos
- `GET /api/dashboard/proyectos` - Datos del dashboard de proyectos
- `GET /api/dashboard/materiales` - Datos del dashboard de materiales

## Dependencias

- **recharts**: Biblioteca de gráficas para React
- **react-router-dom**: Navegación entre dashboards

## Uso

### Agregar navegación en MainPage

```tsx
import { DashboardNav } from '../components/DashboardNav';

// Dentro del componente
<DashboardNav />
```

### Navegar programáticamente

```tsx
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();
navigate('/dashboards/ejecutivo');
```

## Personalización

### Colores de Gráficas

Los colores se pueden personalizar en cada componente:

```tsx
<BarChart
  data={data}
  dataKey="cantidad"
  xAxisKey="mes"
  color="#custom-color"
/>

<PieChart
  data={data}
  dataKey="monto"
  nameKey="categoria"
  colors={['#color1', '#color2', '#color3']}
/>
```

### Estilos

Los estilos globales están en `dashboards.css`. Puedes modificar:
- Colores de tema
- Tamaños de grid
- Espaciado
- Responsive breakpoints

## Características Técnicas

- **Responsive**: Diseño adaptable a móviles y tablets
- **Loading States**: Indicadores de carga mientras se obtienen datos
- **Error Handling**: Manejo de errores con mensajes informativos
- **TypeScript**: Totalmente tipado para mejor desarrollo
- **Real-time Data**: Los datos se actualizan al cargar cada dashboard

## Próximas Mejoras

- [ ] Filtros por fecha
- [ ] Exportación de datos a Excel/PDF
- [ ] Actualización automática de datos (polling)
- [ ] Comparativas entre periodos
- [ ] Dashboards personalizables por usuario
- [ ] Modo oscuro
