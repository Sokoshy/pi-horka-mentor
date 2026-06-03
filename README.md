# pi-horka-mentor

> Teaching AI mentor for junior developers — a pi port of the [Horka mentor](https://github.com/joey-barbier/ClaudeCode-Plugin/tree/main/plugins/horka-mentor).
> Socratic pedagogy, spaced-repetition quizzes, **[output-style integration](https://github.com/Sokoshy/pi-output-style)**, and DocMancer-gated code examples.

[![pi package](https://img.shields.io/badge/pi-package-blueviolet)](https://pi.dev/packages)
[![keyword: pi-package](https://img.shields.io/badge/keyword-pi--package-blue)](#)
[![peer: pi-output-style](https://img.shields.io/badge/peer-pi--output--style-orange)](https://github.com/Sokoshy/pi-output-style)

> ⚡ **This is a full pi extension package, not just a skill.** It ships:
> - **1 TypeScript extension** (`extensions/mentor.ts`) that runs at session start to detect due quizzes and inject reminders.
> - **2 markdown skills** (`horka-mentor`, `horka-mentor-quiz`) that define the pedagogical workflow for the LLM.
>
> The extension handles *side effects* (file I/O, LLM messages, UI notifications). The skills handle *prompts* (what the LLM says and when). Both are required.

> 🤝 **Peer extension:** this package is designed to work hand-in-hand with **[pi-output-style](https://github.com/Sokoshy/pi-output-style)**. The mentor switches the voice to `learning` / `learning-explanatory` automatically; the output-style extension applies it. Install both for the full experience.

---

## ✨ What is this?

`pi-horka-mentor` turns pi into a **patient, Socratic coding teacher** for junior developers. It intercepts coding requests, evaluates the dev's understanding via open-ended questions (never yes/no), teaches with examples verified against current docs, and tracks every concept in a long-term memory so it can quiz the dev later with spaced repetition.

It is built around **three deliverables** — one runtime extension and two prompt-only skills:

| Component | Kind | Format | Runs when… | Role |
|---|---|---|---|---|
| `mentor.ts` | **pi extension** | TypeScript | At every `session_start` | Reads the dev profile + quiz log, sends a reminder message to the LLM if quizzes are due. Pure side-effect code. |
| `horka-mentor` | pi skill | Markdown | When invoked via `/mentor` or proactively triggered | Defines the Socratic teaching workflow (mode selection, concept analysis, level-up rules, output-style switching). Pure prompt content. |
| `horka-mentor-quiz` | pi skill | Markdown | When invoked via `/mentor-quiz` | Defines the spaced-repetition quiz workflow (question generation, evaluation, memory updates). Pure prompt content. |

### Extension vs skills — what's the difference?

This is a common point of confusion in the pi ecosystem, so let's be explicit:

| | Extension (`.ts`) | Skill (`SKILL.md`) |
|---|---|---|
| **Format** | TypeScript, loaded by jiti | Markdown, loaded by the LLM |
| **Loaded at** | pi startup | When invoked (`/skill:name`) or auto-matched by description |
| **Can do** | Read files, send LLM messages, prompt the user, modify session state | Nothing except guide the LLM's behavior |
| **Cannot do** | Define new commands on its own* | Execute code, read files directly, send messages |
| **Example from this package** | `mentor.ts` parses `~/.pi/mentor/quiz-log.md` and calls `pi.sendUserMessage()` | `horka-mentor` tells the LLM "ask an open question, then teach step by step" |

\* Skills can guide the LLM to call tools (Read, Write, Bash), but the extension is what enables *proactive* behavior — firing without a user prompt.

**The extension is what makes this package "alive" between user prompts.** Without `mentor.ts`, the skills would only fire on `/mentor` or `/mentor-quiz` — the proactive quiz reminders at session start would never happen.

The three components are **peers** — they share no code, only a file bus at `~/.pi/mentor/` and `~/.pi/current-style` (the latter shared with the [pi-output-style](https://github.com/Sokoshy/pi-output-style) extension).

---

## 🎯 Features

- **Socratic pedagogy** — open questions only (`predict-output`, `spot-bug`, `explain-in-your-words`). No yes/no.
- **Two teaching modes** — `build` (code together, 1 question max) and `learn` (deep exploration).
- **DocMancer gate** — refuses to teach third-party framework APIs without verified official docs.
- **Spaced repetition** — topic-level memory with `unknown → learning → understood → confident` progression and J+1, J+3, J+7, J+14, J+30 intervals.
- **Proactive mode** — auto-detects concepts the dev hasn't covered and intervenes with a question (max 2/session, throttle-protected).
- **Output-style integration** — auto-switches voice to `learning` (build) or `learning-explanatory` (learn/quiz), restores the user's previous style on every exit path (quit, Ctrl+D, /new, /reload). Pairs with [pi-output-style](https://github.com/Sokoshy/pi-output-style) for the full voice-coaching effect.
- **Privacy by design** — dev profile and topic levels never leave `~/.pi/mentor/`.
- **DIRECTIVE override** for security-critical topics — no Socratic, just the secure pattern + quiz.

---

## 📦 Requirements

- **[pi](https://pi.dev)** ≥ 0.78 (uses `ExtensionAPI`, `sendUserMessage`, `ctx.mode`, `ctx.isIdle()`)
- **[DocMancer](https://github.com/docmancer/docmancer/tree/main)** — **mandatory** for code examples with third-party libraries. The mentor blocks itself without it (use `/mentor --no-docmancer` for concepts-only mode).
- **[pi-output-style](https://github.com/Sokoshy/pi-output-style)** — *optional*, but **strongly recommended**. The mentor writes to `~/.pi/current-style`; this extension reads from it on every `before_agent_start` and injects the matching voice. Without it, the voice stays `default` and you lose the pedagogical phrasing. Install with: `pi install git:github.com/Sokoshy/pi-output-style`.

---

## 🚀 Installation

### From local source (development)

```bash
# Clone the repository
git clone https://github.com/Sokoshy/pi-horka-mentor
cd pi-horka-mentor

# Install as a local pi package
pi install .

# Verify it shows up
pi list
```

The package is declared with the `pi-package` keyword, so it is installable via any source pi understands: npm, git, local path, or raw URL.

```bash
pi install npm:@sokoslay/pi-horka-mentor          # when published to npm
pi install git:github.com/Sokoshy/pi-horka-mentor # latest default branch
pi install /absolute/path/to/pi-horka-mentor       # local
pi install ./pi-horka-mentor                       # relative
```

### Symlink mode (for active development)

If you want to hack on the source and have changes picked up live:

```bash
ln -s "$(pwd)/extensions/mentor.ts" ~/.pi/agent/extensions/mentor.ts
ln -s "$(pwd)/skills/horka-mentor" ~/.pi/agent/skills/horka-mentor
ln -s "$(pwd)/skills/horka-mentor-quiz" ~/.pi/agent/skills/horka-mentor-quiz

# Reload in pi with /reload (Cmd-R / Ctrl-R)
```

---

## 📚 Usage

### First contact — Cold Start

On first invocation, the mentor detects that no profile exists and asks 5 questions (in your language):

```
First contact. I need 5 things to adapt my approach:

1. First name?
2. Preferred language for our exchanges? (fr/en/es/de...)
3. How long have you been coding? (background: bootcamp, self-taught, CS degree, career change)
4. Current stack? (languages, frameworks, tools)
5. Current output-style? (default / learning / explanatory / learning-explanatory)
```

Once you answer, `~/.pi/mentor/dev-profile.md` is created and you can start coding.

### Commands

| Command | What it does |
|---|---|
| `/mentor` | Start a build-mode session (default — code together, explain as you go) |
| `/mentor learn` | Start a learn-mode session (deep Socratic exploration) |
| `/mentor --no-docmancer` | Pedagogical mode without DocMancer (concepts, no third-party API examples) |
| `/mentor proactif off` | Disable proactive interventions |
| `/mentor proactif on` | Re-enable proactive interventions |
| `/mentor profil` | Display your current profile |
| `/mentor topics` | List covered topics with their levels |
| `/mentor-quiz` | Auto-spaced-repetition quiz on due topics (most overdue first, max 3) |
| `/mentor-quiz <topic>` | Targeted quiz on a specific topic |
| `/mentor-quiz all` | Complete review of all covered topics |

### Proactive mode

If proactive mode is `enabled` in your profile, the mentor auto-intervenes when it detects a concept you haven't demonstrated understanding of, **up to 2 times per session**. It uses the `mentor.ts` extension to send a quiz reminder at `session_start` if you have due topics.

Disable per-session with `skip` (cooldown for the rest of the session) or permanently with `/mentor proactif off`.

---

## 🏗️ Architecture

```
pi-horka-mentor/
├── extensions/                       ← RUNTIME CODE (TypeScript)
│   └── mentor.ts                     # session_start → due-quiz reminder, sendUserMessage
├── skills/                           ← PROMPT CONTENT (Markdown)
│   ├── horka-mentor/
│   │   ├── SKILL.md                  # Teaching workflow (steps 0-5)
│   │   └── references/               # Loaded on-demand by the LLM
│   │       ├── pedagogy.md
│   │       ├── level-up-rules.md
│   │       └── memory-templates.md
│   └── horka-mentor-quiz/
│       └── SKILL.md                  # Quiz workflow (steps 0-6)
├── docmancer.yaml                    # DocMancer config
├── package.json                      # pi-package manifest (declares BOTH extensions & skills)
├── .gitignore
└── README.md
```

The split `extensions/` (code) vs `skills/` (prompts) is the standard pi package layout, and is what makes this package both a full **extension** and a **skill** package at the same time.

### File bus (zero-coupling integration)

The three components communicate via plain files in `~/.pi/`:

| File | Written by | Read by | Purpose |
|---|---|---|---|
| `~/.pi/mentor/dev-profile.md` | `horka-mentor` (cold start) | `horka-mentor`, `horka-mentor-quiz`, `mentor.ts` | Dev's name, language, stack, learning speed, proactive mode |
| `~/.pi/mentor/topics/<slug>.md` | `horka-mentor`, `horka-mentor-quiz` | same | Per-concept: level, teaching history, assessment history |
| `~/.pi/mentor/quiz-log.md` | `horka-mentor`, `horka-mentor-quiz` | `mentor.ts` | Index of upcoming reviews (interval tracking) |
| `~/.pi/mentor/.previous-style` | `mentor.ts` (`session_start` snapshot) | `mentor.ts` (`session_shutdown` restore) | Output style baseline for restore. **Owned by the extension** so the restore runs even on hard quit (Ctrl+D). |
| `~/.pi/current-style` | `horka-mentor`, `horka-mentor-quiz` (mode→style) and `mentor.ts` (restore on shutdown) | [pi-output-style](https://github.com/Sokoshy/pi-output-style) | Output style bus (peer extension — see below) |

The `mentor.ts` extension owns the save/restore of `~/.pi/current-style`. The skills only write the *current* mode's style. This split is mandatory: any save/restore executed by the LLM is a no-op on a hard quit, because the LLM does not get a turn to run bash.

### Peer extension: [pi-output-style](https://github.com/Sokoshy/pi-output-style)

The mentor and [pi-output-style](https://github.com/Sokoshy/pi-output-style) form a **two-layer pedagogical system**:

```
   ┌─────────────────────────┐
   │  horka-mentor (skill)   │  ← decides WHEN to teach, WHAT to quiz
   │  horka-mentor-quiz      │     writes ~/.pi/current-style = "learning" | "learning-explanatory"
   └────────────┬────────────┘
                │  + extension snapshots the user's previous style at session_start
                ▼
   ┌─────────────────────────┐
   │  pi-output-style (ext)  │  ← applies the voice on every turn
   │  github.com/Sokoshy/... │     reads ~/.pi/current-style at before_agent_start
   └─────────────────────────┘

   At session_shutdown (Ctrl+D, /new, /reload, ...):
   mentor.ts extension conditionally restores ~/.pi/current-style
   from ~/.pi/mentor/.previous-style (if it still looks like a mentor style)
```

**Workflow layer (this package):** the *skills* choose the pedagogical mode (`build` → `learning`, `learn`/`quiz` → `learning-explanatory`, `proactive` → unchanged, `security-critical` → unchanged). The *extension* owns save/restore around the skills so the user's original style comes back on every exit path — including Ctrl+D, where the LLM never runs the skill's "session end" block.

**Voice layer ([pi-output-style](https://github.com/Sokoshy/pi-output-style)):** reads `~/.pi/current-style` at `before_agent_start` and injects the matching voice prefix into the system prompt.

The contract is **zero code coupling** — only the shared file. The mentor never imports from pi-output-style, and vice versa.

#### Why save/restore lives in the extension, not the skill

A previous version of this package had the save+restore as inline bash inside the skill's markdown. The LLM would run the restore at the end of a session. That worked for "natural" session ends (the user said goodbye, the LLM replied) but **silently failed on Ctrl+D, SIGHUP, SIGTERM, /reload, /new, /resume, /fork** — none of which give the LLM a turn to run bash. The user had to manually run `/style default` after every quit. The fix is to move the restore into the `mentor.ts` extension, where the `session_shutdown` event is guaranteed to fire on every runtime teardown. The skill is now reduced to a one-line `echo "$mode_style" > ~/.pi/current-style`; everything session-scoped is the extension's job.

**Mode-to-style summary** (mentor → pi-output-style):

| Mentor state | Value written to `~/.pi/current-style` |
|---|---|
| `/mentor` (build) | `learning` |
| `/mentor learn` | `learning-explanatory` |
| `/mentor-quiz` | `learning-explanatory` |
| Proactive intervention | *(no write — keep current)* |
| Security-critical topic | *(no write — keep current)* |
| Session end | *(handled by `mentor.ts` `session_shutdown` — not the skill)* |

### Source of truth hierarchy

In case of desync between index files and topic files:
1. **Topic files** (`~/.pi/mentor/topics/<slug>.md`) are the source of truth.
2. **Quiz log** (`~/.pi/mentor/quiz-log.md`) is a convenience index.
3. **Dev profile** is the only file the extension reads (for proactive-mode + cold-start detection).

---

## 🔒 Security & Privacy

- **Local-only memory.** All profiles, topics, and quiz logs stay in `~/.pi/mentor/`. Nothing is sent to any server.
- **No telemetry.** The extension does not call `fetch`, `https`, or any network API.
- **DocMancer is the only external dependency** for documentation lookups — and it is fully local if you index your docs locally.
- **Security-critical topics trigger DIRECTIVE mode**: the mentor never uses Socratic for subjects like auth, secrets, injection — it shows the secure pattern, the vulnerable anti-pattern, and a quiz, in that order.

---

## 🛠️ Development

### Repo layout conventions

This project follows the [pi package conventions](https://pi.dev/docs/latest/packages):

- `extensions/` — TypeScript files, auto-discovered by pi.
- `skills/<name>/SKILL.md` — frontmatter `name` + markdown body. Reference files in `references/`.
- `package.json` with `pi` manifest + `pi-package` keyword.
- No build step required — extensions are loaded via [jiti](https://github.com/unjs/jiti), and skills are plain markdown.

### Linting the SKILL.md frontmatter

Names must match `^[a-z0-9-]{1,64}$` (no leading/trailing hyphens, no consecutive hyphens).
Descriptions must be ≤ 1024 chars. Use `allowed-tools: Read Write Edit Glob Bash` (space-delimited, per the Agent Skills spec).

### Testing

```bash
# Run pi with the package loaded directly
pi --extension ./extensions/mentor.ts \
   --skill ./skills/horka-mentor \
   --skill ./skills/horka-mentor-quiz

# Or after `pi install .`, just relaunch pi
pi
```

#### Regression test for the output-style restore

`scripts/test-snapshot-restore.mjs` replays the snapshot/switch/restore file operations from the extension in isolation (no pi required) and covers the 10 cases that motivated moving the restore from the skill into the extension: cold start with no /mentor, /mentor then Ctrl+D, manual `/style default` mid-session, /mentor twice in the same session, `/new`, peer extension absent, etc.

```bash
node scripts/test-snapshot-restore.mjs
```

The test uses a temp directory and writes nothing under `~/.pi/`, so it's safe to run anywhere.

---

## 🤝 Related projects

- **[pi](https://pi.dev)** — the coding-agent harness this extends.
- **[pi-output-style](https://github.com/Sokoshy/pi-output-style)** — peer extension that reads the voice bus. No code coupling. **Install this for the full mentor experience.**
- **[DocMancer](https://github.com/docmancer/docmancer/tree/main)** — local documentation index used for code-example verification.
- **[Horka](https://github.com/joey-barbier/ClaudeCode-Plugin/tree/main/plugins/horka-mentor)** — the upstream mentor (Claude-Code / non-pi original).

### Recommended companion setup

For the full pedagogical effect, install both this package and [pi-output-style](https://github.com/Sokoshy/pi-output-style):

```bash
# The mentor (this package)
pi install git:github.com/Sokoshy/pi-horka-mentor

# The voice layer (peer extension, required for output-style integration)
pi install git:github.com/Sokoshy/pi-output-style

# Verify both are loaded
pi list
```

With both installed, the mentor will automatically switch the voice to `learning` / `learning-explanatory` during sessions and restore your previous style on exit.

---

## 📝 License

MIT — see `LICENSE` (add one before publishing to npm).

---

## 🙏 Credits

- **Horka mentor** (original concept and pedagogy rules) — [Horka](https://github.com/joey-barbier/ClaudeCode-Plugin/tree/main/plugins/horka-mentor).
- **pi** team at Earendil Works — for the extension/skill architecture.
- **[Sokoshy](https://github.com/Sokoshy)** — author of [pi-output-style](https://github.com/Sokoshy/pi-output-style), the voice-layer peer extension that makes the pedagogical voice switch visible to the user.
- **[Sokoshy](https://github.com/Sokoshy)** — author of [DocMancer](https://github.com/docmancer/docmancer/tree/main), the local documentation index that gates every code example.
