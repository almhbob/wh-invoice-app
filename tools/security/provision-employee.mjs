// Trusted, operator-run tooling only. Never bundle this file with the app.
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { randomBytes } from "node:crypto";

const mode = process.argv.includes("--scrub") ? "scrub" : "provision";
const apply = process.argv.includes("--apply");
const projectId = process.env.FIREBASE_PROJECT_ID;
const companyId = process.env.COMPANY_ID;
const employeeDocId = process.env.EMPLOYEE_DOC_ID;
const email = process.env.EMPLOYEE_EMAIL?.trim();
const safeId = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

if (!projectId || !companyId || !safeId.test(companyId)) {
  console.error("Set FIREBASE_PROJECT_ID and a valid COMPANY_ID in the protected environment.");
  process.exit(1);
}
if (apply && process.env.CONFIRM_FIREBASE_PROJECT !== projectId) {
  console.error("Writes require CONFIRM_FIREBASE_PROJECT to match FIREBASE_PROJECT_ID.");
  process.exit(1);
}
if (mode === "provision" && (!employeeDocId || !safeId.test(employeeDocId) || !email?.includes("@"))) {
  console.error("Provisioning requires EMPLOYEE_DOC_ID and EMPLOYEE_EMAIL.");
  process.exit(1);
}

const app = initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore(app);
const auth = getAuth(app);
const credentialFields = ["pinCode", "password", "passwordHash", "pinHash"];

try {
  if (mode === "scrub") {
    const snapshot = await db.collection("companies").doc(companyId).collection("employees").get();
    const affected = snapshot.docs.filter((entry) => credentialFields.some((field) => field in entry.data()));
    console.log(JSON.stringify({ mode, dryRun: !apply, employeeCount: snapshot.size, profilesWithLegacyCredentials: affected.length }));
    if (apply) {
      // Only remove legacy credential fields; keep IDs, roles and business data.
      for (let offset = 0; offset < affected.length; offset += 400) {
        const batch = db.batch();
        for (const entry of affected.slice(offset, offset + 400)) {
          batch.update(entry.ref, Object.fromEntries(credentialFields.map((field) => [field, FieldValue.delete()])));
        }
        await batch.commit();
      }
      await db.doc(`companies/${companyId}`).set({ authMigrationVersion: 1 }, { merge: true });
      console.log("Legacy credential fields removed. No orders or profiles deleted.");
    }
  } else {
    const ref = db.doc(`companies/${companyId}/employees/${employeeDocId}`);
    const snapshot = await ref.get();
    if (!snapshot.exists) throw new Error("EMPLOYEE_PROFILE_NOT_FOUND");
    const profile = snapshot.data();
    if (profile.status === "suspended") throw new Error("EMPLOYEE_SUSPENDED");
    const allowedRoles = ["admin", "branch_supervisor", "cashier", "halwa", "mawali", "chocolate", "cake", "packaging", "dept_supervisor", "guest"];
    if (!allowedRoles.includes(profile.role)) throw new Error("INVALID_EMPLOYEE_ROLE");
    if (profile.companyId && profile.companyId !== companyId) throw new Error("PROFILE_COMPANY_MISMATCH");
    let account;
    try { account = await auth.getUserByEmail(email); }
    catch (failure) { if (failure.code !== "auth/user-not-found") throw failure; }
    if (account?.disabled) throw new Error("AUTH_ACCOUNT_DISABLED");
    const existingClaims = account?.customClaims || {};
    if (
      (existingClaims.companyId && existingClaims.companyId !== companyId) ||
      (existingClaims.employeeDocId && existingClaims.employeeDocId !== employeeDocId) ||
      (profile.authUid && profile.authUid !== account?.uid)
    ) throw new Error("EXISTING_ACCOUNT_MEMBERSHIP_CONFLICT");
    if (account && !existingClaims.companyId && profile.authUid !== account.uid) throw new Error("EXISTING_UNASSIGNED_ACCOUNT_REQUIRES_ADMIN_REVIEW");
    console.log(JSON.stringify({ mode, dryRun: !apply, existingAuthAccount: Boolean(account), role: profile.role }));
    if (apply) {
      account ||= await auth.createUser({
        email,
        // Not printed or distributed. Employee sets their own password using
        // Firebase's password-reset email flow after account provisioning.
        password: randomBytes(36).toString("base64url"),
        disabled: false,
      });
      // Mapping is trusted; role/status stay in Firestore for immediate revocation.
      await auth.setCustomUserClaims(account.uid, { ...existingClaims, companyId, employeeDocId });
      await ref.update({
        companyId, authUid: account.uid, status: "active",
        ...Object.fromEntries(credentialFields.map((field) => [field, FieldValue.delete()])),
      });
      console.log("Account linked. Ask the employee to use Forgot password. No credentials are printed.");
    }
  }
} catch (failure) {
  // Provider error messages can contain emails or sensitive configuration.
  console.error("Provisioning stopped:", failure.code || (/^[A-Z_]+$/.test(failure.message) ? failure.message : "ADMIN_OPERATION_FAILED"));
  process.exitCode = 1;
}
