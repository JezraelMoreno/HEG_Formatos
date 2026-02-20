import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ASSETS_DIR = path.join(__dirname, "..", "assets");

export function addLogoToWorksheet(wb, ws) {
  try {
    const logoPath = path.join(ASSETS_DIR, "heg_logo.jpg");
    const imgId = wb.addImage({ filename: logoPath, extension: "jpeg" });
    ws.addImage(imgId, {
      tl: { col: 0, row: 0 },
      ext: { width: 120, height: 40 },
    });
  } catch (_) {
    // logo no encontrado, continuar sin el
  }
}

export const currencyFmt = '#,##0.00;[Red]-#,##0.00';

export const headerFill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1F4E79" },
};

export const headerFont = {
  bold: true,
  color: { argb: "FFFFFFFF" },
  size: 11,
};

export const borderThin = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
};

export function applyHeaderStyle(row) {
  row.eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.border = borderThin;
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });
}

export function sendWorkbook(res, wb, filename) {
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return wb.xlsx.write(res).then(() => res.end());
}
