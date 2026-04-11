import {
  EventStatus,
  SetlistSection,
  TrackSeatStatus,
  UserRole,
} from "@prisma/client";

import { DEFAULT_LINEUP } from "@/lib/constants";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { serializeTrackInfoFields, serializeTrackInfoKeys, DEFAULT_TRACK_INFO_FIELDS } from "@/lib/track-info-flags";
import { slugify } from "@/lib/utils";

async function seedInstruments() {
  const names = [
    "Drums",
    "Guitar",
    "Bass",
    "Vocals",
    "Keys",
    "Percussion",
    "Other",
  ];

  for (const name of names) {
    await db.instrument.upsert({
      where: { slug: slugify(name) },
      update: { name },
      create: {
        slug: slugify(name),
        name,
      },
    });
  }
}

async function seedSongs() {
  const artist = await db.artist.upsert({
    where: { slug: "foo-fighters" },
    update: {},
    create: {
      slug: "foo-fighters",
      name: "Foo Fighters",
    },
  });

  const songs = [
    { title: "Everlong", durationSeconds: 250 },
    { title: "The Pretender", durationSeconds: 269 },
    { title: "Best of You", durationSeconds: 255 },
  ];

  for (const song of songs) {
    await db.song.upsert({
      where: { slug: slugify(`${artist.name}-${song.title}`) },
      update: song,
      create: {
        ...song,
        slug: slugify(`${artist.name}-${song.title}`),
        artistId: artist.id,
      },
    });
  }
}

async function seedUsers() {
  const admin = await db.user.upsert({
    where: { telegramUsername: env.DEFAULT_ADMIN_USERNAME },
    update: {
      role: UserRole.ADMIN,
      fullName: "Default Admin",
    },
    create: {
      telegramId: "1000001",
      telegramUsername: env.DEFAULT_ADMIN_USERNAME,
      fullName: "Default Admin",
      role: UserRole.ADMIN,
      bio: "Seeded administrator account.",
    },
  });

  const usernames = ["anna_drums", "mike_guitar", "kate_vox", "sam_keys"];
  const users = [];
  for (const [index, username] of usernames.entries()) {
    const user = await db.user.upsert({
      where: { telegramUsername: username },
      update: {},
      create: {
        telegramId: `${2000000 + index}`,
        telegramUsername: username,
        fullName: username.replace("_", " "),
      },
    });
    users.push(user);
  }

  return { admin, users };
}

async function seedEvent() {
  const event = await db.event.upsert({
    where: { slug: "spring-jam-night" },
    update: {},
    create: {
      slug: "spring-jam-night",
      title: "Spring Jam Night",
      description: "Public rehearsal board for the upcoming concert.",
      venueName: "Jammers Loft",
      venueMapUrl: "https://maps.google.com/?q=Jammers+Loft",
      startsAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
      registrationOpensAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
      registrationClosesAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 6),
      status: EventStatus.OPEN,
      maxSetDurationMinutes: 24,
      maxTracksPerUser: 3,
      allowPlayback: true,
      trackInfoFieldsJson: serializeTrackInfoFields(DEFAULT_TRACK_INFO_FIELDS),
      stageNotes: "Acoustic treated room, 16 channels, no pyrotechnics.",
    },
  });

  const instruments = await db.instrument.findMany();
  for (const slot of DEFAULT_LINEUP) {
    const instrument = instruments.find(
      (entry) => entry.slug === slugify(slot.label),
    );
    await db.eventLineupSlot.upsert({
      where: {
        eventId_key: {
          eventId: event.id,
          key: slot.key,
        },
      },
      update: {
        label: slot.label,
        seatCount: slot.seatCount,
        displayOrder: slot.displayOrder,
        instrumentId: instrument?.id,
      },
      create: {
        eventId: event.id,
        key: slot.key,
        label: slot.label,
        seatCount: slot.seatCount,
        displayOrder: slot.displayOrder,
        instrumentId: instrument?.id,
      },
    });
  }

  return event;
}

async function seedTrack(eventId: string, proposerId: string) {
  const song = await db.song.findFirstOrThrow({
    where: { title: "Everlong" },
  });

  const existing = await db.track.findFirst({
    where: {
      eventId,
      songId: song.id,
    },
  });

  if (existing) {
    return existing;
  }

  const track = await db.track.create({
    data: {
      eventId,
      songId: song.id,
      proposedById: proposerId,
      playbackRequired: false,
      trackInfoKeysJson: serializeTrackInfoKeys([]),
      comment: "Tempo-friendly opener with enough room for multiple singers.",
    },
  });

  const slots = await db.eventLineupSlot.findMany({
    where: { eventId },
    orderBy: { displayOrder: "asc" },
  });

  for (const slot of slots) {
    for (let index = 1; index <= slot.seatCount; index += 1) {
      await db.trackSeat.create({
        data: {
          trackId: track.id,
          lineupSlotId: slot.id,
          seatIndex: index,
          label: slot.seatCount === 1 ? slot.label : `${slot.label} ${index}`,
          status: TrackSeatStatus.OPEN,
        },
      });
    }
  }

  await db.setlistItem.create({
    data: {
      eventId,
      trackId: track.id,
      section: SetlistSection.BACKLOG,
      orderIndex: 1,
      editedById: proposerId,
    },
  });

  return track;
}

async function main() {
  await seedInstruments();
  await seedSongs();
  const { admin, users } = await seedUsers();
  const event = await seedEvent();
  await seedTrack(event.id, users[0]?.id ?? admin.id);
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
