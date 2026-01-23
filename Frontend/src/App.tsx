import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/loginPage";
import { MainPage } from "./pages/mainPage";
import { ProyectoDetalle } from "./pages/proyectoDetalle";
import { PedidoPreview } from "./pages/pedidoPreview";
import { ProjectSelector } from "./pages/dashboards/ProjectSelector";
import { DashboardEjecutivo } from "./pages/dashboards/DashboardEjecutivo";
import { DashboardPresupuestos } from "./pages/dashboards/DashboardPresupuestos";
import { DashboardGeneral } from "./pages/dashboards/DashboardGeneral";
import { DashboardMateriales } from "./pages/dashboards/DashboardMateriales";
import { DashboardCobranza } from "./pages/dashboards/DashboardCobranza";
import { PrivateRoute } from "./components/PrivateRoute";

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route
        path="/home"
        element={
          <PrivateRoute>
            <MainPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/proyecto/:id"
        element={
          <PrivateRoute>
            <ProyectoDetalle />
          </PrivateRoute>
        }
      />
      <Route
        path="/proyecto/:id/pedido/:pedidoId/vista-previa"
        element={
          <PrivateRoute>
            <PedidoPreview />
          </PrivateRoute>
        }
      />
      <Route
        path="/dashboards"
        element={
          <PrivateRoute>
            <ProjectSelector />
          </PrivateRoute>
        }
      />
      <Route
        path="/dashboards/:projectId/ejecutivo"
        element={
          <PrivateRoute>
            <DashboardEjecutivo />
          </PrivateRoute>
        }
      />
      <Route
        path="/dashboards/:projectId/presupuestos"
        element={
          <PrivateRoute>
            <DashboardPresupuestos />
          </PrivateRoute>
        }
      />
      <Route
        path="/dashboards/:projectId/general"
        element={
          <PrivateRoute>
            <DashboardGeneral />
          </PrivateRoute>
        }
      />
      <Route
        path="/dashboards/:projectId/materiales"
        element={
          <PrivateRoute>
            <DashboardMateriales />
          </PrivateRoute>
        }
      />
      <Route
        path="/dashboards/:projectId/cobranza"
        element={
          <PrivateRoute>
            <DashboardCobranza />
          </PrivateRoute>
        }
      />
      {/* Redirige cualquier ruta no existente al login */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
