/**
 * The console in a real browser, in demo mode: sign-in, engagements, client files,
 * templates, workflow runs, Stop and Resume, exports, usage, and a viewer's limits.
 * One story in order, since each step builds on the last.
 */
import JSZip from "jszip";
import { expect, test, type Page } from "@playwright/test";

test.describe.configure({ mode: "serial" });

const PW = "correct-horse-battery";
const CLIENT = "Maple Harbour Financial (fictional)";
let page: Page;
const errors: string[] = [];

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
});
test.afterAll(() => expect(errors, "no page errors").toEqual([]));

const nav = (name: RegExp) => page.getByRole("button", { name }).first().click();

async function signIn(email: string) {
  await page.goto("/");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PW);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
}

test("first run: create the admin, sign out and back in", async () => {
  await page.goto("/");
  await expect(page.getByText("Create the admin account")).toBeVisible();
  await page.getByLabel("Your name").fill("Admin Person");
  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Password (at least 10 characters)").fill(PW);
  await page.getByLabel("Confirm password").fill(PW);
  await page.getByRole("button", { name: "Create admin account" }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await signIn("admin@example.com");
});

test("templates: create a brand profile", async () => {
  await nav(/^Templates/);
  await page.getByRole("button", { name: "New template" }).click();
  await page.getByLabel("Template name").fill("Maple brand");
  await page.getByLabel("Primary colour", { exact: true }).fill("0B6E4F");
  await page.getByLabel("Accent colour", { exact: true }).fill("C77D0A");
  await page.getByRole("button", { name: "Create template" }).click();
  await expect(page.getByText("Maple brand").first()).toBeVisible();
});

test("engagements: create one with the template, upload a client file", async () => {
  await nav(/Engagements/);
  await page.getByPlaceholder("Client name").fill(CLIENT);
  await page.getByPlaceholder(/Engagement title/).fill("Close optimization");
  await page.getByLabel("Output template").first().selectOption({ label: "Maple brand" });
  await page.getByRole("button", { name: "Create engagement" }).click();
  await expect(page.getByText("current engagement", { exact: true })).toBeVisible();
  await page.getByLabel("Upload client files").setInputFiles({ name: "Trial balance (fictional).csv", mimeType: "text/csv", buffer: Buffer.from("Account,Debit,Credit\n1000,1250000,0\n2000,0,1250000\n") });
  await expect(page.getByRole("cell", { name: "F1", exact: true })).toBeVisible();
  await page.getByRole("row", { name: /F1/ }).getByRole("button", { name: "Preview" }).click();
  await expect(page.getByTestId("file-preview")).toContainText("1000,1250000,0");
});

test("runs: a workflow reads the file and finishes; exports download with charts", async () => {
  await nav(/^Workflows/);
  await page.getByPlaceholder("Filter workflows").fill("close");
  await page.getByText("Finance Close Optimization").first().click();
  await expect(page.getByTestId("files-note")).toContainText("F1 Trial balance (fictional).csv");
  await page.locator("textarea").fill("Our close takes 11 days across SAP and Oracle.");
  await page.getByRole("button", { name: "Launch workflow" }).click();
  await expect(page.getByRole("link", { name: "Word" }).first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("files-read").first()).toContainText("Read F1");
  await expect(page.locator(".run").first()).not.toContainText("undefined");

  // From the engagement page: the run is listed, and each export downloads.
  await nav(/Engagements/);
  await page.getByRole("cell", { name: CLIENT }).click();
  const row = page.getByRole("row", { name: /Finance Close Optimization/ }).first();
  await expect(row).toContainText("done");
  for (const [label, ext] of [["Word", "docx"], ["Excel", "xlsx"], ["PowerPoint", "pptx"], ["Markdown", "md"]] as const) {
    const [download] = await Promise.all([page.waitForEvent("download"), row.getByRole("link", { name: label }).click()]);
    expect(download.suggestedFilename()).toMatch(new RegExp(`^finance-close-optimization-\\d{4}-\\d{2}-\\d{2}\\.${ext}$`));
    const path = await download.path();
    const bytes = await import("node:fs").then((fs) => fs.readFileSync(path!));
    if (ext === "xlsx") {
      const zip = await JSZip.loadAsync(bytes);
      expect(Object.keys(zip.files).some((n) => n.startsWith("xl/charts/"))).toBe(true);
      expect(await zip.file("xl/charts/chart1.xml")!.async("string")).toContain('val="C77D0A"'); // the template's accent
    }
    if (ext === "md") expect(bytes.toString()).toContain("## Client files used");
  }
});

test("Stop, then Resume: the resumed run reuses finished specialists and completes", async () => {
  await nav(/^Workflows/);
  await page.getByText("Finance Close Optimization").first().click();
  await page.locator("textarea").fill("Second pass: stop part-way.");
  await page.getByRole("button", { name: "Launch workflow" }).click();
  const run = page.locator(".run").last();
  // Stop once at least one specialist has finished, so Resume has something to reuse (timing differs by machine).
  await expect(run.locator(".lane .dot.done").first()).toBeVisible({ timeout: 30_000 });
  // The card keeps re-rendering while text streams in, so it never looks "stable"; click without waiting for that.
  await run.getByRole("button", { name: "Stop" }).click({ force: true });
  await expect(run.getByText("stopped", { exact: true })).toBeVisible({ timeout: 30_000 });

  await nav(/Engagements/);
  await page.getByRole("cell", { name: CLIENT }).click();
  await page.getByRole("row", { name: /stopped/ }).first().click();
  await page.getByRole("button", { name: "Resume" }).click();
  const resumed = page.locator(".run").last();
  await expect(resumed).toContainText("(resumed)");
  await expect(resumed.getByRole("link", { name: "Word" })).toBeVisible({ timeout: 60_000 });
  await expect(resumed).toContainText(/Resuming: reusing \d+ finished specialist output/);
});

test("usage and people: the admin adds a viewer, who can read but not run", async () => {
  await nav(/^Usage/);
  await expect(page.getByText("Costliest runs this month")).toBeVisible();
  await expect(page.getByText("Budgets and models (admin)")).toBeVisible();

  await nav(/^Users/);
  await page.getByLabel("New user name").fill("Vic Viewer");
  await page.getByLabel("New user email").fill("vic@example.com");
  await page.getByLabel("New user role").selectOption("viewer");
  await page.getByLabel("Temporary password").fill(PW);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("cell", { name: "Vic Viewer" })).toBeVisible();
  await nav(/Engagements/);
  await page.getByRole("cell", { name: CLIENT }).click();
  await page.getByLabel("Add a person").selectOption({ label: "Vic Viewer (viewer)" });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Sign out" }).click();

  await signIn("vic@example.com");
  await expect(page.getByRole("button", { name: /^Users/ })).toHaveCount(0);
  await expect(page.locator("textarea")).toBeDisabled();
  await nav(/Engagements/);
  await page.getByRole("cell", { name: CLIENT }).click();
  await expect(page.getByText("view only", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Upload files" })).toHaveCount(0);
});
