import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const requiredFiles = [
  "constants/posReplacementSuite.ts",
  "constants/enterpriseOps.ts",
  "constants/branchOperations.ts",
  "constants/branchSupervisorPermissions.ts",
  "components/EnterpriseOpsPanel.tsx",
  "components/BranchSupervisorPanel.tsx",
  "components/BranchReturnsDamagePanel.tsx",
  "components/TenantCompanySettingsPanel.tsx",
  "components/ProductGalleryModal.tsx",
  "app/(tabs)/branches.tsx",
];

const requiredTokens = [
  ["app/(tabs)/branches.tsx", ["EnterpriseOpsPanel", "BranchSupervisorPanel", "BranchReturnsDamagePanel"]],
  ["app/(tabs)/_layout.tsx", ["branches", "إدارة الفروع"]],
  ["context/EmployeeContext.tsx", ["canBranchSupervisorAssignRole", "defaultPermissionsForRole", "createdBy"]],
  ["components/ProductGalleryModal.tsx", ["product.imageUri", "formatPrice", "onConfirm(items)"]],
];

let failed = false;

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    console.error(`Missing required file: ${file}`);
    failed = true;
  }
}

for (const [file, tokens] of requiredTokens) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    console.error(`Cannot inspect missing file: ${file}`);
    failed = true;
    continue;
  }
  const content = fs.readFileSync(full, "utf8");
  for (const token of tokens) {
    if (!content.includes(token)) {
      console.error(`Missing token '${token}' in ${file}`);
      failed = true;
    }
  }
}

if (failed) {
  console.error("Enterprise suite verification failed.");
  process.exit(1);
}

console.log("Enterprise suite verification passed.");
