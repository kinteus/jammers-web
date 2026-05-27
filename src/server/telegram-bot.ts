import { env } from "@/lib/env";

const EVENT_TIME_ZONE = "Europe/Nicosia";

async function sendTelegramMessage({
  chatId,
  disableWebPagePreview,
  parseMode,
  text,
}: {
  chatId: string | null | undefined;
  disableWebPagePreview?: boolean;
  parseMode?: "HTML";
  text: string;
}) {
  if (!env.TELEGRAM_BOT_TOKEN) {
    return {
      status: "DELIVERY_FAILED" as const,
      note: "TELEGRAM_BOT_TOKEN is missing in the environment.",
    };
  }

  if (!chatId) {
    return {
      status: "DELIVERY_FAILED" as const,
      note: "Telegram chat is not configured.",
    };
  }

  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        disable_web_page_preview: disableWebPagePreview,
        parse_mode: parseMode,
        text,
      }),
      cache: "no-store",
    });
  } catch (error) {
    return {
      status: "DELIVERY_FAILED" as const,
      note: error instanceof Error ? error.message : "Telegram delivery failed.",
    };
  }

  if (!response.ok) {
    return {
      status: "DELIVERY_FAILED" as const,
      note: `Telegram API returned ${response.status}.`,
    };
  }

  return {
    status: "PENDING" as const,
    note: "Invite was sent through Telegram.",
  };
}

function escapeTelegramHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function buildTelegramPublishedSetMessage({
  eventStartsAt,
  eventTitle,
  songs,
}: {
  eventStartsAt: Date;
  eventTitle: string;
  songs: Array<{
    orderIndex: number;
    positions: string[];
    songLabel: string;
  }>;
}) {
  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: EVENT_TIME_ZONE,
  }).format(eventStartsAt);

  return [
    `You're in the final set for ${eventTitle}.`,
    `Gig start: ${dateLabel}`,
    "",
    "Your songs and parts:",
    ...songs.map(
      (song) => `${song.orderIndex}. ${song.songLabel} - ${song.positions.join(", ")}`,
    ),
    "",
    "See you on stage.",
  ].join("\n");
}

export function buildTelegramBoardClosedChannelMessage({
  city,
  eventStartsAt,
  venueName,
}: {
  city: string | null | undefined;
  eventStartsAt: Date;
  venueName: string | null | undefined;
}) {
  const dateLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "long",
    timeZone: EVENT_TIME_ZONE,
    weekday: "long",
  }).format(eventStartsAt);
  const venueLabel = [venueName || "TBA", city || null].filter(Boolean).join(", ");

  return [
    "🏁 Иии таблица закрыта!",
    "",
    "☕️ Мы берем небольшую паузу, чтобы собрать сетлист, а пока напомним про сам гиг:",
    `📍 Где: ${venueLabel}`,
    `📅 Когда: ${dateLabel}`,
    "",
    "💪 Спасибо вам за вашу активность!",
  ].join("\n");
}

export function buildTelegramBoardClosedParticipantMessage({
  eventStartsAt,
  eventTitle,
}: {
  eventStartsAt: Date;
  eventTitle: string;
}) {
  const dateLabel = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "long",
    timeZone: EVENT_TIME_ZONE,
    weekday: "long",
  }).format(eventStartsAt);

  return [
    `Таблица для ${eventTitle} закрыта.`,
    `Гиг: ${dateLabel}`,
    "",
    "Мы собираем финальный сетлист и сообщим, когда он будет опубликован.",
  ].join("\n");
}

export function buildTelegramInviteMessage({
  eventTitle,
  inviterLabel,
  profileUrl,
  seatLabel,
  songLabel,
}: {
  eventTitle: string;
  inviterLabel: string;
  profileUrl: string;
  seatLabel: string;
  songLabel: string;
}) {
  return [
    `${escapeTelegramHtml(inviterLabel)} invited you to ${escapeTelegramHtml(songLabel)} (${escapeTelegramHtml(seatLabel)}) for ${escapeTelegramHtml(eventTitle)}.`,
    "",
    `Open <a href="${profileUrl}">your profile invites</a> to accept or decline.`,
  ].join("\n");
}

export function buildTelegramAdminSeatAssignedMessage({
  eventTitle,
  seatLabel,
  songLabel,
}: {
  eventTitle: string;
  seatLabel: string;
  songLabel: string;
}) {
  return `Ты добавлен(а) админом в сетлист: ${songLabel} — ${seatLabel} для ${eventTitle}.`;
}

export async function sendTelegramInviteMessage({
  recipientTelegramId,
  eventTitle,
  songLabel,
  seatLabel,
  inviterLabel,
}: {
  recipientTelegramId: string | null | undefined;
  eventTitle: string;
  songLabel: string;
  seatLabel: string;
  inviterLabel: string;
}) {
  const profileUrl = `${env.NEXT_PUBLIC_APP_URL}/profile`;

  return sendTelegramMessage({
    chatId: recipientTelegramId,
    disableWebPagePreview: true,
    parseMode: "HTML",
    text: buildTelegramInviteMessage({
      eventTitle,
      inviterLabel,
      profileUrl,
      seatLabel,
      songLabel,
    }),
  });
}

export async function sendTelegramAdminSeatAssignedMessage({
  recipientTelegramId,
  eventTitle,
  songLabel,
  seatLabel,
}: {
  recipientTelegramId: string | null | undefined;
  eventTitle: string;
  songLabel: string;
  seatLabel: string;
}) {
  return sendTelegramMessage({
    chatId: recipientTelegramId,
    disableWebPagePreview: true,
    text: buildTelegramAdminSeatAssignedMessage({
      eventTitle,
      seatLabel,
      songLabel,
    }),
  });
}

export async function sendTelegramSeatApprovalRequestMessage({
  recipientTelegramId,
  eventTitle,
  songLabel,
  seatLabel,
  requesterLabel,
  targetLabel,
  mode,
}: {
  recipientTelegramId: string | null | undefined;
  eventTitle: string;
  songLabel: string;
  seatLabel: string;
  requesterLabel: string;
  targetLabel: string;
  mode: "self" | "friend";
}) {
  return sendTelegramMessage({
    chatId: recipientTelegramId,
    text:
      mode === "self"
        ? `${requesterLabel} wants to join the optional ${seatLabel} part on ${songLabel} for ${eventTitle}. Open the app to approve or decline.`
        : `${requesterLabel} suggested ${targetLabel} for the optional ${seatLabel} part on ${songLabel} for ${eventTitle}. Open the app to approve or decline.`,
  });
}

export async function sendTelegramFeedbackMessage({
  fromLabel,
  contactLabel,
  message,
}: {
  fromLabel: string;
  contactLabel: string | null;
  message: string;
}) {
  return sendTelegramMessage({
    chatId: env.TELEGRAM_FEEDBACK_CHAT_ID,
    text: [
      "New feedback from FAQ form",
      "",
      `From: ${fromLabel}`,
      contactLabel ? `Contact: ${contactLabel}` : null,
      "",
      message,
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

export async function sendTelegramPublishedSetMessage({
  recipientTelegramId,
  eventStartsAt,
  eventTitle,
  songs,
}: {
  recipientTelegramId: string | null | undefined;
  eventStartsAt: Date;
  eventTitle: string;
  songs: Array<{
    orderIndex: number;
    positions: string[];
    songLabel: string;
  }>;
}) {
  return sendTelegramMessage({
    chatId: recipientTelegramId,
    text: buildTelegramPublishedSetMessage({
      eventStartsAt,
      eventTitle,
      songs,
    }),
  });
}

export async function sendTelegramBoardClosedChannelMessage({
  channelChatId,
  city,
  eventStartsAt,
  venueName,
}: {
  channelChatId: string | null | undefined;
  city: string | null | undefined;
  eventStartsAt: Date;
  venueName: string | null | undefined;
}) {
  return sendTelegramMessage({
    chatId: channelChatId,
    text: buildTelegramBoardClosedChannelMessage({
      city,
      eventStartsAt,
      venueName,
    }),
  });
}

export async function sendTelegramBoardClosedParticipantMessage({
  eventStartsAt,
  eventTitle,
  recipientTelegramId,
}: {
  eventStartsAt: Date;
  eventTitle: string;
  recipientTelegramId: string | null | undefined;
}) {
  return sendTelegramMessage({
    chatId: recipientTelegramId,
    text: buildTelegramBoardClosedParticipantMessage({
      eventStartsAt,
      eventTitle,
    }),
  });
}
