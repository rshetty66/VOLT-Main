/**
 * Adds a VOLT Console account, or sets a new password for one: npm run add-user -- <username>
 * The password is read from stdin (typed, or piped), so it never appears in the shell history or the process list.
 * On Render, run it in the service's Shell so it writes to the data disk (VOLT_DATA_DIR).
 */
import readline from "node:readline";
import { listUsernames, setPassword } from "../server/accounts.js";

const name = process.argv[2]?.trim();
if (!name) {
  console.error("Usage: npm run add-user -- <username>");
  process.exit(1);
}
const rl = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: process.stdin.isTTY });
const muted = rl as unknown as { _writeToOutput?: (s: string) => void };
process.stderr.write(`Password for ${name} (at least 10 characters): `);
muted._writeToOutput = () => {};
rl.once("line", (password) => {
  rl.close();
  process.stderr.write("\n");
  try {
    const existed = listUsernames().includes(name);
    setPassword(name, password);
    console.log(existed ? `Password changed for ${name}.` : `Account ${name} added.`);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
});
