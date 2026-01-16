import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/loginPage";
import { MainPage } from "./pages/mainPage";
import { ProyectoDetalle } from "./pages/proyectoDetalle";
import { PedidoPreview } from "./pages/pedidoPreview";
import { DashboardEjecutivo } from "./pages/dashboards/DashboardEjecutivo";
import { DashboardPresupuestos } from "./pages/dashboards/DashboardPresupuestos";
import { DashboardProyectos } from "./pages/dashboards/DashboardProyectos";
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
        path="/dashboards/ejecutivo"
        element={
          <PrivateRoute>
            <DashboardEjecutivo />
          </PrivateRoute>
        }
      />
      <Route
        path="/dashboards/presupuestos"
        element={
          <PrivateRoute>
            <DashboardPresupuestos />
          </PrivateRoute>
        }
      />
      <Route
        path="/dashboards/proyectos"
        element={
          <PrivateRoute>
            <DashboardProyectos />
          </PrivateRoute>
        }
      />
      <Route
        path="/dashboards/materiales"
        element={
          <PrivateRoute>
            <DashboardMateriales />
          </PrivateRoute>
        }
      />
      <Route
        path="/dashboards/cobranza"
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
