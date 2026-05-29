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

// Copy Cloudflare Pages routing files into the output directory
for (const file of ["_redirects", "_headers"]) {
  const src = path.join(projectRoot, file);
  const dest = path.join(outputDir, file);
  if (fs.existsSync(src)) fs.copyFileSync(src, dest);
}

console.log("Build complete: static-build/");
