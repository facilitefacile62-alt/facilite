/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["unpdf", "mammoth", "tesseract.js", "@napi-rs/canvas", "canvas"],
};

export default nextConfig;
