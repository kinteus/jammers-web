# Setlist Selection Algorithm

## Goal

Maximize the number of unique musicians represented in the final set while respecting the event duration limit and de-prioritizing known pre-formed bands.

## Inputs

- Candidate tracks for the event
- Filled participant set per track
- Song duration
- Previous published event songs
- Known-group registry
- Event max set duration

## Rules

1. Songs from the previous concert are excluded from selection.
2. Tracks with zero participants are ignored.
3. Organically assembled lineups rank above known-group matches.
4. Remaining tracks are scored by marginal new-participant coverage, seat fullness, and duration efficiency.
5. Tracks that fit the budget go into the main set.
6. Tracks that overflow the budget or are excluded become backlog items with reasons.

## Output

- Ordered main set recommendation
- Ordered backlog recommendation
- Coverage count and human-readable reasons for admin review

## Why greedy coverage-first

The underlying problem is a variation of weighted maximum coverage with constraints. A greedy marginal-coverage strategy is deterministic, explainable, fast enough for admin workflows, and easy to tune without hiding the decision logic from operators.
