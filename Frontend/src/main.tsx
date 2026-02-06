import React from "react";
import ReactDOM from "react-dom/client";
import "./global.css";
import App from "./App.tsx";
import { HashRouter } from "react-router-dom";

// HashRouter es necesario para Electron ya que BrowserRouter
// no funciona con el protocolo file://
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
