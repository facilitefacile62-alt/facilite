import sharp from "sharp";
import fs from "fs";
import path from "path";

const LOGO_PATH = path.resolve("public/logo.jpeg");

if (!fs.existsSync(LOGO_PATH)) {
  console.error("Logo not found at", LOGO_PATH);
  process.exit(1);
}

async function generateAllIcons() {
  console.log("Generating favicons and icons from public/logo.jpeg...");

  const baseImage = sharp(LOGO_PATH);

  // 1. 512x512 PNG
  const buf512 = await baseImage.clone().resize(512, 512, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toBuffer();
  // 2. 192x192 PNG
  const buf192 = await baseImage.clone().resize(192, 192, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toBuffer();
  // 3. 180x180 Apple Icon PNG
  const buf180 = await baseImage.clone().resize(180, 180, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toBuffer();
  // 4. 48x48 / 32x32 Favicon PNG/ICO
  const buf48 = await baseImage.clone().resize(48, 48, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toBuffer();
  const buf32 = await baseImage.clone().resize(32, 32, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } }).png().toBuffer();
  // 5. 512x512 JPEG
  const bufJpeg = await baseImage.clone().resize(512, 512, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } }).jpeg({ quality: 95 }).toBuffer();

  const targets = [
    { file: "public/icon-512x512.png", data: buf512 },
    { file: "public/icon.png", data: buf512 },
    { file: "src/app/icon.png", data: buf512 },
    { file: "public/image.png", data: buf512 },
    { file: "src/app/image.png", data: buf512 },

    { file: "public/icon-192x192.png", data: buf192 },
    { file: "public/apple-icon.png", data: buf180 },
    { file: "src/app/apple-icon.png", data: buf180 },
    { file: "public/apple-touch-icon.png", data: buf180 },

    { file: "public/favicon.ico", data: buf48 },
    { file: "src/app/favicon.ico", data: buf48 },

    { file: "public/icon.jpeg", data: bufJpeg },
    { file: "src/app/icon.jpeg", data: bufJpeg },
  ];

  for (const t of targets) {
    const fullPath = path.resolve(t.file);
    fs.writeFileSync(fullPath, t.data);
    console.log(`✅ Generated: ${t.file} (${t.data.length} bytes)`);
  }

  console.log("All icons and favicons successfully updated with the official Facilité logo!");
}

generateAllIcons().catch(err => {
  console.error("Error generating icons:", err);
  process.exit(1);
});
