const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const failures = [];
const warnings = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function check(condition, message, level = "error") {
  if (condition) return;
  if (level === "warn") warnings.push(message);
  else failures.push(message);
}

const requiredFiles = [
  "lib/firebase.ts",
  "lib/authIdentity.ts",
  "lib/bootstrapPolicy.ts",
  "storage.rules",
  "firestore.rules",
  "components/TenantAccessGate.tsx",
  "components/ProductionReadinessPanel.tsx",
  "app/(tabs)/developer.tsx",
];

for (const file of requiredFiles) {
  check(exists(file), `Missing required file: ${file}`);
}

const firebase = exists("lib/firebase.ts") ? read("lib/firebase.ts") : "";
check(firebase.includes("getAuth"), "Firebase Auth is not exported from lib/firebase.ts");
check(firebase.includes("firebaseConfigDiagnostics"), "Firebase config diagnostics are missing");
check(firebase.includes("getStorage"), "Firebase Storage is not exported");

const gate = exists("components/TenantAccessGate.tsx") ? read("components/TenantAccessGate.tsx") : "";
check(gate.includes("EMPLOYEE_LOAD_TIMEOUT_MS"), "Tenant access gate can hang without employee load timeout");
check(gate.includes("isLocalBootstrap"), "Tenant access gate does not mark local bootstrap users", "warn");
check(gate.includes("pinCode"), "Tenant access gate does not support employee PIN login");

const developer = exists("app/(tabs)/developer.tsx") ? read("app/(tabs)/developer.tsx") : "";
check(developer.includes("canAccessDeveloperDashboard"), "Developer dashboard content is not guarded");
check(developer.includes("ProductionReadinessPanel"), "Developer dashboard does not show production readiness panel");

const firestoreRules = exists("firestore.rules") ? read("firestore.rules") : "";
check(firestoreRules.includes("request.auth"), "Firestore rules do not require authentication");
check(firestoreRules.includes("companyId"), "Firestore rules do not enforce companyId isolation");
check(firestoreRules.includes("auditLogs"), "Firestore rules do not include auditLogs");

const storageRules = exists("storage.rules") ? read("storage.rules") : "";
check(storageRules.includes("contracts/{companyId}"), "Storage rules do not protect contracts by companyId");
check(storageRules.includes("product-images/{companyId}"), "Storage rules do not protect product images by companyId");
check(storageRules.includes("request.auth"), "Storage rules do not require authentication");

const employeeContext = exists("context/EmployeeContext.tsx") ? read("context/EmployeeContext.tsx") : "";
check(employeeContext.includes("username"), "Employee type does not officially include username", "warn");
check(employeeContext.includes("pinCode"), "Employee type does not officially include pinCode", "warn");
check(employeeContext.includes("lastLoginAt"), "Employee type does not track lastLoginAt", "warn");

const tabLayout = exists("app/(tabs)/_layout.tsx") ? read("app/(tabs)/_layout.tsx") : "";
check(!tabLayout.includes('{ name: "developer"') || tabLayout.includes("canAccessDeveloperDashboard"), "Developer tab is visible in More menu without navigation-level permission filtering", "warn");

console.log("\nFawtara Project Audit");
console.log("=====================");

if (warnings.length) {
  console.log("\nWarnings:");
  for (const warning of warnings) console.log(`- ${warning}`);
}

if (failures.length) {
  console.error("\nFailures:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("\nAudit passed with", warnings.length, "warning(s).");
