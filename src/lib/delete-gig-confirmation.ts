// Deleting a gig is irreversible, so the admin must type its exact title (checked client- and server-side).
export function isDeleteGigConfirmationValid(typed: string, eventTitle: string) {
  return typed.trim().length > 0 && typed.trim() === eventTitle.trim();
}
