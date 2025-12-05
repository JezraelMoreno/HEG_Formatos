import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/loginPage";
import { MainPage } from "./pages/mainPage";
import { ProyectoDetalle } from "./pages/proyectoDetalle";
import { PedidoPreview } from "./pages/pedidoPreview";
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
      {/* Redirige cualquier ruta no existente al login */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
