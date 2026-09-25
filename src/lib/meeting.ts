// Two-sided meeting confirmation as the chat shows it. The database stamps
// each side's confirmation and allows ratings only once both exist; this only
// decides what to render.

export type MeetingState = { mine: boolean; theirs: boolean };

/** none: nobody confirmed · waiting: I confirmed · theirs: only they confirmed · confirmed: both. */
export type MeetingStage = "none" | "waiting" | "theirs" | "confirmed";

export const MEETING_TEXT: Record<Exclude<MeetingStage, "none">, string> = {
  waiting: "Sen buluşmayı onayladın. Karşı tarafın onayı bekleniyor.",
  theirs: "Karşı taraf buluşmayı onayladı.",
  confirmed: "Buluşma iki taraf tarafından onaylandı.",
};

/** Maps a conversation row to the signed-in user's point of view. */
export function meetingFor(
  row: { buyer_id: string; buyer_confirmed_at: string | null; seller_confirmed_at: string | null },
  me: string,
): MeetingState {
  const iAmBuyer = row.buyer_id === me;
  return {
    mine: Boolean(iAmBuyer ? row.buyer_confirmed_at : row.seller_confirmed_at),
    theirs: Boolean(iAmBuyer ? row.seller_confirmed_at : row.buyer_confirmed_at),
  };
}

export function meetingStage({ mine, theirs }: MeetingState): MeetingStage {
  if (mine && theirs) return "confirmed";
  if (mine) return "waiting";
  if (theirs) return "theirs";
  return "none";
}

/** The confirm button shows until I have confirmed; rating opens only when both have. */
export function meetingActions(state: MeetingState) {
  const stage = meetingStage(state);
  return { canConfirm: !state.mine, canRate: stage === "confirmed" };
}
