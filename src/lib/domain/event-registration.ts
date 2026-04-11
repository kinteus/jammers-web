export function assertEventRegistrationWindow({
  registrationClosesAt,
  registrationOpensAt,
  startsAt,
}: {
  registrationClosesAt: Date;
  registrationOpensAt: Date;
  startsAt: Date;
}) {
  if (registrationOpensAt >= registrationClosesAt) {
    throw new Error("Registration start must be earlier than registration close.");
  }

  if (registrationClosesAt > startsAt) {
    throw new Error("Registration close must be earlier than the gig start.");
  }
}
