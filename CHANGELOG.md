# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-06-05

### Added

- Added `scripts/test-snapshot-restore.mjs` for regression testing of output-style snapshot/restore mechanism
- Added comprehensive architecture documentation in README
- Added Table of Contents, Quick Start, Development Setup, and Contributing sections to README

### Changed

- Improved README structure with badges, architecture section, and development setup guide
- Enhanced installation instructions with multiple methods (git, local path, npm)

### Fixed

- Minor documentation typos and formatting

## [0.1.0] - 2026-06-03

### ⚠️ BREAKING CHANGES

#### Output-Style Snapshot/Restore Moved to Extension Layer

**Before:** The output-style snapshot and restore logic was implemented inline in the skill's markdown as bash commands. This approach had a critical flaw: on hard quit (Ctrl+D, SIGHUP, SIGTERM, /new, /resume, /fork, /reload), the LLM never got a turn to execute the restore, leaving `~/.pi/current-style` pinned on `learning` or `learning-explanatory`.

**After:** The snapshot and restore mechanism is now fully handled by the `extensions/mentor.ts` extension:
- `session_start`: Snapshots current style to `~/.pi/mentor/.previous-style`
- `session_shutdown`: Restores the snapshot if current style is a mentor style

**Migration:** No action required for end users. The extension handles this transparently.

**For contributors:** Do NOT re-add LLM-executed restore commands in the skill markdown. The extension layer is the only place where restore is guaranteed to run.

#### Skill Description Size Constraint

The skill description in `SKILL.md` frontmatter must now be under 1024 characters (was previously 1030 characters). This is a hard limit enforced by pi's skill registration system.

**Impact:** Skill descriptions have been trimmed to preserve essential upstream semantics while removing port-internal implementation details.

### ✨ Features

#### Core Teaching System

- **Socratic Pedagogy**: Open questions only (`predict-output`, `spot-bug`, `explain-in-your-words`). No yes/no questions allowed.
- **Two Teaching Modes**:
  - `build` (default): Code together with the dev, max 1 question per intervention, explain-as-you-go
  - `learn`: Deep Socratic exploration with full question sequences
- **Concept Analysis**: Auto-detects new concepts in the dev's code and assesses understanding
- **Level Progression**: `unknown → learning → understood → confident` with spaced repetition intervals (J+1, J+3, J+7, J+14, J+30)
- **Proactive Mode**: Auto-detects concepts the dev hasn't covered and intervenes with a question (max 2 per session)
- **DIRECTIVE Override**: Security-critical topics bypass Socratic method — direct secure pattern + quiz

#### DocMancer Integration

- **Documentation Gate**: Refuses to teach third-party framework APIs without verified official docs via DocMancer
- **Fallback Mode**: `--no-docmancer` flag for concept-only teaching without framework-specific examples
- **Soft Gate for Quiz**: Quiz continues without DocMancer but limits to concept questions and native APIs

#### Memory & Privacy

- **Local-Only Storage**: Dev profile and topic levels stored in `~/.pi/mentor/` — never leaves the machine
- **Topic Memory**: Persistent tracking of all covered topics with current levels
- **Learning Speed Memory**: Adapts to individual dev's pace
- **Quiz Log**: Markdown-based index at `~/.pi/mentor/quiz-log.md` for spaced repetition tracking

#### Output Style Integration

- **pi-output-style Integration**: Mentor writes voice mode (`learning` / `learning-explanatory`) to `~/.pi/current-style`
- **Automatic Restore**: Extension restores previous output style on session end
- **Respects Manual Changes**: If dev manually changes style mid-session, that change is preserved

#### Quiz System

- **Spaced Repetition Quiz**: `/mentor-quiz` command for reviewing due topics
- **Topic-Specific Quiz**: `/mentor-quiz [topic]` to focus on specific areas
- **Full Review**: `/mentor-quiz all` for comprehensive review
- **Question Types**:
  - Predict output (given code, what happens?)
  - Spot the bug (find the error)
  - Explain in your words (conceptual understanding)
  - MCQ (last resort, only when other types don't fit)

### 🔧 Technical Architecture

#### Extension Layer (`extensions/mentor.ts`)

- **Session Start Hook**: Checks for due quiz topics and sends reminder via `pi.sendUserMessage()`
- **Session Shutdown Hook**: Restores output-style snapshot
- **Proactive Detection**: Reads `~/.pi/mentor/dev-profile.md` to check if proactive mode is enabled
- **Quiz Due Date Parser**: Parses `~/.pi/mentor/quiz-log.md` to find topics with `next_review` ≤ today
- **Context Mode Guard**: Skips execution in non-interactive modes (`print`, `json`)

#### Skill Layer (`skills/horka-mentor/`)

- **Main Teaching Workflow**: Socratic pedagogy implementation with two modes
- **Reference Documents**:
  - `pedagogy.md`: Teaching philosophy and question patterns
  - `level-up-rules.md`: Criteria for level progression
  - `memory-templates.md`: File format templates for memory storage

#### Quiz Skill Layer (`skills/horka-mentor-quiz/`)

- **Quiz Workflow**: Spaced repetition review implementation
- **Level Updates**: Adjusts topic levels based on quiz performance
- **Quiz Log Updates**: Maintains `~/.pi/mentor/quiz-log.md` with next review dates

### 📦 Packaging

- **pi Package Format**: Installable via `pi install` with multiple source formats (npm, git, local path, raw URL)
- **Package Manifest**: `package.json` with `pi` manifest and `pi-package` keyword for gallery discoverability
- **File Structure**:
  - `extensions/`: TypeScript extension for session hooks
  - `skills/`: Markdown-based skill definitions
  - `docmancer.yaml`: DocMancer index configuration
  - `scripts/`: Development and testing utilities

### 📚 Documentation

- **Comprehensive README**: Installation, usage, architecture, and development setup
- **Inline Documentation**: Extensive comments in `extensions/mentor.ts`
- **Skill Documentation**: Detailed step-by-step workflows in SKILL.md files

### 🐛 Bug Fixes

- **Output-Style Restore on Hard Quit**: Fixed issue where `~/.pi/current-style` stayed pinned on mentor styles after hard quit (Ctrl+D, SIGTERM, etc.)
- **Skill Description Size**: Reduced skill description from 1030 to under 1024 characters to comply with pi's registration limit

### 🔒 Security & Privacy

- **No External Data Transmission**: All mentor data stays local in `~/.pi/mentor/`
- **DocMancer Verification**: Prevents teaching outdated or incorrect API patterns
- **DIRECTIVE Compliance**: Security-critical topics follow mandatory DIRECTIVE overrides

### 🤝 Companion Packages

- **pi-output-style**: Recommended companion for voice mode integration
- **DocMancer**: Required for framework-specific code examples

---

## Version History

- **0.1.0** (2024-06-03): Initial release with full Socratic teaching system, spaced repetition quiz, DocMancer integration, and output-style management

[Unreleased]: https://github.com/Sokoshy/pi-horka-mentor/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/Sokoshy/pi-horka-mentor/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/Sokoshy/pi-horka-mentor/releases/tag/v0.1.0
