import assert from "node:assert/strict";
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

console.log("smart-compose tests passed (templates)");
