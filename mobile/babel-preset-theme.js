// Équivalent du preset « nativewind/babel » (react-native-css-interop/babel), avec UNE différence : la fabrique
// d'éléments (jsx) est celle de l'application — src/theme-jsx, qui enveloppe celle de NativeWind pour appliquer le mode
// sombre — au lieu de celle de react-native-css-interop.
module.exports = function () {
  return {
    plugins: [
      require("react-native-css-interop/dist/babel-plugin").default,
      [
        "@babel/plugin-transform-react-jsx",
        {
          runtime: "automatic",
          importSource: "theme-jsx",
        },
      ],
      // À utiliser avec reanimated 4 et plus (comme dans le preset d'origine)
      "react-native-worklets/plugin",
    ],
  };
};
