import { test } from "node:test";
import assert from "node:assert/strict";
import {
  availableTransitions,
  canFireFrom,
  findTransition,
  stateLabel,
  userCanTransition,
  type WorkflowDefinition,
} from "../src/index.js";

const wf: WorkflowDefinition = {
  field: "status",
  initial: "submitted",
  states: [
    { name: "submitted", label: "Submitted" },
    { name: "in_review", label: "In Review" },
    { name: "approved", label: "Approved" },
  ],
  transitions: [
    { name: "start_review", label: "Start", from: ["submitted"], to: "in_review", roles: ["editor", "admin"] },
    { name: "approve", label: "Approve", from: ["in_review"], to: "approved", roles: ["admin"] },
  ],
};

const admin = { id: "1", email: "a", name: "a", roles: ["admin"] };
const editor = { id: "2", email: "e", name: "e", roles: ["editor"] };

test("canFireFrom respects from-states", () => {
  assert.equal(canFireFrom(wf.transitions[0]!, "submitted"), true);
  assert.equal(canFireFrom(wf.transitions[1]!, "submitted"), false);
});

test("userCanTransition gates by role", () => {
  assert.equal(userCanTransition(editor, wf.transitions[1]!), false);
  assert.equal(userCanTransition(admin, wf.transitions[1]!), true);
  assert.equal(userCanTransition(null, wf.transitions[0]!), false);
});

test("availableTransitions filters by state and role", () => {
  assert.deepEqual(
    availableTransitions(wf, "submitted", editor).map((t) => t.name),
    ["start_review"],
  );
  assert.deepEqual(availableTransitions(wf, "in_review", editor).map((t) => t.name), []);
  assert.deepEqual(
    availableTransitions(wf, "in_review", admin).map((t) => t.name),
    ["approve"],
  );
});

test("findTransition and stateLabel", () => {
  assert.equal(findTransition(wf, "approve")?.to, "approved");
  assert.equal(findTransition(wf, "nope"), null);
  assert.equal(stateLabel(wf, "in_review"), "In Review");
  assert.equal(stateLabel(wf, "unknown"), "unknown");
});
