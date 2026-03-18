import { useNavigate } from "react-router-dom";
import "./BackButton.css";

interface BackButtonProps {
  onClick?: () => void;
}

export function BackButton({ onClick }: BackButtonProps = {}) {
  const navigate = useNavigate();
  return (
    <button className="back-button" onClick={onClick ?? (() => navigate("/home"))}>
      ← Regresar
    </button>
  );
}
