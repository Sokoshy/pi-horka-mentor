/**
 * Mentor Extension
 *
 * On session_start, checks the user's mentor profile and injects a quiz reminder
 * if proactive mode is enabled AND there are due topics.
 *
 * Integrates with horka-mentor and horka-mentor-quiz skills via ~/.pi/mentor/ memory.
 * The reminder is sent as a USER message via pi.sendUserMessage() so it appears in
 * the conversation as if the dev had typed it themselves — natural and ack-able.
 *
 * Peer to pi-output-style: zero code coupling. Output-style reads ~/.pi/current-style
 * at before_agent_start; mentor does not touch that file from this extension.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Multi-OS HOME resolution: $HOME (Unix), $USERPROFILE (Windows), os.homedir() (last resort)
const HOME = process.env.HOME ?? process.env.USERPROFILE ?? homedir();
const MENTOR_DIR = join(HOME, ".pi", "mentor");
const PROFILE = join(MENTOR_DIR, "dev-profile.md");
const QUIZ_LOG = join(MENTOR_DIR, "quiz-log.md");

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

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    // Mode guard: sendUserMessage triggers a turn. In print/json modes the
    // reminder would either be invisible or trigger an unwanted auto-LLM
    // call without an interactive user to ack it. Skip silently.
    if (ctx.mode === "print" || ctx.mode === "json") return;

    // Only fire if: profile exists, proactive mode is on, and quiz-log exists
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
}
