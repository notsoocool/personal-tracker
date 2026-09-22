import assert from "node:assert/strict";
import {
  buildClaudePlanPrompt,
  parseClaudePlanOutput,
} from "../src/lib/claude-handoff";
import type { InboxItem } from "../src/lib/types";

const item: InboxItem = {
  id: "abc",
  project_id: "p1",
  type: "review",
  title: "Fix nav overflow",
  notes: "On mobile the nav clips.",
  page_url: "https://example.com/nav",
  screenshot_url: "/uploads/shot.png",
  status: "new",
  created_at: new Date().toISOString(),
};

const prompt = buildClaudePlanPrompt(item, "Flit", "http://127.0.0.1:43127");
assert.match(prompt, /Fix nav overflow/);
assert.match(prompt, /https:\/\/example.com\/nav/);
assert.match(prompt, /http:\/\/127\.0\.0\.1:43127\/uploads\/shot\.png/);
assert.match(prompt, /```json/);

const parsed = parseClaudePlanOutput(`
Here is the plan:
\`\`\`json
{
  "title": "Nav overflow fix",
  "summary": "Clip the mobile nav.",
  "tasks": ["Reproduce", "Ship CSS fix", "Verify"]
}
\`\`\`
`);
assert.equal(parsed?.title, "Nav overflow fix");
assert.equal(parsed?.tasks.length, 3);

const loose = parseClaudePlanOutput(`Title: Loose plan
Summary: Do the thing

Tasks:
- One
- Two
`);
assert.equal(loose?.title, "Loose plan");
assert.deepEqual(loose?.tasks, ["One", "Two"]);

console.log("claude-handoff tests passed");
