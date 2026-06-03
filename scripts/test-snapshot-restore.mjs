#!/usr/bin/env node
// Quick sanity test for the snapshot/restore logic in extensions/mentor.ts.
// We can't run the actual extension event flow without pi, but we can
// replay the four file-touching operations in order to make sure the
// extension's behaviour is correct end-to-end.
//
// This script writes nothing under ~/.pi/ — it uses a temporary HOME-like
// directory so it's safe to run.

import { mkdtempSync, readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = mkdtempSync(join(tmpdir(), "mentor-snapshot-test-"));
const PI_DIR = join(root, ".pi");
const MENTOR_DIR = join(PI_DIR, "mentor");
const CURRENT_STYLE = join(PI_DIR, "current-style");
const PREVIOUS_STYLE = join(MENTOR_DIR, ".previous-style");

mkdirSync(MENTOR_DIR, { recursive: true });

// --- Re-implement the exact logic from extensions/mentor.ts ---
const MENTOR_STYLES = new Set(["learning", "learning-explanatory"]);

function readStyleFile(path) {
  try {
    const v = readFileSync(path, "utf-8").trim();
    return v.length > 0 ? v : "default";
  } catch {
    return "default";
  }
}

function snapshotCurrentStyle() {
  if (!existsSync(MENTOR_DIR)) mkdirSync(MENTOR_DIR, { recursive: true });
  writeFileSync(PREVIOUS_STYLE, readStyleFile(CURRENT_STYLE), "utf-8");
}

function restorePreviousStyleIfMentorTouched() {
  const current = readStyleFile(CURRENT_STYLE);
  if (!MENTOR_STYLES.has(current)) return;
  const previous = readStyleFile(PREVIOUS_STYLE);
  writeFileSync(CURRENT_STYLE, previous, "utf-8");
}

// Helper: a fake "skill sets mentor style" step
function skillSetsLearning() { writeFileSync(CURRENT_STYLE, "learning", "utf-8"); }
function skillSetsLearningExplanatory() { writeFileSync(CURRENT_STYLE, "learning-explanatory", "utf-8"); }
function userChangesToDefault() { writeFileSync(CURRENT_STYLE, "default", "utf-8"); }
function userChangesToExplanatory() { writeFileSync(CURRENT_STYLE, "explanatory", "utf-8"); }

let pass = 0, fail = 0;
function assertEq(label, got, want) {
  const ok = got === want;
  if (ok) { pass++; console.log(`  ✓ ${label}`); }
  else    { fail++; console.log(`  ✗ ${label}  (got=${JSON.stringify(got)} want=${JSON.stringify(want)})`); }
}

// === Test 1: Cold start, user starts with "default", never invokes /mentor, quits with Ctrl+D ===
console.log("\n[1] Cold start, no /mentor, Ctrl+D");
writeFileSync(CURRENT_STYLE, "default", "utf-8");
snapshotCurrentStyle();
assertEq("snapshot written", readStyleFile(PREVIOUS_STYLE), "default");
restorePreviousStyleIfMentorTouched();
assertEq("no-op restore (current=default)", readStyleFile(CURRENT_STYLE), "default");

// === Test 2: User starts with "default", invokes /mentor (learning), quits ===
console.log("\n[2] /mentor (build) then Ctrl+D — should restore 'default'");
writeFileSync(CURRENT_STYLE, "default", "utf-8");
snapshotCurrentStyle();
skillSetsLearning();
assertEq("after /mentor, current=learning", readStyleFile(CURRENT_STYLE), "learning");
restorePreviousStyleIfMentorTouched();
assertEq("after Ctrl+D, current=default (restored)", readStyleFile(CURRENT_STYLE), "default");

// === Test 3: User starts with "default", invokes /mentor learn, quits ===
console.log("\n[3] /mentor learn then Ctrl+D — should restore 'default'");
writeFileSync(CURRENT_STYLE, "default", "utf-8");
snapshotCurrentStyle();
skillSetsLearningExplanatory();
assertEq("after /mentor learn, current=learning-explanatory", readStyleFile(CURRENT_STYLE), "learning-explanatory");
restorePreviousStyleIfMentorTouched();
assertEq("after Ctrl+D, current=default (restored)", readStyleFile(CURRENT_STYLE), "default");

// === Test 4: User starts with "explanatory", invokes /mentor, manually changes to /style default mid-session, quits ===
console.log("\n[4] /mentor then /style default mid-session, then Ctrl+D — should keep 'default' (user's manual choice)");
writeFileSync(CURRENT_STYLE, "explanatory", "utf-8");
snapshotCurrentStyle();
skillSetsLearning();
userChangesToDefault();
restorePreviousStyleIfMentorTouched();
assertEq("after Ctrl+D, current=default (manual choice respected)", readStyleFile(CURRENT_STYLE), "default");

// === Test 5: User starts with "learning" (manually, no /mentor), quits — should stay 'learning' ===
console.log("\n[5] User manually set 'learning' at start, no /mentor, Ctrl+D — should keep 'learning'");
writeFileSync(CURRENT_STYLE, "learning", "utf-8");
snapshotCurrentStyle();
restorePreviousStyleIfMentorTouched();
assertEq("after Ctrl+D, current=learning (no change)", readStyleFile(CURRENT_STYLE), "learning");

// === Test 6: User starts with "explanatory", invokes /mentor learn (becomes learning-explanatory), quits ===
console.log("\n[6] /mentor learn from 'explanatory' baseline, Ctrl+D — should restore 'explanatory'");
writeFileSync(CURRENT_STYLE, "explanatory", "utf-8");
snapshotCurrentStyle();
skillSetsLearningExplanatory();
restorePreviousStyleIfMentorTouched();
assertEq("after Ctrl+D, current=explanatory (restored)", readStyleFile(CURRENT_STYLE), "explanatory");

// === Test 7: Same session, /mentor twice (build then learn) — snapshot only at session_start, so restore goes to original ===
console.log("\n[7] /mentor then /mentor learn in same session, Ctrl+D — restore to original 'default'");
writeFileSync(CURRENT_STYLE, "default", "utf-8");
snapshotCurrentStyle();
skillSetsLearning();
skillSetsLearningExplanatory();
restorePreviousStyleIfMentorTouched();
assertEq("after Ctrl+D, current=default (original, not 'learning')", readStyleFile(CURRENT_STYLE), "default");

// === Test 8: /new flow (session_shutdown reason=new, then session_start of new session) ===
console.log("\n[8] /new mid-session — restore on shutdown, fresh snapshot on next start");
writeFileSync(CURRENT_STYLE, "default", "utf-8");
snapshotCurrentStyle(); // session A start
skillSetsLearning();   // /mentor
restorePreviousStyleIfMentorTouched(); // session A shutdown (reason: new)
assertEq("after /new shutdown, current=default (restored)", readStyleFile(CURRENT_STYLE), "default");
snapshotCurrentStyle(); // session B start
assertEq("session B snapshot=default", readStyleFile(PREVIOUS_STYLE), "default");

// === Test 9: ~/.pi/current-style doesn't exist (output-style extension not installed) ===
console.log("\n[9] No output-style extension installed — graceful no-op");
rmSync(CURRENT_STYLE);
snapshotCurrentStyle();
assertEq("snapshot=default (file missing)", readStyleFile(PREVIOUS_STYLE), "default");
restorePreviousStyleIfMentorTouched();
// (no assertion — just verifying no crash, file still doesn't exist)
assertEq("current-style still missing", existsSync(CURRENT_STYLE), false);

// === Test 10: ~/.pi/mentor/.previous-style missing (first ever session, user never installed skill) ===
console.log("\n[10] First ever session, no .previous-style yet, Ctrl+D with no /mentor invoked");
writeFileSync(CURRENT_STYLE, "default", "utf-8");
rmSync(PREVIOUS_STYLE);
restorePreviousStyleIfMentorTouched();
assertEq("no-op, current stays default", readStyleFile(CURRENT_STYLE), "default");

// === Cleanup ===
rmSync(root, { recursive: true, force: true });

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
