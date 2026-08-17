import sharp from "sharp";
import fs from "fs";
import path from "path";

const LOGO_PATH = path.resolve("public/logo.jpeg");

if (!fs.existsSync(LOGO_PATH)) {
  console.error("Logo not found at", LOGO_PATH);
  process.exit(1);
}

// Construction d'un conteneur ICO standard contenant des images PNG au format RGBA 32-bit
function createIco(pngBuffers) {
  const numImages = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + dirEntrySize * numImages;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // ICO type (1 = Icon)
  header.writeUInt16LE(numImages, 4); // Number of images

  const entries = [];
  for (const img of pngBuffers) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(img.width >= 256 ? 0 : img.width, 0);
    entry.writeUInt8(img.height >= 256 ? 0 : img.height, 1);
    entry.writeUInt8(0, 2); // Color palette
    entry.writeUInt8(0, 3); // Reserved
    entry.writeUInt16LE(1, 4); // Color planes
    entry.writeUInt16LE(32, 6); // Bits per pixel (32 bit RGBA)
    entry.writeUInt32LE(img.data.length, 8); // Image data size
    entry.writeUInt32LE(offset, 12); // Offset of image data
    entries.push(entry);
    offset += img.data.length;
  }

  return Buffer.concat([header, ...entries, ...pngBuffers.map(b => b.data)]);
}

async function generateAllIcons() {
  console.log("Generating full favicon suite with RGBA channels from public/logo.jpeg...");

  const baseImage = sharp(LOGO_PATH).ensureAlpha();

  const png16 = await baseImage.clone().resize(16, 16, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } }).png({ compressionLevel: 9 }).toBuffer();
  const png32 = await baseImage.clone().resize(32, 32, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } }).png({ compressionLevel: 9 }).toBuffer();
  const png48 = await baseImage.clone().resize(48, 48, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } }).png({ compressionLevel: 9 }).toBuffer();
  const png180 = await baseImage.clone().resize(180, 180, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toBuffer();
  const png192 = await baseImage.clone().resize(192, 192, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toBuffer();
  const png512 = await baseImage.clone().resize(512, 512, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toBuffer();
  const jpeg512 = await baseImage.clone().resize(512, 512, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } }).jpeg({ quality: 95 }).toBuffer();

  const icoBuffer = createIco([
    { width: 48, height: 48, data: png48 },
    { width: 32, height: 32, data: png32 },
  ]);

  const targets = [
    { file: "public/favicon.ico", data: icoBuffer },
    { file: "public/favicon-16x16.png", data: png16 },
    { file: "public/favicon-32x32.png", data: png32 },
    { file: "public/favicon-48x48.png", data: png48 },
    { file: "public/apple-touch-icon.png", data: png180 },
    { file: "public/apple-icon.png", data: png180 },
    { file: "src/app/apple-icon.png", data: png180 },
    { file: "public/icon-192x192.png", data: png192 },
    { file: "public/icon-512x512.png", data: png512 },
    { file: "public/icon.png", data: png512 },
    { file: "src/app/icon.png", data: png512 },
    { file: "public/image.png", data: png512 },
    { file: "src/app/image.png", data: png512 },
    { file: "public/icon.jpeg", data: jpeg512 },
    { file: "src/app/icon.jpeg", data: jpeg512 },
  ];

  for (const t of targets) {
    const fullPath = path.resolve(t.file);
    fs.writeFileSync(fullPath, t.data);
    console.log(`✅ [Favicon] ${t.file} (${t.data.length} bytes)`);
  }

  // Si src/app/favicon.ico existe, Next.js App Router le compile avec Turbopack.
  // Pour éviter tout conflit de décodeur ICO interne dans Turbopack,
  // Next.js recommande soit de le placer dans public/favicon.ico soit d'utiliser une icône PNG 32x32 directe.
  fs.writeFileSync(path.resolve("src/app/favicon.ico"), png32);

  console.log("🚀 Favicon suite generation complete!");
}

generateAllIcons().catch(err => {
  console.error("Error generating icons:", err);
  process.exit(1);
});
