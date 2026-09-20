// Voir https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Ignorer les dossiers de build Android et les caches temporaires pour éviter les erreurs de watcher sous Windows
config.resolver.blockList = [
  /android[/\\]build[/\\]/,
  /android[/\\]app[/\\]build[/\\]/,
  /android[/\\]\.gradle[/\\]/,
  /\.expo-[^/\\]+[/\\]/,
];

module.exports = withNativeWind(config, { input: "./src/global.css" });

