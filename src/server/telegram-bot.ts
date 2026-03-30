import { env } from "@/lib/env";

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
  if (!env.TELEGRAM_BOT_TOKEN) {
    return {
      status: "DELIVERY_FAILED" as const,
      note: "TELEGRAM_BOT_TOKEN is missing in the environment.",
    };
  }

  if (!recipientTelegramId) {
    return {
      status: "DELIVERY_FAILED" as const,
      note: "Recipient has no linked Telegram account.",
    };
  }

  const response = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        chat_id: recipientTelegramId,
        text: `${inviterLabel} invited you to ${songLabel} (${seatLabel}) for ${eventTitle}. Open the app to accept or decline.`,
      }),
      cache: "no-store",
    },
  );

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
