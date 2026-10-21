module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "theme-jsx" }], require("./babel-preset-theme")],
  };
};
