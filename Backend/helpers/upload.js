import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Crea una instancia de multer configurada para un subdirectorio específico.
 * @param {object} opts
 * @param {string} opts.subdir - Subcarpeta dentro de /uploads (ej: 'remisiones', 'facturas')
 * @param {string[]} opts.allowedExts - Extensiones permitidas (ej: ['.pdf', '.xml'])
 * @param {number} [opts.maxSizeMB=20] - Tamaño máximo en MB
 */
export function createUploader({ subdir, allowedExts, maxSizeMB = 20 }) {
  const dest = path.join(__dirname, "..", "uploads", subdir);
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dest),
    filename: (req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
      cb(null, `${Date.now()}_${safeName}`);
    },
  });

  const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no permitido. Solo: ${allowedExts.join(", ")}`), false);
    }
  };

  return multer({
    storage,
    fileFilter,
    limits: { fileSize: maxSizeMB * 1024 * 1024 },
  });
}
