/**
 * Mentor Extension
 *
 * Single responsibility: on session_start, check if any quiz topics are due
 * and send a reminder via sendUserMessage().
 *
 * All pedagogical workflow lives in the skills (SKILL.md). This extension
 * handles the "between prompts" behavior that the LLM cannot do on its own.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const HOME = process.env.HOME ?? process.env.USERPROFILE ?? "";
const MENTOR_DIR = join(HOME, ".pi", "mentor");
const PROFILE = join(MENTOR_DIR, "dev-profile.md");
const QUIZ_LOG = join(MENTOR_DIR, "quiz-log.md");

// ---------- Proactive quiz reminder ----------

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
    return [];
  }
  const today = new Date().toISOString().slice(0, 10);
  const due: DueTopic[] = [];

  for (const rawLine of log.split("\n")) {
    const line = rawLine.trim();
    if (!line.startsWith("|") || line.startsWith("|-") || line.startsWith("|:")) {
      continue;
    }
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length < 6) continue;
    const [, topic, level, , next] = parts;
    if (!topic || !next) continue;
    if (next <= today) {
      due.push({ topic, level, next });
    }
  }

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
    // Skip in non-interactive modes
    if (ctx.mode === "print" || ctx.mode === "json") return;
    if (!isProactiveEnabled()) return;
    if (!existsSync(QUIZ_LOG)) return;

    const due = parseDueTopics();
    if (due.length === 0) return;

    const topicList = due
      .slice(0, 5)
      .map((t) => `- ${t.topic} (level: ${t.level}, due: ${t.next})`)
      .join("\n");
    const more = due.length > 5 ? `\n…and ${due.length - 5} more.` : "";

    const reminder =
      `[MENTOR REMINDER] You have ${due.length} quiz${due.length > 1 ? "zes" : ""} due:\n` +
      `${topicList}${more}\n\n` +
      `Type \`/mentor-quiz\` to start the spaced-repetition review, or \`/mentor-quiz <topic>\` to focus on one. ` +
      `Type \`/mentor proactif off\` to disable these reminders.`;

    if (ctx.isIdle()) {
      pi.sendUserMessage(reminder);
    } else {
      ctx.ui.notify(`[Mentor] ${due.length} quiz due. Type /mentor-quiz to start.`, "info");
    }
  });
}
