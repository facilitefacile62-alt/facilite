const fs = require('fs');
const { execSync } = require('child_process');

try {
  const sharp = require('sharp');
  const path = require('path');

  // Input is now PWA.png in the project root
  const inputPath = path.join(__dirname, 'PWA.png');
  const icon192 = path.join(__dirname, 'public', 'icon-192x192.png');
  const icon512 = path.join(__dirname, 'public', 'icon-512x512.png');

  if (!fs.existsSync(inputPath)) {
    console.error("File not found at", inputPath);
    process.exit(1);
  }

  // Create 192x192
  sharp(inputPath)
    .resize(192, 192, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .toFormat('png')
    .toFile(icon192)
    .then(() => console.log('Created public/icon-192x192.png'))
    .catch(err => console.error(err));

  // Create 512x512
  sharp(inputPath)
    .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .toFormat('png')
    .toFile(icon512)
    .then(() => console.log('Created public/icon-512x512.png'))
    .catch(err => console.error(err));
    
} catch (error) {
  console.error("Script failed:", error);
}
