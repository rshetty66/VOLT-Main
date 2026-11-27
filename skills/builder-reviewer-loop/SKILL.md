---
name: builder-reviewer-loop
description: "Run ongoing work as a self-prompting loop instead of prompting every step. Use when work repeats across days: a builder session picks up issues from a backlog, a reviewer session checks pull requests, and a coordinator session takes your steering mid-process. Includes the watch-skill contracts, caps, gates, and the three steps to start."
---

# Stop Prompting the Model. Build the Loop That Does.

Source: Daniel Williams, "Stop Prompting the Model. Build the Loop That Does." (Claude Code for Non-Coders, Oct 15, 2026). Distilled from the article, not copied from it.

## When to use it

Prompting is right for a one-off task. For ongoing work, build a loop that prompts itself and leaves a line back to you while it runs.

## The three sessions

- **Builder.** Watches the issue list and picks up the next item once the previous one has merged. Start it with `/builder-watch`.
- **Reviewer.** Watches for pull requests labeled ready for review, reads each one, fixes what it can, hands back what it can't. Start it with `/reviewer-watch`. Never let one session both build and review: an agent reviewing its own work is not a second opinion.
- **Coordinator.** One session that can message the builder and reviewer. You steer through it: it passes your comment on, updates issues, or pauses and redirects the work. Add it once you trust the loop.

## State and caps

- Labels on each pull request are the loop's state, so either agent resumes after a restart.
- Cap hand-backs at three per pull request; after three, stop and notify the owner.
- Cap work in progress at three.
- Set the caps before running overnight, not after.

## Context the loop runs on

A short instruction file read at session start; memory the agents write as plain files; skills loaded only when relevant; and dreaming, a separate process that reads transcripts, spots repeated mistakes and proposes memory changes a person accepts or rejects. Rule: do the simple thing that works.

## Where you add value

Your input can come at any point, while work is cheap to redirect, through the coordinator, instead of only at the start or the end.

## Gates

- **Scope.** Set in the issues; change any time through the coordinator.
- **Proof.** For anything rendered, produce a short proof first (5-8 seconds of video, one page, one slide); approve or redirect before the full render.

## Start in three steps

1. Write a short instruction file and a list of issues, each with a "done when" list you could check yourself. If you cannot write it, the work is not ready for any agent.
2. Split the work between two sessions, one builds and one reviews, with a shared state place (PR labels) and caps they cannot argue with.
3. Add the coordinator, and decide where your gates are.

## What you still do

Decide what the work is for, write down what done looks like, and notice when it should change.

## Source

- Daniel Williams, Claude Code for Non-Coders: https://claudecodefornoncoders.substack.com/p/stop-prompting-the-model-build-the
