/**
 * Mentor Extension
 *
 * Three responsibilities, all driven by pi runtime events (not by the LLM):
 *
 * 1. session_start → snapshot the user's current output style into
 *    ~/.pi/mentor/.previous-style so we can restore it later.
 * 2. session_start → if proactive mode is enabled AND quiz topics are due,
 *    send a reminder via sendUserMessage().
 * 3. session_shutdown → conditionally restore the snapshot if the current
 *    style still looks like a mentor-touched one. The skill's "restore at
 *    session end" used to live in the markdown (LLM-executed) and silently
 *    failed on hard quit (Ctrl+D, SIGHUP, ...). At the extension layer it
 *    runs on every exit path: quit, reload, /new, /resume, /fork.
 *
 * Peer to pi-output-style: zero code coupling. Output-style reads
 * ~/.pi/current-style at before_agent_start; mentor does not touch that
 * file from this extension (the skill does, with the mode→style mapping).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Multi-OS HOME resolution: $HOME (Unix), $USERPROFILE (Windows), os.homedir() (last resort)
const HOME = process.env.HOME ?? process.env.USERPROFILE ?? homedir();
const MENTOR_DIR = join(HOME, ".pi", "mentor");
const PROFILE = join(MENTOR_DIR, "dev-profile.md");
const QUIZ_LOG = join(MENTOR_DIR, "quiz-log.md");
const PREVIOUS_STYLE = join(MENTOR_DIR, ".previous-style");
const CURRENT_STYLE = join(HOME, ".pi", "current-style");

// Styles that the mentor skill sets during a session. If the current style
// matches one of these at session_shutdown we know the mentor touched it
// and can safely restore. Anything else means the user (or another
// extension) changed the style manually mid-session → respect their choice.
const MENTOR_STYLES = new Set(["learning", "learning-explanatory"]);

// ---------- Output-style snapshot / restore (extension layer) ----------

function readStyleFile(path: string): string {
  try {
    const value = readFileSync(path, "utf-8").trim();
    return value.length > 0 ? value : "default";
  } catch {
    return "default";
  }
}

function snapshotCurrentStyle(): void {
  // Best-effort. If we can't snapshot, the restore on shutdown becomes a
  // no-op and the mentor style will leak into the next session — annoying
  // but recoverable via /style default.
  try {
    if (!existsSync(MENTOR_DIR)) {
      mkdirSync(MENTOR_DIR, { recursive: true });
    }
    writeFileSync(PREVIOUS_STYLE, readStyleFile(CURRENT_STYLE), "utf-8");
  } catch {
    // Filesystem not writable / sandboxed — skip silently.
  }
}

function restorePreviousStyleIfMentorTouched(): void {
  const current = readStyleFile(CURRENT_STYLE);
  if (!MENTOR_STYLES.has(current)) {
    // User (or another extension) set a non-mentor style mid-session.
    // Respect their choice — do not overwrite.
    return;
  }
  const previous = readStyleFile(PREVIOUS_STYLE);
  try {
    writeFileSync(CURRENT_STYLE, previous, "utf-8");
  } catch {
    // ~/.pi/current-style not writable. User can recover with /style.
  }
}

// ---------- Proactive quiz reminder (existing logic) ----------

interface DueTopic {
  topic: string;
  level: string;
  next: string;
}

function parseDueTopics(): DueTopic[] {
  if (!existsSync(QUIZ_LOG)) return [];
  let log: string;
  try {
    log = readFileSync(QUIZ_LOG, "utf-8");
  } catch {
    // File was removed, locked, or unreadable between existsSync and read.
    // Silently skip — proactive reminder is a nice-to-have, not a critical path.
    return [];
  }
  const today = new Date().toISOString().slice(0, 10);
  const due: DueTopic[] = [];

  for (const rawLine of log.split("\n")) {
    const line = rawLine.trim();
    // Match the Upcoming Reviews table rows: | topic | level | last | next | interval | step |
    // Pipe count = 6 (5 columns + outer pipes), topic slug has no pipe
    if (!line.startsWith("|") || line.startsWith("|-") || line.startsWith("|:") || line.startsWith("| ")) {
      continue;
    }
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length < 6) continue;
    // parts[0] is empty (leading pipe), parts[5] is empty (trailing pipe)
    const [, topic, level, , next] = parts;
    if (!topic || !next) continue;
    if (next <= today) {
      due.push({ topic, level, next });
    }
  }

  // Sort by most overdue first
  due.sort((a, b) => a.next.localeCompare(b.next));
  return due;
}

function isProactiveEnabled(): boolean {
  if (!existsSync(PROFILE)) return false;
  try {
    const profile = readFileSync(PROFILE, "utf-8");
    return /Proactive mode\*\*:\s*enabled/i.test(profile);
  } catch {
    return false;
  }
}

// ---------- Extension entry point ----------

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    // 1) Snapshot the user's current style BEFORE anything else, so the
    //    restore at session_shutdown has a baseline even if the rest of
    //    this handler bails out (e.g. print/json mode, no profile, etc.).
    snapshotCurrentStyle();

    // 2) Proactive quiz reminder (existing behavior, unchanged).
    //    Mode guard: sendUserMessage triggers a turn. In print/json modes
    //    the reminder would either be invisible or trigger an unwanted
    //    auto-LLM call without an interactive user to ack it. Skip.
    if (ctx.mode === "print" || ctx.mode === "json") return;
    if (!isProactiveEnabled()) return;
    if (!existsSync(QUIZ_LOG)) return;

    const due = parseDueTopics();
    if (due.length === 0) return;

    // Build the reminder message
    const topicList = due
      .slice(0, 5) // cap display at 5 topics
      .map((t) => `- ${t.topic} (level: ${t.level}, due: ${t.next})`)
      .join("\n");
    const more = due.length > 5 ? `\n…and ${due.length - 5} more.` : "";

    const reminder =
      `[MENTOR REMINDER] You have ${due.length} quiz${due.length > 1 ? "zes" : ""} due from the horka-mentor system:\n` +
      `${topicList}${more}\n\n` +
      `Type \`/mentor-quiz\` to start the spaced-repetition review, or \`/mentor-quiz <topic>\` to focus on one. ` +
      `Type \`/mentor proactif off\` to disable these reminders.`;

    // Send as a user message so it appears naturally in the conversation
    if (ctx.isIdle()) {
      pi.sendUserMessage(reminder);
    } else {
      // Fallback: surface as a notification if agent is busy
      ctx.ui.notify(`[Mentor] ${due.length} quiz due. Type /mentor-quiz to start.`, "info");
    }
  });

  pi.on("session_shutdown", async (_event, _ctx) => {
    // Fires on every runtime teardown: Ctrl+C, Ctrl+D, SIGHUP, SIGTERM,
    // /reload, /new, /resume, /fork. The restore MUST live here, not in
    // the skill's markdown, because the LLM never gets a turn to run
    // bash on a hard quit. Centralizing it in the extension guarantees
    // the user's original style is reinstated regardless of how the
    // session ends.
    restorePreviousStyleIfMentorTouched();
  });
}
