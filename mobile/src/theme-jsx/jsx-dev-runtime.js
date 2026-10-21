// Version « développement » de la fabrique d'éléments (voir jsx-runtime.js).
const base = require('react-native-css-interop/jsx-dev-runtime');
const { estSombre, propsSombres } = require('../components/themeSombre');

const envelopper = (fabrique) => (type, props, ...reste) => fabrique(type, estSombre() ? propsSombres(props) : props, ...reste);

exports.Fragment = base.Fragment;
exports.jsxDEV = envelopper(base.jsxDEV);
