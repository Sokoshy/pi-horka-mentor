# pi-horka-mentor

Teaching AI mentor for junior developers — a pi port of the [Horka mentor](https://github.com/joey-barbier/ClaudeCode-Plugin/tree/main/plugins/horka-mentor).
Socratic pedagogy, spaced-repetition quizzes, and Context-gated code examples.

## Features

- **Socratic pedagogy** — open questions only (`predict-output`, `spot-bug`, `explain-in-your-words`). No yes/no.
- **Two teaching modes** — `build` (code together, 1 question max) and `learn` (deep exploration).
- **Context gate** — refuses to teach third-party framework APIs without verified official docs via [Context](https://github.com/neuledge/context) (MCP docs server).
- **Spaced repetition** — topic-level memory with `unknown → learning → understood → confident` progression and J+1, J+3, J+7, J+14, J+30 intervals.
- **Proactive mode** — auto-detects concepts the dev hasn't covered and intervenes with a question (max 2/session).
- **Privacy by design** — dev profile and topic levels never leave `~/.pi/mentor/`.
- **DIRECTIVE override** for security-critical topics — no Socratic, just the secure pattern + quiz.

## Architecture

```
pi-horka-mentor/
├── extensions/
│   └── mentor.ts          # Session hooks: quiz reminders, proactive detection
├── skills/
│   ├── horka-mentor/      # Main teaching skill (Socratic pedagogy, 2 modes)
│   │   ├── SKILL.md
│   │   └── references/    # pedagogy, level-up-rules, memory-templates
│   └── horka-mentor-quiz/ # Spaced-repetition quiz skill
│       └── SKILL.md
├── package.json
└── CHANGELOG.md
```

**Data lives in** `~/.pi/mentor/` (dev profile, topic files, quiz log) — never leaves the machine.

**External dependency**: [Context](https://github.com/neuledge/context) provides up-to-date documentation via MCP. Without it, the mentor is limited to pure pedagogy (concepts, pseudocode, analogies) — no framework-specific code examples.

## Requirements

- [pi](https://pi.dev) ≥ 0.78
- [Context](https://github.com/neuledge/context) — MCP server providing up-to-date documentation for code examples with third-party libraries

## Installation

```bash
pi install git:github.com/Sokoshy/pi-horka-mentor
```

Or install locally for a single project:

```bash
pi install git:github.com/Sokoshy/pi-horka-mentor -l
```

## Remove

```bash
pi remove git:github.com/Sokoshy/pi-horka-mentor
```

Or for a local install:

```bash
pi remove git:github.com/Sokoshy/pi-horka-mentor -l
```

## Usage

| Command | Action |
|---------|--------|
| `/mentor` | Start mentor in build mode (default) |
| `/mentor learn` | Start mentor in learn mode |
| `/mentor --no-context` | Start without Context — concepts only, no framework-specific code examples |
| `/mentor proactif on/off` | Enable/disable proactive interventions |
| `/mentor profil` | Show your current profile |
| `/mentor topics` | List all covered topics with levels |
| `/mentor-quiz` | Run spaced repetition quiz |
| `/mentor-quiz [topic]` | Quiz on a specific topic |
| `/mentor-quiz all` | Full review of all topics |

## Credits

- Original plugin by [joey-barbier](https://github.com/joey-barbier) (HORKA_TV)
- Ported to pi format
