# Setlist Selection Algorithm

## Goal

Maximize the number of unique musicians represented in the final set while respecting the event main-set song limit. Known pre-formed bands are de-prioritized only as a tie-break after unique-participant coverage has been prioritized.

## Inputs

- Candidate tracks for the event
- Unique filled participant set per track
- Previous published event songs
- Known-group registry
- Event max main-set song count
- Event minimum participants per track
- Legacy minute-based limits normalized into a safe track-count fallback for older events

## Rules

1. Songs from the previous concert are excluded from selection.
2. Tracks with unfilled required seats are excluded from the final-set candidate pool.
3. Tracks whose unique participant count is below the event minimum are excluded from the final-set candidate pool.
4. The optimizer evaluates candidate combinations within the main-set song-count budget and chooses a coverage-first recommendation.
5. If multiple combinations cover the same number of unique participants, ties prefer filling more main-set slots, then organic lineups over known groups, then higher seat fullness, then stable creation order.
6. Eligible tracks not selected become backlog items with reasons. Previous-concert repeats also become backlog items with repeat-specific reasons.

## Output

- Ordered main set recommendation
- Ordered backlog recommendation
- Coverage count and human-readable reasons for admin review

## Scalability model

The underlying problem is a variation of maximum coverage with constraints. Small and moderate candidate pools use deterministic dynamic programming over track combinations, which preserves the exact maximum unique-participant coverage guarantee when the estimated state space is bounded.

Large candidate pools switch to a bounded deterministic selector that greedily maximizes new participant coverage, then applies local swaps using the same coverage-first comparator. This avoids materializing every coverage-mask combination, which can grow combinatorially on real gig data and exhaust the Node.js heap. Secondary ranking still keeps the result explainable and predictable for admin workflows.
