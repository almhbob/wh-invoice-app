const path = require("node:path");

// Local emulators only. CLI 15's Storage -> Firestore rules bridge asks its
// control-plane client for credentials even for a demo project. Firebase
// emulators accept the fixed "owner" bypass token for that service-to-service
// document lookup; app requests in security.test.mjs still use employee tokens.
// Do not use this launcher for deployment, provisioning, or a real project.
const project = "demo-tenant-security";
const cli = require.resolve("firebase-tools/lib/bin/firebase");
process.env.JAVA_TOOL_OPTIONS ||= "-Xmx384m";
process.env.NODE_OPTIONS ||= "--max-old-space-size=256";
require("firebase-tools/lib/apiv2").setAccessToken("owner");
process.argv = [
  process.execPath, cli, "emulators:exec", "--project", project,
  "--config", path.resolve(__dirname, "../../firebase.emulator.json"),
  "--only", "firestore,storage",
  `${JSON.stringify(process.execPath)} --test --test-reporter=tap --test-timeout=300000 ${JSON.stringify(path.resolve(__dirname, "security.test.mjs"))}`,
];
require(cli);
