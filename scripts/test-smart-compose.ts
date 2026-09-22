import assert from "node:assert/strict";
import { draftFromCompose } from "../src/lib/smart-heuristics";
import {
  FLIT_SMART_TEMPLATES,
  getSmartTemplate,
} from "../src/lib/smart-templates";

assert.equal(FLIT_SMART_TEMPLATES.length, 4);
assert.ok(getSmartTemplate("bug-page"));
assert.equal(getSmartTemplate("bug-page")?.defaultType, "review");
assert.equal(getSmartTemplate("missing-feature")?.defaultType, "todo");
assert.match(getSmartTemplate("bug-page")!.seedText, /URL|url|page/i);
assert.equal(getSmartTemplate("nope"), undefined);

const reviewDraft = draftFromCompose({
  text: "Button is broken on this page\nPage URL: https://example.com/haiku",
  chipId: "bug-page",
});
assert.equal(reviewDraft.type, "review");
assert.ok(reviewDraft.title.length > 0);
assert.equal(reviewDraft.pageUrl, "https://example.com/haiku");

const todoDraft = draftFromCompose({
  text: "Please add export to CSV for rooms",
  chipId: "missing-feature",
});
assert.equal(todoDraft.type, "todo");
assert.match(todoDraft.title, /export|CSV|rooms/i);

const emptyish = draftFromCompose({ text: "   " });
assert.equal(emptyish.title, "New ask");

console.log("smart-compose tests passed (templates + heuristics)");
