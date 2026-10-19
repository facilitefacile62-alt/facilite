// Voir https://docs.expo.dev/guides/customizing-metro
const path = require("path");
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

// « theme-jsx » : fabrique d'éléments de l'application (mode sombre), voir src/theme-jsx.
config.resolver.extraNodeModules = { ...(config.resolver.extraNodeModules || {}), "theme-jsx": path.resolve(__dirname, "src/theme-jsx") };

module.exports = withNativeWind(config, { input: "./src/global.css" });

