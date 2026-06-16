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
import type { AutocompleteItem } from "@earendil-works/pi-tui";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const HOME = process.env.HOME ?? process.env.USERPROFILE ?? homedir();
const MENTOR_DIR = join(HOME, ".pi", "mentor");
const PROFILE = join(MENTOR_DIR, "dev-profile.md");
const QUIZ_LOG = join(MENTOR_DIR, "quiz-log.md");

// ---------- Proactive quiz reminder ----------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

interface DueTopic {
  topic: string;
  level: string;
  next: string;
}

function parseDueTopics(): DueTopic[] {
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
    if (!ISO_DATE.test(next) || !ISO_DATE.test(today)) continue;
    if (next <= today) {
      due.push({ topic, level, next });
    }
  }

  due.sort((a, b) => a.next.localeCompare(b.next));
  return due;
}

function getProfileLanguage(): string {
  try {
    const profile = readFileSync(PROFILE, "utf-8");
    const match = profile.match(/Language:\*\*\s*(\S+)/i);
    return match?.[1]?.toLowerCase() ?? "en";
  } catch {
    return "en";
  }
}

function isProactiveEnabled(): boolean {
  try {
    const profile = readFileSync(PROFILE, "utf-8");
    return /Proactive mode\*\*:\s*enabled/i.test(profile);
  } catch {
    return false;
  }
}

// ---------- Slash commands ----------

const MENTOR_SUBCOMMANDS = [
  "learn",
  "--no-context",
  "profil",
  "topics",
  "proactif on",
  "proactif off",
];

function getMentorCompletions(prefix: string): AutocompleteItem[] | null {
  const filtered = MENTOR_SUBCOMMANDS.filter((s) => s.startsWith(prefix));
  if (filtered.length === 0) return null;
  return filtered.map((s) => ({ value: s, label: s }));
}

function getQuizTopicCompletions(prefix: string): AutocompleteItem[] | null {
  let files: string[];
  try {
    const topicsDir = join(MENTOR_DIR, "topics");
    files = readdirSync(topicsDir);
  } catch {
    return null;
  }
  const topics = files
    .filter((f) => {
      if (!f.endsWith(".md")) return false;
      try {
        return statSync(join(MENTOR_DIR, "topics", f)).isFile();
      } catch {
        return false;
      }
    })
    .map((f) => f.slice(0, -3));
  if (topics.length === 0) return null;
  const filtered = topics.filter((t) => t.startsWith(prefix));
  if (filtered.length === 0) return null;
  return filtered.map((t) => ({ value: t, label: t }));
}

// ---------- Extension entry point ----------

export default function (pi: ExtensionAPI) {
  // Register /mentor command with subcommand autocomplete
  pi.registerCommand("mentor", {
    description: "Start teaching mentor in build mode (default) or with a subcommand: learn, --no-context, profil, topics, proactif on/off",
    getArgumentCompletions: getMentorCompletions,
    handler: async (args, ctx) => {
      await ctx.waitForIdle();
      const subcommand = args.trim() || "build";
      pi.sendUserMessage(`mentor ${subcommand}`);
    },
  });

  // Register /mentor-quiz command with topic autocomplete
  pi.registerCommand("mentor-quiz", {
    description: "Start a spaced-repetition quiz on all due topics or a specific topic",
    getArgumentCompletions: getQuizTopicCompletions,
    handler: async (args, ctx) => {
      await ctx.waitForIdle();
      const topic = args.trim();
      pi.sendUserMessage(topic ? `mentor-quiz ${topic}` : "mentor-quiz");
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    try {
      // Skip in non-interactive modes
      if (ctx.mode === "print" || ctx.mode === "json") return;
      if (!isProactiveEnabled()) return;

      const due = parseDueTopics();
      if (due.length === 0) return;

      const topicList = due
        .slice(0, 5)
        .map((t) => `- ${t.topic} (level: ${t.level}, due: ${t.next})`)
        .join("\n");
      const more = due.length > 5 ? `\n…and ${due.length - 5} more.` : "";

      const lang = getProfileLanguage();

      let reminder: string;
      if (lang === "fr") {
        reminder =
          `[MENTOR RAPPEL] Vous avez ${due.length} quiz à faire :\n` +
          `${topicList}${more}\n\n` +
          `Tapez \`/mentor-quiz\` pour commencer la révision espacée, ou \`/mentor-quiz <topic>\` pour se concentrer sur un sujet. ` +
          `Tapez \`/mentor proactif off\` pour désactiver ces rappels.`;
      } else {
        reminder =
          `[MENTOR REMINDER] You have ${due.length} quiz${due.length > 1 ? "zes" : ""} due:\n` +
          `${topicList}${more}\n\n` +
          `Type \`/mentor-quiz\` to start the spaced-repetition review, or \`/mentor-quiz <topic>\` to focus on one. ` +
          `Type \`/mentor proactif off\` to disable these reminders.`;
      }

      if (ctx.isIdle()) {
        pi.sendUserMessage(reminder);
      } else {
        ctx.ui.notify(`[Mentor] ${due.length} quiz due. Type /mentor-quiz to start.`, "info");
      }
    } catch {
      // Prevent unhandled rejections from crashing the session
    }
  });
}
