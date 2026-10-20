/**
 * Sets a new password for a console account from the command line, for when nobody can sign in
 * (for example the only admin forgot their password). Stop the server first: the embedded database
 * allows one process at a time.
 *
 *   npm run reset-password -- someone@example.com
 *
 * Prompts for the new password, re-enables the account if it was disabled, and signs it out everywhere.
 */
import "./env.js";
import { createInterface } from "node:readline/promises";
import { DEFAULT_DATA_DIR, openDb } from "./db.js";
import { audit, passwordProblem, setPassword, updateUser } from "./auth.js";

const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run reset-password -- <email>");
  process.exit(1);
}

const db = await openDb(process.env.VOLT_DATA_DIR || DEFAULT_DATA_DIR);
try {
  const { rows } = await db.query<{ id: string; name: string; role: string }>("select id, name, role from users where email = $1", [email]);
  if (!rows[0]) {
    const all = await db.query<{ email: string }>("select email from users order by email");
    console.error(`No account for ${email}. Accounts: ${all.rows.map((r) => r.email).join(", ") || "none (open the app to create the admin)"}`);
    process.exitCode = 1;
  } else {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const pw = await rl.question(`New password for ${rows[0].name} (${rows[0].role}): `);
    rl.close();
    const problem = passwordProblem(pw);
    if (problem) {
      console.error(problem);
      process.exitCode = 1;
    } else {
      await setPassword(db, rows[0].id, pw);
      await updateUser(db, rows[0].id, { disabled: false });
      await audit(db, rows[0].id, "password_reset_cli", { type: "user", id: rows[0].id });
      console.log(`Password updated for ${email}. Start the console and sign in.`);
    }
  }
} finally {
  await db.close();
}
