import { useEffect, type ReactNode } from "react";
import "./Modal.css";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "xl";
};

export function Modal({ isOpen, onClose, title, children, footer, size = "md" }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="hf-modal-overlay" onClick={onClose}>
      <div
        className={`hf-modal hf-modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="hf-modal-header">
            <h3>{title}</h3>
            <button type="button" className="hf-modal-close" onClick={onClose} aria-label="Cerrar">
              ×
            </button>
          </div>
        )}
        <div className="hf-modal-body">{children}</div>
        {footer && <div className="hf-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
