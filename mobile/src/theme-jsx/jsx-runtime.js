// Fabrique d'éléments de l'application (jsxImportSource, voir babel.config.js) : celle de NativeWind, précédée, en mode
// sombre seulement, de la substitution des couleurs claires (src/components/themeSombre.ts). En mode clair, les
// propriétés passent telles quelles : aucun coût, aucun changement.
const base = require('react-native-css-interop/jsx-runtime');
const { estSombre, propsSombres } = require('../components/themeSombre');

const envelopper = (fabrique) => (type, props, ...reste) => fabrique(type, estSombre() ? propsSombres(props) : props, ...reste);

exports.Fragment = base.Fragment;
exports.jsx = envelopper(base.jsx);
exports.jsxs = envelopper(base.jsxs);
