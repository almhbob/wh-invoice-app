module.exports = function (api) {
  api.cache(true);
  return {
    // Resolve Expo's declared preset dependency explicitly under pnpm's
    // non-hoisted layout instead of depending on accidental npm hoisting.
    presets: [[require.resolve("babel-preset-expo", { paths: [require.resolve("expo/package.json")] }), { unstable_transformImportMeta: true }]],
  };
};
