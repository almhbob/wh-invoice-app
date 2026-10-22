/**
 * One-time owner accounts that existed only inside the old app code.
 * In secure mode they are created in Firestore on first sign-in with a private
 * one-time setup code (only its salted SHA-256 is stored here), and the owner
 * must choose a new PIN immediately. Once the employee exists in Firestore this
 * path is never used again.
 */
export interface BootstrapAccount {
  employeeId: string;
  username: string;
  name: string;
  role: string;
  salt: string;
  codeHash: string;
}

export const BOOTSTRAP_ACCOUNTS: Record<string, BootstrapAccount[]> = {
  "laviviane-trial": [
    {
      employeeId: "LAVI001",
      username: "lavi001",
      name: "مسؤول لاففيان",
      role: "admin",
      salt: "3a42739b324ab327fe430dc084531feb",
      codeHash: "7bcdd9c69ffaf421828aa7e56933414da3111ea2148bde011939892441a142f0",
    },
  ],
};
