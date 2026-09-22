import { chromium } from "playwright";
import path from "path";
import { execSync } from "child_process";

const MEDIA =
  "/Users/notsocool/Library/Application Support/Cursor/AgentStores/cursor_agent_stores/bc-f3509d0b-190f-40d0-97cb-9abb769fa230/files/media";
const BASE = "http://127.0.0.1:43127";
const TOKEN = execSync(
  "sqlite3 data/tracker.sqlite \"SELECT token FROM manager_links WHERE revoked_at IS NULL ORDER BY created_at DESC LIMIT 1;\"",
  { cwd: "/Users/notsocool/Documents/GitHub/personal-tracker", encoding: "utf8" },
).trim();

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto(BASE + "/login");
await page.fill('input[name="password"]', "tracker-dev");
await page.click('button[type="submit"]');
await page.waitForURL("**/cockpit");

await page.waitForSelector("text=Ready next");
await page.screenshot({
  path: path.join(MEDIA, "ready-queue.png"),
  fullPage: true,
});

await page.getByRole("tab", { name: /Inbox/i }).click();
await page.waitForTimeout(500);
await page.getByRole("button", { name: /Plan with Claude/i }).first().waitFor({
  state: "visible",
  timeout: 8000,
});
await page.screenshot({
  path: path.join(MEDIA, "claude-handoff.png"),
  fullPage: true,
});

await page.getByRole("button", { name: /Promote \/ paste plan/i }).first().click();
await page.waitForSelector("text=Paste Claude plan");
await page.screenshot({
  path: path.join(MEDIA, "claude-paste-back.png"),
  fullPage: true,
});
await page.keyboard.press("Escape");

await page.goto(BASE + "/m/" + TOKEN);
await page.getByRole("tab", { name: /Progress/i }).click();
await page.waitForTimeout(500);
await page.waitForSelector("text=Open inbox");
await page.screenshot({
  path: path.join(MEDIA, "manager-polish.png"),
  fullPage: true,
});

console.log("screenshots written to", MEDIA);
await browser.close();
