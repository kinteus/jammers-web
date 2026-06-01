import { SetlistSection } from "@prisma/client";

type CandidateTrack = {
  id: string;
  songId: string;
  songTitle: string;
  artistName: string;
  hasUnfilledRequiredSeats?: boolean;
  participantIds: string[];
  filledSeatRatio: number;
  createdAt: Date;
  matchedKnownGroupName: string | null;
};

type NormalizedCandidateTrack = CandidateTrack & {
  uniqueParticipantIds: string[];
  participantMask: bigint;
};

const EXACT_DP_STATE_LIMIT = 250_000;

export type SelectionInput = {
  maxSetTrackCount: number;
  minParticipantsPerTrack?: number;
  previousConcertSongIds: Set<string>;
  candidates: CandidateTrack[];
};

export type SelectionResult = {
  selected: Array<{
    trackId: string;
    orderIndex: number;
    section: SetlistSection;
    reasons: string[];
  }>;
  backlog: Array<{
    trackId: string;
    section: SetlistSection;
    reasons: string[];
  }>;
  coverageCount: number;
};

function bitCount(mask: bigint) {
  let count = 0;
  let remaining = mask;

  while (remaining > 0n) {
    count += Number(remaining & 1n);
    remaining >>= 1n;
  }

  return count;
}

function getSelectionMask(selection: NormalizedCandidateTrack[]) {
  return selection.reduce((mask, track) => mask | track.participantMask, 0n);
}

function compareTrackTieBreak(left: NormalizedCandidateTrack, right: NormalizedCandidateTrack) {
  if (Boolean(left.matchedKnownGroupName) !== Boolean(right.matchedKnownGroupName)) {
    return left.matchedKnownGroupName ? 1 : -1;
  }

  if (left.filledSeatRatio !== right.filledSeatRatio) {
    return right.filledSeatRatio - left.filledSeatRatio;
  }

  const createdAtDelta = left.createdAt.getTime() - right.createdAt.getTime();

  if (createdAtDelta !== 0) {
    return createdAtDelta;
  }

  return left.id.localeCompare(right.id);
}

function compareSelectionTieBreak(
  left: NormalizedCandidateTrack[],
  right: NormalizedCandidateTrack[],
) {
  const leftOrganicCount = left.filter((track) => !track.matchedKnownGroupName).length;
  const rightOrganicCount = right.filter((track) => !track.matchedKnownGroupName).length;

  if (leftOrganicCount !== rightOrganicCount) {
    return rightOrganicCount - leftOrganicCount;
  }

  const leftFullness = left.reduce((total, track) => total + track.filledSeatRatio, 0);
  const rightFullness = right.reduce((total, track) => total + track.filledSeatRatio, 0);

  if (leftFullness !== rightFullness) {
    return rightFullness - leftFullness;
  }

  const leftSorted = [...left].sort(compareTrackTieBreak);
  const rightSorted = [...right].sort(compareTrackTieBreak);

  for (let index = 0; index < Math.min(leftSorted.length, rightSorted.length); index += 1) {
    const trackComparison = compareTrackTieBreak(leftSorted[index]!, rightSorted[index]!);

    if (trackComparison !== 0) {
      return trackComparison;
    }
  }

  return rightSorted.length - leftSorted.length;
}

function isSelectionBetter(
  candidateSelection: NormalizedCandidateTrack[],
  currentSelection: NormalizedCandidateTrack[] | null,
) {
  if (!currentSelection) {
    return true;
  }

  const candidateCoverage = bitCount(getSelectionMask(candidateSelection));
  const currentCoverage = bitCount(getSelectionMask(currentSelection));

  if (candidateCoverage !== currentCoverage) {
    return candidateCoverage > currentCoverage;
  }

  if (candidateSelection.length !== currentSelection.length) {
    return candidateSelection.length > currentSelection.length;
  }

  return compareSelectionTieBreak(candidateSelection, currentSelection) < 0;
}

function findOptimalSelection(
  candidates: NormalizedCandidateTrack[],
  maxSetTrackCount: number,
) {
  const slotLimit = Math.max(0, Math.round(maxSetTrackCount));
  const statesByCount = Array.from(
    { length: Math.min(slotLimit, candidates.length) + 1 },
    () => new Map<bigint, NormalizedCandidateTrack[]>(),
  );

  statesByCount[0]!.set(0n, []);

  for (const candidate of candidates) {
    for (let count = statesByCount.length - 2; count >= 0; count -= 1) {
      const sourceStates = [...statesByCount[count]!.entries()];

      for (const [mask, selection] of sourceStates) {
        const nextMask = mask | candidate.participantMask;
        const nextSelection = [...selection, candidate];
        const existingSelection = statesByCount[count + 1]!.get(nextMask) ?? null;

        if (isSelectionBetter(nextSelection, existingSelection)) {
          statesByCount[count + 1]!.set(nextMask, nextSelection);
        }
      }
    }
  }

  let bestSelection: NormalizedCandidateTrack[] | null = null;

  for (const states of statesByCount) {
    for (const selection of states.values()) {
      if (isSelectionBetter(selection, bestSelection)) {
        bestSelection = selection;
      }
    }
  }

  return bestSelection ?? [];
}

function canUseExactDynamicProgramming(candidateCount: number, slotLimit: number) {
  const boundedSlotLimit = Math.min(slotLimit, candidateCount);
  let totalStates = 1;
  let combinationsAtCount = 1;

  for (let count = 1; count <= boundedSlotLimit; count += 1) {
    combinationsAtCount = (combinationsAtCount * (candidateCount - count + 1)) / count;
    totalStates += combinationsAtCount;

    if (totalStates > EXACT_DP_STATE_LIMIT) {
      return false;
    }
  }

  return true;
}

function findBoundedSelection(candidates: NormalizedCandidateTrack[], maxSetTrackCount: number) {
  const slotLimit = Math.min(Math.max(0, Math.round(maxSetTrackCount)), candidates.length);
  const selected: NormalizedCandidateTrack[] = [];
  const selectedIds = new Set<string>();
  let coveredMask = 0n;

  while (selected.length < slotLimit) {
    let bestCandidate: NormalizedCandidateTrack | null = null;
    let bestCandidateGain = -1;

    for (const candidate of candidates) {
      if (selectedIds.has(candidate.id)) {
        continue;
      }

      const coverageGain = bitCount(candidate.participantMask & ~coveredMask);
      const candidateSelection = [...selected, candidate];
      const bestSelection = bestCandidate ? [...selected, bestCandidate] : null;

      if (
        coverageGain > bestCandidateGain ||
        (coverageGain === bestCandidateGain && isSelectionBetter(candidateSelection, bestSelection))
      ) {
        bestCandidate = candidate;
        bestCandidateGain = coverageGain;
      }
    }

    if (!bestCandidate) {
      break;
    }

    selected.push(bestCandidate);
    selectedIds.add(bestCandidate.id);
    coveredMask |= bestCandidate.participantMask;
  }

  let improved = true;

  while (improved) {
    improved = false;

    for (let selectedIndex = 0; selectedIndex < selected.length; selectedIndex += 1) {
      for (const candidate of candidates) {
        if (selectedIds.has(candidate.id)) {
          continue;
        }

        const swappedSelection = selected.map((track, index) =>
          index === selectedIndex ? candidate : track,
        );

        if (isSelectionBetter(swappedSelection, selected)) {
          selectedIds.delete(selected[selectedIndex]!.id);
          selected[selectedIndex] = candidate;
          selectedIds.add(candidate.id);
          improved = true;
          break;
        }
      }

      if (improved) {
        break;
      }
    }
  }

  return selected;
}

function findSelection(candidates: NormalizedCandidateTrack[], maxSetTrackCount: number) {
  const slotLimit = Math.max(0, Math.round(maxSetTrackCount));

  if (canUseExactDynamicProgramming(candidates.length, slotLimit)) {
    return findOptimalSelection(candidates, maxSetTrackCount);
  }

  return findBoundedSelection(candidates, maxSetTrackCount);
}

function orderSelectedTracks(selection: NormalizedCandidateTrack[]) {
  const ordered: NormalizedCandidateTrack[] = [];
  const remaining = [...selection];
  let coveredMask = 0n;

  while (remaining.length > 0) {
    remaining.sort((left, right) => {
      const leftNewCoverage = bitCount(left.participantMask & ~coveredMask);
      const rightNewCoverage = bitCount(right.participantMask & ~coveredMask);

      if (leftNewCoverage !== rightNewCoverage) {
        return rightNewCoverage - leftNewCoverage;
      }

      return compareTrackTieBreak(left, right);
    });

    const next = remaining.shift();

    if (!next) {
      break;
    }

    coveredMask |= next.participantMask;
    ordered.push(next);
  }

  return ordered;
}

function marginalScore(track: NormalizedCandidateTrack, coveredUsers: Set<string>) {
  const newParticipants = track.uniqueParticipantIds.filter((id) => !coveredUsers.has(id));
  const coverageGain = newParticipants.length * 100;
  const fullnessBonus = Math.round(track.filledSeatRatio * 25);
  const organicBonus = track.matchedKnownGroupName ? -30 : 12;

  return {
    value: coverageGain + fullnessBonus + organicBonus,
    newParticipants,
  };
}

export function buildSetlistRecommendation({
  maxSetTrackCount,
  minParticipantsPerTrack = 1,
  previousConcertSongIds,
  candidates,
}: SelectionInput): SelectionResult {
  const requiredParticipantCount = Math.max(1, Math.round(minParticipantsPerTrack));
  const participantIndex = new Map<string, number>();
  const normalizedCandidates = candidates.map((candidate) => {
    const uniqueParticipantIds = [...new Set(candidate.participantIds)];
    let participantMask = 0n;

    for (const participantId of uniqueParticipantIds) {
      if (!participantIndex.has(participantId)) {
        participantIndex.set(participantId, participantIndex.size);
      }

      participantMask |= 1n << BigInt(participantIndex.get(participantId)!);
    }

    return {
      ...candidate,
      uniqueParticipantIds,
      participantMask,
    };
  });
  const eligible = normalizedCandidates.filter(
    (candidate) =>
      !previousConcertSongIds.has(candidate.songId) &&
      !candidate.hasUnfilledRequiredSeats &&
      candidate.uniqueParticipantIds.length >= requiredParticipantCount,
  );
  const selectedTracks = findSelection(eligible, maxSetTrackCount);
  const selectedTrackIds = new Set(selectedTracks.map((track) => track.id));
  const selected: SelectionResult["selected"] = [];
  const coveredUsers = new Set<string>();

  for (const next of orderSelectedTracks(selectedTracks)) {
    const { newParticipants } = marginalScore(next, coveredUsers);

    newParticipants.forEach((id) => coveredUsers.add(id));
    selected.push({
      trackId: next.id,
      orderIndex: selected.length + 1,
      section: SetlistSection.MAIN,
      reasons: [
        newParticipants.length > 0
          ? `Adds ${newParticipants.length} participants not yet represented in the set.`
          : "Fills an available main-set slot after maximum participant coverage is reached.",
        next.matchedKnownGroupName
          ? `Known band tie-break applied for ${next.matchedKnownGroupName}.`
          : "Organic line-up preferred as a tie-break.",
      ],
    });
  }

  const backlog = eligible
    .filter((candidate) => !selectedTrackIds.has(candidate.id))
    .sort((left, right) => {
      const leftScore = marginalScore(left, coveredUsers).value;
      const rightScore = marginalScore(right, coveredUsers).value;

      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }

      return compareTrackTieBreak(left, right);
    })
    .map((candidate) => ({
      trackId: candidate.id,
      section: SetlistSection.BACKLOG,
      reasons: [
        "Skipped because the selected combination maximizes unique participant coverage within the configured main-set song limit.",
      ],
    }));

  const rejectedDueToPrevious = normalizedCandidates
    .filter((candidate) => previousConcertSongIds.has(candidate.songId))
    .map((candidate) => ({
      trackId: candidate.id,
      section: SetlistSection.BACKLOG,
      reasons: ["Skipped because the same song appeared in the previous concert."],
    }));

  return {
    selected,
    backlog: [...backlog, ...rejectedDueToPrevious],
    coverageCount: coveredUsers.size,
  };
}
