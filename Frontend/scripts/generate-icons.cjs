const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Función para crear ICO manualmente
async function createIco(pngBuffers, outputPath) {
  // ICO header: 6 bytes
  // Entry: 16 bytes each
  // Image data follows

  const numImages = pngBuffers.length;
  let headerSize = 6 + (numImages * 16);

  // Calcular offsets
  let offset = headerSize;
  const entries = [];

  for (let i = 0; i < pngBuffers.length; i++) {
    const size = [16, 32, 48, 64, 128, 256][i];
    entries.push({
      width: size === 256 ? 0 : size,
      height: size === 256 ? 0 : size,
      offset: offset,
      size: pngBuffers[i].length
    });
    offset += pngBuffers[i].length;
  }

  // Crear buffer ICO
  const totalSize = offset;
  const ico = Buffer.alloc(totalSize);

  // ICO Header
  ico.writeUInt16LE(0, 0);      // Reserved
  ico.writeUInt16LE(1, 2);      // Type: 1 = ICO
  ico.writeUInt16LE(numImages, 4); // Number of images

  // Entries
  for (let i = 0; i < entries.length; i++) {
    const entryOffset = 6 + (i * 16);
    ico.writeUInt8(entries[i].width, entryOffset);      // Width
    ico.writeUInt8(entries[i].height, entryOffset + 1); // Height
    ico.writeUInt8(0, entryOffset + 2);                 // Color palette
    ico.writeUInt8(0, entryOffset + 3);                 // Reserved
    ico.writeUInt16LE(1, entryOffset + 4);              // Color planes
    ico.writeUInt16LE(32, entryOffset + 6);             // Bits per pixel
    ico.writeUInt32LE(entries[i].size, entryOffset + 8);   // Size of image data
    ico.writeUInt32LE(entries[i].offset, entryOffset + 12); // Offset to image data
  }

  // Image data
  for (let i = 0; i < pngBuffers.length; i++) {
    pngBuffers[i].copy(ico, entries[i].offset);
  }

  fs.writeFileSync(outputPath, ico);
}

const inputImage = path.join(__dirname, '../../Backend/assets/heg_logo.jpg');
const outputDir = path.join(__dirname, '../public');

// Asegurar que el directorio public existe
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function generateIcons() {
  console.log('Generando iconos desde:', inputImage);

  try {
    // Leer la imagen original
    const image = sharp(inputImage);
    const metadata = await image.metadata();
    console.log('Imagen original:', metadata.width, 'x', metadata.height);

    // Crear PNG de 512x512 (tamaño base para todos los iconos)
    const png512Path = path.join(outputDir, 'icon-512.png');
    await sharp(inputImage)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 1 }
      })
      .png()
      .toFile(png512Path);
    console.log('Creado: icon-512.png');

    // Crear PNG de 256x256 para Linux
    const png256Path = path.join(outputDir, 'icon.png');
    await sharp(inputImage)
      .resize(256, 256, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 1 }
      })
      .png()
      .toFile(png256Path);
    console.log('Creado: icon.png (256x256)');

    // Crear múltiples tamaños para ICO de Windows
    const sizes = [16, 32, 48, 64, 128, 256];
    const pngBuffers = [];

    for (const size of sizes) {
      const buffer = await sharp(inputImage)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 1 }
        })
        .png()
        .toBuffer();
      pngBuffers.push(buffer);
    }

    // Crear ICO para Windows
    await createIco(pngBuffers, path.join(outputDir, 'icon.ico'));
    console.log('Creado: icon.ico');

    console.log('\nIconos generados exitosamente en:', outputDir);
    console.log('\nNota: Para macOS (icon.icns), necesitarás usar una herramienta como');
    console.log('iconutil en Mac o un servicio online de conversión.');

  } catch (error) {
    console.error('Error generando iconos:', error);
    process.exit(1);
  }
}

generateIcons();
