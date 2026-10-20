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
  "context/TenantAuthContext.tsx",
  "lib/tenantIdentity.ts",
  "tools/security/security.test.mjs",
  "lib/bootstrapPolicy.ts",
  "lib/employeeCredentials.ts",
  "storage.rules",
  "firestore.rules",
  "components/TenantAccessGate.tsx",
  "components/EmployeeSelectorModal.tsx",
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
check(gate.includes("useTenantAuth"), "Tenant access gate is not backed by verified Firebase identity");
check(!gate.includes("isLocalBootstrap") && !gate.includes("pinCode"), "Client-side bootstrap or PIN authentication is still enabled");
const authContext = exists("context/TenantAuthContext.tsx") ? read("context/TenantAuthContext.tsx") : "";
check(authContext.includes("signInWithEmailAndPassword") && authContext.includes("identityFromClaims"), "Company sign-in is not verified against trusted claims");
check(!authContext.includes("signInAnonymously"), "Anonymous login is still enabled");

const employeeModal = exists("components/EmployeeSelectorModal.tsx") ? read("components/EmployeeSelectorModal.tsx") : "";
check(!employeeModal.includes("setCurrentEmployee(emp)"), "Employee identity can be selected without authentication");
check(employeeModal.includes("setCurrentEmployee(null)"), "Employee switching does not require sign-out");

const developer = exists("app/(tabs)/developer.tsx") ? read("app/(tabs)/developer.tsx") : "";
const developerIsDisabled = developer.includes('return <Redirect href="/(tabs)/cashier"');
check(developerIsDisabled || developer.includes("canAccessDeveloperDashboard"), "Developer dashboard content is not guarded");

const firestoreRules = exists("firestore.rules") ? read("firestore.rules") : "";
check(firestoreRules.includes("request.auth"), "Firestore rules do not require authentication");
check(firestoreRules.includes("companyId"), "Firestore rules do not enforce companyId isolation");
check(firestoreRules.includes("auditLogs"), "Firestore rules do not include auditLogs");
check(firestoreRules.includes("request.auth.token.employeeDocId") && firestoreRules.includes("data.authUid == request.auth.uid"), "Firestore identity is not bound to an employee record");
check(!/allow read, write: if request\.auth != null/.test(firestoreRules), "Firestore has unrestricted authenticated access");

const storageRules = exists("storage.rules") ? read("storage.rules") : "";
check(storageRules.includes("contracts/{companyId}"), "Storage rules do not protect contracts by companyId");
check(storageRules.includes("product-images/{companyId}"), "Storage rules do not protect product images by companyId");
check(storageRules.includes("request.auth"), "Storage rules do not require authentication");

const employeeContext = exists("context/EmployeeContext.tsx") ? read("context/EmployeeContext.tsx") : "";
check(!employeeContext.includes("function fallbackEmployee"), "Default administrator fallback is still enabled");
check(employeeContext.includes("AUTH_EMPLOYEE_SWITCH_REQUIRES_SIGN_IN"), "Employee switching is not identity-bound");

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
