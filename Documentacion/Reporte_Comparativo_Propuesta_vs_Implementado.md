# Reporte Comparativo: Propuesta vs Implementación
## Sistema de Gestión de Proyectos HEG
### Período de Evaluación: 15 de Diciembre 2025 - 16 de Enero 2026

---

## Resumen Ejecutivo

Este documento presenta una comparativa entre el **alcance original** definido en la propuesta del 25 de septiembre de 2025 y el **estado actual del sistema**, destacando tanto el cumplimiento de los objetivos acordados como las funcionalidades adicionales implementadas que agregan valor al negocio.

---

## 1. Cumplimiento del Alcance Original

### 1.1 Objetivos del Proyecto

| Objetivo Propuesto | Estado | Observaciones |
|-------------------|--------|---------------|
| Centralizar información de proyectos entre usuarios | Cumplido | Sistema multiusuario funcionando |
| Controlar importe contratado, cobrado, a cobrar, fondo de garantía | Cumplido | Implementado con campos adicionales |
| Facilitar colaboración entre diferentes roles | Cumplido | Sistema de roles activo |
| Generar reportes en Excel/CSV | Cumplido | Exportación funcional con filtros |
| Acceso desde cualquier lugar (aplicación web) | Cumplido | Sistema desplegado y accesible |

---

### 1.2 Alcance del Sistema - Detalle

#### Gestión de Proyectos

| Funcionalidad | Propuesta | Implementada | Estado |
|--------------|-----------|--------------|--------|
| Crear proyectos nuevos | | | Cumplido |
| Definir datos según especificaciones del cliente | | | Cumplido |
| Llenar secciones según rol del usuario | | | Cumplido |
| Soporte para tres tipos de productos (vidrio, aluminio, misceláneos) | | | Cumplido |

#### Roles de Usuario

| Funcionalidad | Propuesta | Implementada | Estado |
|--------------|-----------|--------------|--------|
| Diferentes vistas por usuario | | | Cumplido |
| Permisos diferenciados | | | Cumplido |
| Autenticación segura | | | Cumplido |

#### Reportes

| Funcionalidad | Propuesta | Implementada | Estado |
|--------------|-----------|--------------|--------|
| Exportar reportes en Excel/CSV | | | Cumplido |
| Filtrar parámetros para exportación | | | Cumplido |
| Importar datos desde Excel/CSV | | | Cumplido |

#### Acceso y Seguridad

| Funcionalidad | Propuesta | Implementada | Estado |
|--------------|-----------|--------------|--------|
| Credenciales seguras | | | Cumplido |
| Autenticación por roles | | | Cumplido |
| Acceso desde cualquier computadora | | | Cumplido |

---

## 2. Funcionalidades Adicionales Implementadas

### (Fuera del alcance original - Valor agregado sin costo adicional)

Durante el período de diciembre 2025 a enero 2026, se implementaron las siguientes funcionalidades que **no estaban contempladas en la propuesta original**, representando valor agregado para la organización:

---

### 2.1 Módulo de Paneles de Control (Dashboards)

**No incluido en propuesta original**

Se desarrolló un conjunto completo de paneles de control gerenciales para visualización de información en tiempo real:

| Panel | Descripción | Beneficio |
|-------|-------------|-----------|
| **Panel Ejecutivo** | Vista general con indicadores clave del negocio | Permite a la dirección tener visibilidad inmediata del estado general |
| **Panel de Presupuestos** | Comparativo entre presupuesto planeado vs ejercido | Identifica desviaciones financieras de forma temprana |
| **Panel de Proyectos** | Seguimiento de avances y estado de proyectos | Facilita la priorización y seguimiento de entregas |
| **Panel de Materiales** | Control de materiales y relación con proveedores | Optimiza la gestión de compras y abastecimiento |
| **Panel de Cobranza** | Seguimiento de cuentas por cobrar | Mejora el flujo de efectivo y gestión de cartera |

**Valor agregado:** Información consolidada para toma de decisiones sin necesidad de generar reportes manuales.

---

### 2.2 Gestión de Estados de Proyecto

**No incluido en propuesta original**

Se implementó un sistema para clasificar y dar seguimiento al estado de los proyectos:

- Marcado visual de proyectos como "En Progreso" o "Completado"
- Filtrado de proyectos por estado
- Historial de cambios de estado

**Valor agregado:** Mayor visibilidad del portafolio de proyectos y su ciclo de vida.

---

### 2.3 Módulo de Control de Viáticos

**No incluido en propuesta original**

Se desarrolló un módulo completo para el registro y control de gastos de viáticos:

- Registro de viáticos asociados a cada proyecto
- Cálculo automático de totales
- Integración con presupuesto del proyecto
- Exportación de reportes de viáticos

**Valor agregado:** Control detallado de gastos operativos por proyecto, facilitando la rendición de cuentas.

---

### 2.4 Control de Costos Indirectos

**No incluido en propuesta original**

Se agregó la capacidad de registrar y visualizar costos indirectos:

- Registro de gastos indirectos por proyecto
- Cálculo de porcentajes sobre el total
- Integración en reportes financieros

**Valor agregado:** Visión más completa de los costos reales de cada proyecto.

---

### 2.5 Aplicación de Escritorio

**No incluido en propuesta original**

Se creó una versión instalable del sistema para Windows:

- Instalador ejecutable para distribución
- Acceso directo desde el escritorio
- Funcionamiento sin necesidad de navegador web
- Mismas funcionalidades que la versión web

**Valor agregado:** Mayor comodidad para usuarios frecuentes y acceso más directo al sistema.

---

## 3. Resumen Comparativo

### Alcance Original vs Implementado

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROPUESTA ORIGINAL                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ • Gestión de proyectos (CRUD)                             │  │
│  │ • Roles de usuario y permisos                             │  │
│  │ • Reportes Excel/CSV                                      │  │
│  │ • Importación de datos                                    │  │
│  │ • Autenticación segura                                    │  │
│  │ • Acceso web multiusuario                                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                         100% CUMPLIDO                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              FUNCIONALIDADES ADICIONALES                        │
│           (Valor agregado - Sin costo extra)                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ • Panel Ejecutivo                                         │  │
│  │ • Panel de Presupuestos                                   │  │
│  │ • Panel de Proyectos                                      │  │
│  │ • Panel de Materiales                                     │  │
│  │ • Panel de Cobranza                                       │  │
│  │ • Control de Viáticos                                     │  │
│  │ • Control de Costos Indirectos                            │  │
│  │ • Estados de Proyecto                                     │  │
│  │ • Aplicación de Escritorio                                │  │
│  └───────────────────────────────────────────────────────────┘  │
│                    ENTREGADO COMO EXTRA                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Tabla de Entregables del Período

| # | Entregable | Alcance Original | Estado |
|---|------------|------------------|--------|
| 1 | Control de Viáticos |  No incluido | Implementado |
| 2 | Panel Ejecutivo |  No incluido | Implementado |
| 3 | Panel de Presupuestos |  No incluido | Implementado |
| 4 | Panel de Proyectos |  No incluido | Implementado |
| 5 | Panel de Materiales |  No incluido | Implementado |
| 6 | Panel de Cobranza |  No incluido | Implementado |
| 7 | Costos Indirectos |  No incluido | Implementado |
| 8 | Estados de Proyecto |  No incluido | Implementado |
| 9 | Aplicación de Escritorio |  No incluido | Implementado |

---

## 5. Beneficios Obtenidos

### Del Alcance Original
- Sistema centralizado funcionando
- Múltiples usuarios trabajando simultáneamente
- Control financiero de proyectos
- Reportes automatizados

### De las Funcionalidades Adicionales
-  Toma de decisiones basada en datos visuales
-  Control de gastos operativos detallado
-  Mejor seguimiento de cobranza
-  Mayor comodidad de acceso para usuarios

---

## 6. Conclusiones

1. **El alcance original de la propuesta se cumplió al 100%**, incluyendo todas las funcionalidades de gestión de proyectos, roles, reportes y acceso multiusuario.

2. **Se entregaron 9 funcionalidades adicionales** no contempladas en la propuesta original, que representan valor agregado significativo para la operación del negocio.

3. Las funcionalidades adicionales fueron desarrolladas en respuesta a necesidades identificadas durante la operación del sistema, demostrando **adaptabilidad y compromiso** con los objetivos del negocio.

4. El sistema continúa siendo **escalable** y permite agregar más funcionalidades según las necesidades futuras de la organización.

---

## 7. Próximos Pasos Recomendados

1. Capacitación a usuarios en uso de los nuevos paneles de control
2. Definición de indicadores clave (KPIs) adicionales según necesidades
3. Evaluación de alertas automáticas por correo electrónico
4. Revisión periódica de nuevos requerimientos

---

*Documento elaborado el 16 de Enero de 2026*

*Desarrollador: Eder Jezrael Cantero Moreno*
