const ExcelJS = require('exceljs');

async function createReport() {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Reporte de Avances');

    // Definir columnas
    sheet.columns = [
        { header: 'No.', key: 'no', width: 6 },
        { header: 'Concepto', key: 'concepto', width: 55 },
        { header: 'Alcance', key: 'alcance', width: 14 },
        { header: 'Semana', key: 'semana', width: 28 },
        { header: 'Estatus', key: 'estatus', width: 14 }
    ];

    // Estilo del encabezado
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2E7D32' }
    };
    sheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 22;

    // Datos del alcance original basados en commits reales
    const datosOriginales = [
        { no: 1, concepto: 'Diseño de la estructura de información del sistema', alcance: 'Original', semana: '15 - 17 Oct 2025', estatus: 'Completado' },
        { no: 2, concepto: 'Inicio de sesión con usuario y contraseña', alcance: 'Original', semana: '22 Oct 2025', estatus: 'Completado' },
        { no: 3, concepto: 'Seguridad de acceso al sistema', alcance: 'Original', semana: '22 Oct 2025', estatus: 'Completado' },
        { no: 4, concepto: 'Pantalla para crear y editar proyectos', alcance: 'Original', semana: '23 Oct 2025', estatus: 'Completado' },
        { no: 5, concepto: 'Filtros por tipo de material y exportación a Excel', alcance: 'Original', semana: '24 Oct 2025', estatus: 'Completado' },
        { no: 6, concepto: 'Generación de reportes con filtros', alcance: 'Original', semana: '31 Oct 2025', estatus: 'Completado' },
        { no: 7, concepto: 'Diferentes tipos de usuario (permisos)', alcance: 'Original', semana: '31 Oct 2025', estatus: 'Completado' },
        { no: 8, concepto: 'Selección múltiple en filtros', alcance: 'Original', semana: '07 Nov 2025', estatus: 'Completado' },
        { no: 9, concepto: 'Cálculo de totales en reportes Excel', alcance: 'Original', semana: '07 Nov 2025', estatus: 'Completado' },
        { no: 10, concepto: 'Carga masiva de archivos y eliminación de proyectos', alcance: 'Original', semana: '10 Nov 2025', estatus: 'Completado' },
        { no: 11, concepto: 'Detalles de pedidos dentro de cada proyecto', alcance: 'Original', semana: '13 Nov 2025', estatus: 'Completado' },
        { no: 12, concepto: 'Importación de datos desde archivos CSV', alcance: 'Original', semana: '13 - 14 Nov 2025', estatus: 'Completado' },
        { no: 13, concepto: 'Soporte para proyectos de aluminio', alcance: 'Original', semana: '15 Nov 2025', estatus: 'Completado' },
        { no: 14, concepto: 'Cálculo de IVA, maquilas y casos especiales', alcance: 'Original', semana: '21 Nov 2025', estatus: 'Completado' },
        { no: 15, concepto: 'Validación de archivos importados', alcance: 'Original', semana: '24 Nov 2025', estatus: 'Completado' },
        { no: 16, concepto: 'Visualización de presupuesto disponible', alcance: 'Original', semana: '24 Nov 2025', estatus: 'Completado' },
        { no: 17, concepto: 'Ordenar pedidos por fecha', alcance: 'Original', semana: '26 Nov 2025', estatus: 'Completado' },
        { no: 18, concepto: 'Diseño visual y logo de la empresa', alcance: 'Original', semana: '28 Nov 2025', estatus: 'Completado' },
        { no: 19, concepto: 'Control de acceso a secciones del sistema', alcance: 'Original', semana: '28 Nov 2025', estatus: 'Completado' },
        { no: 20, concepto: 'Administración de presupuestos por proyecto', alcance: 'Original', semana: '04 Dic 2025', estatus: 'Completado' },
        { no: 21, concepto: 'Mejoras de rendimiento del sistema', alcance: 'Original', semana: '05 Dic 2025', estatus: 'Completado' },
        { no: 22, concepto: 'Desglose de presupuesto por insumos', alcance: 'Original', semana: '05 Dic 2025', estatus: 'Completado' },
    ];

    // Separador
    const separador = { no: '', concepto: '─── FUNCIONALIDADES ADICIONALES (15 Dic 2025 - 16 Ene 2026) ───', alcance: '', semana: '', estatus: '' };

    // Datos adicionales basados en Cronograma_Desarrollo_Dic2025-Ene2026.md (desglosado cada 3 días)
    const datosExtra = [
        // Semana 1: Viáticos (15-21 Dic)
        { no: 23, concepto: 'Análisis de requerimientos para viáticos', alcance: 'Extra', semana: '15 - 17 Dic 2025', estatus: 'Completado' },
        { no: 24, concepto: 'Registro de viáticos por proyecto', alcance: 'Extra', semana: '17 - 19 Dic 2025', estatus: 'Completado' },
        { no: 25, concepto: 'Exportación de viáticos a Excel', alcance: 'Extra', semana: '19 - 21 Dic 2025', estatus: 'Completado' },
        // Semana 2: Planificación (22-28 Dic)
        { no: 26, concepto: 'Planificación de paneles de control', alcance: 'Extra', semana: '23 - 27 Dic 2025', estatus: 'Completado' },
        // Semana 3: Dashboards (29 Dic - 4 Ene)
        { no: 27, concepto: 'Diseño de gráficas y visualizaciones', alcance: 'Extra', semana: '29 - 31 Dic 2025', estatus: 'Completado' },
        { no: 28, concepto: 'Panel con indicadores generales del negocio', alcance: 'Extra', semana: '31 Dic - 02 Ene 2026', estatus: 'Completado' },
        { no: 29, concepto: 'Panel de seguimiento de presupuestos', alcance: 'Extra', semana: '02 - 03 Ene 2026', estatus: 'Completado' },
        { no: 30, concepto: 'Panel de seguimiento de proyectos', alcance: 'Extra', semana: '03 - 04 Ene 2026', estatus: 'Completado' },
        { no: 31, concepto: 'Panel de control de materiales', alcance: 'Extra', semana: '04 Ene 2026', estatus: 'Completado' },
        { no: 32, concepto: 'Marcar proyectos como "En progreso" o "Completado"', alcance: 'Extra', semana: '04 Ene 2026', estatus: 'Completado' },
        // Semana 4: Cobranza (5-11 Ene)
        { no: 33, concepto: 'Correcciones a paneles de presupuestos', alcance: 'Extra', semana: '06 - 07 Ene 2026', estatus: 'Completado' },
        { no: 34, concepto: 'Análisis de datos de cobranza', alcance: 'Extra', semana: '07 - 08 Ene 2026', estatus: 'Completado' },
        { no: 35, concepto: 'Panel de seguimiento de cobranza a clientes', alcance: 'Extra', semana: '08 - 09 Ene 2026', estatus: 'Completado' },
        { no: 36, concepto: 'Pruebas de todos los paneles de control', alcance: 'Extra', semana: '10 - 11 Ene 2026', estatus: 'Completado' },
        // Semana 5: Costos indirectos y App (12-16 Ene)
        { no: 37, concepto: 'Registro de costos indirectos por proyecto', alcance: 'Extra', semana: '12 Ene 2026', estatus: 'Completado' },
        { no: 38, concepto: 'Planificación de aplicación de escritorio', alcance: 'Extra', semana: '13 Ene 2026', estatus: 'Completado' },
        { no: 39, concepto: 'Configuración de instalador para Windows', alcance: 'Extra', semana: '14 - 15 Ene 2026', estatus: 'Completado' },
        { no: 40, concepto: 'Programa instalable para Windows (sin navegador)', alcance: 'Extra', semana: '15 - 16 Ene 2026', estatus: 'Completado' },
        { no: 41, concepto: 'Pruebas finales y generación de instalador', alcance: 'Extra', semana: '16 Ene 2026', estatus: 'Completado' },
    ];

    // Agregar datos
    datosOriginales.forEach(row => sheet.addRow(row));
    sheet.addRow(separador);
    datosExtra.forEach(row => sheet.addRow(row));

    const totalRows = datosOriginales.length + 1 + datosExtra.length + 1;

    // Estilo para filas de datos originales
    for (let i = 2; i <= datosOriginales.length + 1; i++) {
        sheet.getRow(i).getCell('alcance').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE8F5E9' }
        };
        sheet.getRow(i).getCell('estatus').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFC8E6C9' }
        };
        sheet.getRow(i).getCell('estatus').font = { color: { argb: 'FF1B5E20' } };
    }

    // Estilo para fila separadora
    const sepRowNum = datosOriginales.length + 2;
    const sepRow = sheet.getRow(sepRowNum);
    sepRow.font = { bold: true, color: { argb: 'FF1565C0' } };
    sepRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE3F2FD' }
    };
    sepRow.alignment = { horizontal: 'center' };
    sheet.mergeCells(`A${sepRowNum}:E${sepRowNum}`);

    // Estilo para filas extra
    for (let i = sepRowNum + 1; i <= totalRows; i++) {
        sheet.getRow(i).getCell('alcance').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFF3E0' }
        };
        sheet.getRow(i).getCell('alcance').font = { color: { argb: 'FFE65100' }, bold: true };
        sheet.getRow(i).getCell('estatus').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFC8E6C9' }
        };
        sheet.getRow(i).getCell('estatus').font = { color: { argb: 'FF1B5E20' } };
    }

    // Bordes para todas las celdas
    for (let i = 1; i <= totalRows; i++) {
        for (let j = 1; j <= 5; j++) {
            sheet.getRow(i).getCell(j).border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        }
    }

    // Centrar columnas
    sheet.getColumn('no').alignment = { horizontal: 'center' };
    sheet.getColumn('alcance').alignment = { horizontal: 'center' };
    sheet.getColumn('semana').alignment = { horizontal: 'center' };
    sheet.getColumn('estatus').alignment = { horizontal: 'center' };

    await workbook.xlsx.writeFile('Documentacion/Reporte_Alcances_HEG.xlsx');
    console.log('Excel creado exitosamente');
}

createReport();
