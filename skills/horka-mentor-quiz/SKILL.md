---
name: horka-mentor-quiz
allowed-tools: Read Write Edit Glob Bash
description: >
  Quiz and review skill for the mentor system (pi port). Tests retention on previously covered topics
  using spaced repetition. Question types: predict output, spot the bug, explain in your words,
  MCQ (last resort). Reads from ~/.pi/mentor/ to know what topics exist and what's due for review.
  Updates topic levels based on results (solid = level up, missed = level down, shaky = stay).
  Activates output-style `learning-explanatory` on invocation, restores previous style at session end.
  Invoke when user says "mentor quiz", "quiz", "revision", "teste-moi", "review mes sujets".
  Do NOT use if no topics have been covered yet (no files in ~/.pi/mentor/topics/).
---

# Mentor Quiz — Revision & Retention Check (pi port)

## Step 0 — DocMancer Gate (soft for the quiz)

Attempt `docmancer list`:

- **If available** (exit 0, any output): use DocMancer to build questions with up-to-date code.
- **If unavailable**: the quiz continues WITHOUT blocking. Automatically limit to:
  - "Explain in your words" (no code needed)
  - "Predict output" and "spot bug" only with native language APIs (no third-party libs)
  - Display a warning at the start of the quiz: `[DocMancer unavailable — questions limited to concepts and native APIs]`

Unlike /mentor, the quiz does NOT block without DocMancer because "explain" questions don't need any specific code.

## Output-Style Integration (pi-specific)

At the START of the quiz, save the current style and activate `learning-explanatory`:

```bash
PREVIOUS_STYLE=$(cat ~/.pi/current-style 2>/dev/null || echo "default")
echo "$PREVIOUS_STYLE" > ~/.pi/mentor/.previous-style
echo "learning-explanatory" > ~/.pi/current-style
```

At the END of the quiz (after the session summary), restore conditionally:

```bash
CURRENT=$(cat ~/.pi/current-style 2>/dev/null || echo "default")
PREVIOUS=$(cat ~/.pi/mentor/.previous-style 2>/dev/null || echo "default")

case $CURRENT in
  learning|learning-explanatory)
    echo "$PREVIOUS" > ~/.pi/current-style
    echo "Style restored to: $PREVIOUS"
    ;;
  *)
    echo "User changed style manually to: $CURRENT (keeping it)"
    ;;
esac
```

This integrates with the user's `pi-output-style` extension via the same `~/.pi/current-style` bus as the main `/mentor` skill. Zero code coupling — only a shared file.

## Step 1 — Prerequisites Check

1. **Verify** that `~/.pi/mentor/dev-profile.md` exists. If not:
```
No mentor profile. Run /mentor first to create your profile and cover your first topics.
```
STOP.

2. **Read** `~/.pi/mentor/dev-profile.md` for the language.

3. **Scan** `~/.pi/mentor/topics/` — list all files.

4. If no files in topics/:
```
No topics covered yet. Use /mentor during your dev to build your knowledge base, then come back here to review.
```
STOP.

## Step 2 — Quiz Mode Selection

### Invocation without argument: `/mentor-quiz`

**Automatic spaced repetition** — selects topics whose `next_review` date is past or today.

1. **Scan topic files** in `~/.pi/mentor/topics/` — read the Status section of each file to find `next_review` (source of truth = topic files, not quiz-log)
2. Filter topics where `next_review <= today`
3. If no topic due: "Nothing to review today. Next review: [date of next topic]."
4. If topics are due: select the 3 most urgent (most overdue first)

### Invocation with subject: `/mentor-quiz async`

**Targeted quiz** on one or more specific subjects.

1. Look for the topic in `~/.pi/mentor/topics/`
2. If not found: "I have no record that we covered '[subject]'. Do you want to tackle it with /mentor first?"
3. If found: quiz on this topic, regardless of the next_review date

### Invocation full: `/mentor-quiz all`

**Complete review** of all covered topics. Useful for a periodic assessment.

## Step 3 — Question Generation

For each topic to quiz:

### Question type selection

Adapt the type to the nature of the concept AND the current level:

| Current level | Preferred type | Example |
|-------------|-------------|---------|
| learning | predict output, spot bug | Concrete code, practical verification |
| understood | explain in your words | Verify deep understanding |
| confident | edge case, common pitfall | Challenge to confirm mastery |

### Question construction

1. **Read** the topic file to see the teaching history (which analogies, examples were used)
2. **DO NOT REPEAT** the same question as last time (consult Assessment History)
3. **Use DocMancer** to build examples with up-to-date code (except `--no-docmancer` mode)
4. **Adapt** difficulty to the current level

### Question format

```
QUIZ — [Concept name] ([current level])

[The question — always open, never yes/no]

[If code: code block to analyze]

Take your time to answer.
```

**Wait for the answer. Do NOT give the answer before the dev has answered.**

## Step 4 — Answer Evaluation

After the dev's answer, evaluate in 3 categories:

### Solid
- The answer is correct and shows real understanding
- The dev can explain the WHY, not just the WHAT
- Relevant examples or clear reformulation

**Reaction**: "Correct. [Short precision if useful]."
No flattery. No "Bravo!" or "Excellent!". Factual.

### Shaky
- The answer is partially correct
- The dev has the general idea but is missing a key element
- Confusion between similar concepts

**Reaction**: "Almost. [What's missing or imprecise]. [Short explanation of the missing part]."
Propose a different angle: "Put another way: [reformulation]."

### Missed
- The answer is incorrect or the dev doesn't know how to answer
- Fundamental confusion about the concept

**Reaction**: "Not quite. [Correct explanation, brief]. [Why it matters]."
Propose to revisit: "We should pick this up with /mentor next time you work on [domain]."

## Step 5 — Memory Update (MANDATORY after each quiz)

### 1. Update the topic file

In `~/.pi/mentor/topics/<concept>.md`:

- Add an entry in Assessment History:
  ```
  ### [YYYY-MM-DD]
  - Type: [predict-output | spot-bug | explain | mcq]
  - Question: [the question asked]
  - Answer quality: [solid | shaky | missed]
  - Notes: [what was misunderstood, if applicable]
  ```

- Update the Level according to the rules:

| Result | Current level | New level |
|----------|-------------|------------|
| solid | learning | understood |
| solid | understood | confident |
| solid | confident | confident (maintain) |
| shaky | learning | learning (maintain) |
| shaky | understood | understood (maintain) |
| shaky | confident | confident (maintain, but watch) |
| missed | learning | learning (maintain, re-teach) |
| missed | understood | learning (regression) |
| missed | confident | understood (regression) |

- Update `last_assessed` to today

### 2. Update the quiz-log

In `~/.pi/mentor/quiz-log.md`:

- Add the entry in History
- Recalculate `next_review` in Upcoming Reviews:

| Result | New interval |
|----------|--------------|
| solid | Advance to the next step: J+1 → J+3 → J+7 → J+14 → J+30 → every 30d |
| shaky | Keep the same interval (no advancement) |
| missed | Reset to J+1 (restart the cycle) — EXCEPT after 3 consecutive missed on the same topic (see below) |

**Cap on consecutive missed**: after 3 "missed" consecutive on the same topic, the quiz stops resetting to J+1. Instead:
1. Mark the topic as `needs-reteach` in the notes of the topic file
2. Set the interval to J+3 (avoid daily quiz fatigue on a misunderstood subject)
3. Recommend a dedicated `/mentor` session in the summary
4. Note in the quiz-log: "3 consecutive missed — re-teach required before re-quizzing"

**Source of truth**: in case of desynchronization between `quiz-log.md` and the topic files, the **topic files take precedence**. The quiz-log is a convenience index.

**Interval tracking**: in the quiz-log Upcoming Reviews, store the interval step in addition to the date (e.g., `interval_step: 3` = J+7) to avoid ambiguity on "what is the next step".

### 3. Update the profile (if relevant)

If the quiz reveals a change in learning speed on a domain, update `dev-profile.md`.

## Step 6 — Session Summary

After the last topic of the quiz, display a summary:

```
QUIZ SUMMARY — [date]

[topic 1]: [solid|shaky|missed] → [current level] (next review: [date])
[topic 2]: [solid|shaky|missed] → [current level] (next review: [date])
...

[If any topics are "missed":]
Topics to review with /mentor: [list]

[If all solid:]
All topics are solid. Next review scheduled.
```

## Adaptive Format

- **Language**: reply in the profile's language
- **Tone**: factual, not school-like. No grades /20, no "Bravo", no "You can do better"
- **Length**: short questions, short feedback. A quiz should be quick (< 2 min per question)

## Absolute Rules

1. **NEVER yes/no questions.** Same anti-gaming rules as /mentor
2. **NEVER give the answer before the dev has answered.** Wait. Always.
3. **NEVER skip the memory update.** Every quiz MUST be traced
4. **NEVER repeat the same question** as last time on the same topic
5. **NEVER condescending tone.** "Missed" is not a failure, it's information
6. **ALWAYS propose /mentor** when a topic is "missed" — the quiz detects, the mentor re-teaches
7. **Use DocMancer when available** for code examples with third-party libs. Without DocMancer, limit to native APIs and conceptual questions (the quiz does NOT block without DocMancer)
