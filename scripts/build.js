const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, "static-build");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      NODE_ENV: "production",
    },
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

if (fs.existsSync(outputDir)) {
  fs.rmSync(outputDir, { recursive: true, force: true });
}

console.log("Building production Expo web export...");
run("pnpm", ["exec", "expo", "export", "--platform", "web", "--output-dir", "static-build"]);

// Fix: Cloudflare Pages fails to serve font files whose paths contain @ and +
// (pnpm symlink paths like /assets/node_modules/.pnpm/@expo+vector-icons@...).
// Copy all icon fonts to /fonts/<Name>.ttf and patch every JS bundle that
// references the old URL so the browser loads from the clean path instead.
const fontsDir = path.join(outputDir, "fonts");
fs.mkdirSync(fontsDir, { recursive: true });

// Discover every TTF file that Expo exported into assets/
const assetsDir = path.join(outputDir, "assets");
const urlReplacements = []; // [{ oldUrl, newUrl }]

function findTtfFiles(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findTtfFiles(fullPath);
    } else if (entry.isFile() && entry.name.endsWith(".ttf")) {
      const fontName = path.basename(entry.name, ".ttf");
      const destName = `${fontName}.ttf`;
      fs.copyFileSync(fullPath, path.join(fontsDir, destName));
      // The URL that Expo baked into the JS bundle is relative to outputDir
      const relOld = "/" + path.relative(outputDir, fullPath).replace(/\\/g, "/");
      urlReplacements.push({ oldUrl: relOld, newUrl: `/fonts/${destName}` });
      console.log(`  Font: ${relOld} → /fonts/${destName}`);
    }
  }
}

console.log("Copying icon fonts to /fonts/ and collecting URL replacements...");
findTtfFiles(assetsDir);

// Also copy fonts directly from the source package in case Expo didn't export them
const vendorFontsDir = path.join(
  projectRoot,
  "node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts"
);
if (fs.existsSync(vendorFontsDir)) {
  for (const file of fs.readdirSync(vendorFontsDir)) {
    if (!file.endsWith(".ttf")) continue;
    const destPath = path.join(fontsDir, file);
    if (!fs.existsSync(destPath)) {
      fs.copyFileSync(path.join(vendorFontsDir, file), destPath);
      console.log(`  Font (vendor): /fonts/${file}`);
    }
  }
}

// Patch all JS bundles: replace old deep asset URLs with clean /fonts/ URLs
if (urlReplacements.length > 0) {
  console.log("Patching JS bundles with clean font URLs...");
  function patchJsFiles(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        patchJsFiles(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith(".js") || entry.name.endsWith(".map"))) {
        let content = fs.readFileSync(fullPath, "utf8");
        let changed = false;
        for (const { oldUrl, newUrl } of urlReplacements) {
          if (content.includes(oldUrl)) {
            content = content.split(oldUrl).join(newUrl);
            changed = true;
          }
        }
        if (changed) {
          fs.writeFileSync(fullPath, content, "utf8");
        }
      }
    }
  }
  patchJsFiles(outputDir);
  console.log("JS bundle patching complete.");
}

// Inject @font-face CSS into index.html as an additional safety net
const indexPath = path.join(outputDir, "index.html");
if (fs.existsSync(indexPath)) {
  const allFontNames = fs
    .readdirSync(fontsDir)
    .filter((f) => f.endsWith(".ttf"))
    .map((f) => path.basename(f, ".ttf"));

  const fontFaceRules = allFontNames
    .map(
      (name) =>
        `  @font-face { font-family: "${name}"; src: url("/fonts/${name}.ttf") format("truetype"); font-display: block; }`
    )
    .join("\n");

  let html = fs.readFileSync(indexPath, "utf8");
  html = html.replace("</head>", `<style>\n${fontFaceRules}\n</style>\n</head>`);
  fs.writeFileSync(indexPath, html, "utf8");
  console.log(`Injected @font-face CSS for ${allFontNames.length} fonts into index.html`);
}

// Copy Cloudflare Pages routing files into the output directory
for (const file of ["_redirects", "_headers"]) {
  const src = path.join(projectRoot, file);
  const dest = path.join(outputDir, file);
  if (fs.existsSync(src)) fs.copyFileSync(src, dest);
}

console.log("Build complete: static-build/");
