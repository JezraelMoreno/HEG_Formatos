import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LoginForm } from "../components/loginform";

export function LoginPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const usuario = localStorage.getItem("usuario");
    if (usuario) {
      navigate("/home");
    }
  }, [navigate]);

  return <LoginForm />;
}
