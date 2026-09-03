import { Routes, Route, Navigate } from "react-router-dom";
import { UpdateBanner } from "./components/UpdateBanner";
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
import { DashboardProyectos } from "./pages/dashboards/DashboardProyectos";
import { ReportesProjectSelector } from "./pages/reportes/ReportesProjectSelector";
import { ReportePage } from "./pages/reportes/ReportePage";
import { RemisionesProjectSelector } from "./pages/remisiones/RemisionesProjectSelector";
import { RemisionesPage } from "./pages/remisiones/RemisionesPage";
import { ContabilidadPage } from "./pages/contabilidad/ContabilidadPage";
import { PrivateRoute } from "./components/PrivateRoute";

function App() {
  return (
    <>
      <UpdateBanner />
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
      <Route
        path="/dashboards/proyectos"
        element={
          <PrivateRoute allowedRoles={["Superadmin"]}>
            <DashboardProyectos />
          </PrivateRoute>
        }
      />
      <Route
        path="/reportes"
        element={
          <PrivateRoute>
            <ReportesProjectSelector />
          </PrivateRoute>
        }
      />
      <Route
        path="/reportes/:projectId"
        element={
          <PrivateRoute>
            <ReportePage />
          </PrivateRoute>
        }
      />
      {/* Rutas de Remisiones */}
      <Route
        path="/remisiones"
        element={
          <PrivateRoute>
            <RemisionesProjectSelector />
          </PrivateRoute>
        }
      />
      <Route
        path="/remisiones/general"
        element={
          <PrivateRoute>
            <RemisionesPage isGeneral={true} />
          </PrivateRoute>
        }
      />
      <Route
        path="/remisiones/:projectId"
        element={
          <PrivateRoute>
            <RemisionesPage />
          </PrivateRoute>
        }
      />
      {/* Rutas de Contabilidad */}
      <Route
        path="/contabilidad/:projectId"
        element={
          <PrivateRoute>
            <ContabilidadPage />
          </PrivateRoute>
        }
      />
      {/* Redirige cualquier ruta no existente al login */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
    </>
  );
}

export default App;
