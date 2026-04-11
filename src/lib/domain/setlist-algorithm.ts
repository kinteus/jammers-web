import { SetlistSection } from "@prisma/client";

type CandidateTrack = {
  id: string;
  songId: string;
  songTitle: string;
  artistName: string;
  participantIds: string[];
  filledSeatRatio: number;
  createdAt: Date;
  matchedKnownGroupName: string | null;
};

export type SelectionInput = {
  maxSetTrackCount: number;
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

function marginalScore(track: CandidateTrack, coveredUsers: Set<string>) {
  const newParticipants = track.participantIds.filter((id) => !coveredUsers.has(id));
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
  previousConcertSongIds,
  candidates,
}: SelectionInput): SelectionResult {
  const selected: SelectionResult["selected"] = [];
  const backlog: SelectionResult["backlog"] = [];
  const remaining = [...candidates].filter(
    (candidate) => !previousConcertSongIds.has(candidate.songId) && candidate.participantIds.length > 0,
  );
  const coveredUsers = new Set<string>();
  while (remaining.length > 0) {
    remaining.sort((left, right) => {
      if (Boolean(left.matchedKnownGroupName) !== Boolean(right.matchedKnownGroupName)) {
        return left.matchedKnownGroupName ? 1 : -1;
      }

      const leftScore = marginalScore(left, coveredUsers).value;
      const rightScore = marginalScore(right, coveredUsers).value;

      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }

      return left.createdAt.getTime() - right.createdAt.getTime();
    });

    const next = remaining.shift();
    if (!next) {
      break;
    }

    const { newParticipants } = marginalScore(next, coveredUsers);

    if (selected.length < maxSetTrackCount) {
      newParticipants.forEach((id) => coveredUsers.add(id));
      selected.push({
        trackId: next.id,
        orderIndex: selected.length + 1,
        section: SetlistSection.MAIN,
        reasons: [
          newParticipants.length > 0
            ? `Adds ${newParticipants.length} participants not yet represented in the set.`
            : "Keeps overall stage occupancy high after coverage pass.",
          next.matchedKnownGroupName
            ? `Known band penalty applied for ${next.matchedKnownGroupName}.`
            : "Organic line-up bonus applied.",
        ],
      });
    } else {
      backlog.push({
        trackId: next.id,
        section: SetlistSection.BACKLOG,
        reasons: ["Skipped because it would exceed the configured main-set song limit."],
      });
    }
  }

  const rejectedDueToPrevious = candidates
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
