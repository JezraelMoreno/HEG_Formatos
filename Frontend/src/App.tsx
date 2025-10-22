import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "./pages/loginPage";
import { MainPage } from "./pages/mainPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/home" element={<MainPage />} />
      {/* Redirige cualquier ruta no existente al login */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
