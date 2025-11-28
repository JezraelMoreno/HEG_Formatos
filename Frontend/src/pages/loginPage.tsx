import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LoginForm } from "../components/loginform";
import { getToken, isTokenValid } from "../auth";


export function LoginPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const token = getToken();
    if (isTokenValid(token)) {
      navigate("/home");
    }
  }, [navigate]);

  return <LoginForm />;
}
