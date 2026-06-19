import { NextResponse } from 'next/server';

const SUPABASE_URL = 'https://gxqusszgidztjcbjrbiw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

function getSupabaseHeaders() {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en Vercel.');
  }

  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  };
}

function cleanUsername(username?: string | null) {
  if (!username) return null;
  return username.startsWith('@') ? username : `@${username}`;
}

async function sendTelegramMessage(chatId: number, text: string) {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('Falta TELEGRAM_BOT_TOKEN en Vercel.');
  }

  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    }
  );

  const data = await response.json();

  if (!response.ok || !data.ok) {
    throw new Error(
      data.description || 'Telegram no pudo enviar el mensaje privado.'
    );
  }

  return data;
}

async function saveTelegramIdentity({
  telegramId,
  telegramUsername,
  firstName,
  lastName,
}: {
  telegramId: number;
  telegramUsername: string | null;
  firstName: string | null;
  lastName: string | null;
}) {
  const headers = getSupabaseHeaders();

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/telegram_identities?on_conflict=telegram_id`,
    {
      method: 'POST',
      headers: {
        ...headers,
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        telegram_id: telegramId,
        telegram_username: telegramUsername,
        first_name: firstName,
        last_name: lastName,
        last_private_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Error guardando telegram_identity. Status: ${response.status}. Detalle: ${errorText}`
    );
  }

  return response.json();
}

async function findRegistrationByInviteLink(inviteLink: string) {
  const headers = getSupabaseHeaders();

  const url =
    `${SUPABASE_URL}/rest/v1/registrations` +
    `?select=id,exchange,uid,email,telegram_username,invite_link,status,created_at` +
    `&invite_link=eq.${encodeURIComponent(inviteLink)}` +
    `&limit=1`;

  const response = await fetch(url, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Error buscando registration por invite_link. Status: ${response.status}. Detalle: ${errorText}`
    );
  }

  const rows = await response.json();
  return rows?.[0] || null;
}

async function findRegistrationByTelegramUsername(telegramUsername: string | null) {
  if (!telegramUsername) return null;

  const headers = getSupabaseHeaders();

  const url =
    `${SUPABASE_URL}/rest/v1/registrations` +
    `?select=id,exchange,uid,email,telegram_username,invite_link,status,created_at` +
    `&telegram_username=eq.${encodeURIComponent(telegramUsername)}` +
    `&status=eq.approved` +
    `&order=created_at.desc` +
    `&limit=1`;

  const response = await fetch(url, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Error buscando registration por telegram_username. Status: ${response.status}. Detalle: ${errorText}`
    );
  }

  const rows = await response.json();
  return rows?.[0] || null;
}

async function saveCommunityMember({
  registrationId,
  telegramId,
  telegramUsername,
  uid,
  email,
  exchange,
}: {
  registrationId: string;
  telegramId: number;
  telegramUsername: string | null;
  uid: string;
  email: string;
  exchange: string;
}) {
  const headers = getSupabaseHeaders();

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/community_members?on_conflict=telegram_id`,
    {
      method: 'POST',
      headers: {
        ...headers,
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        registration_id: registrationId,
        telegram_id: telegramId,
        telegram_username: telegramUsername,
        uid,
        email,
        exchange,
        status: 'active',
        joined_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Error guardando community_member. Status: ${response.status}. Detalle: ${errorText}`
    );
  }

  return response.json();
}

async function processJoinedUser({
  telegramId,
  telegramUsername,
  inviteLink,
}: {
  telegramId: number;
  telegramUsername: string | null;
  inviteLink: string | null;
}) {
  let registration = null;

  if (inviteLink) {
    registration = await findRegistrationByInviteLink(inviteLink);
  }

  if (!registration) {
    registration = await findRegistrationByTelegramUsername(telegramUsername);
  }

  if (!registration) {
    return {
      saved: false,
      reason: 'registration_not_found',
      telegram_id: telegramId,
      telegram_username: telegramUsername,
      invite_link: inviteLink,
    };
  }

  await saveCommunityMember({
    registrationId: registration.id,
    telegramId,
    telegramUsername,
    uid: registration.uid,
    email: registration.email,
    exchange: registration.exchange,
  });

  return {
    saved: true,
    telegram_id: telegramId,
    telegram_username: telegramUsername,
    uid: registration.uid,
    email: registration.email,
    exchange: registration.exchange,
  };
}

export async function POST(request: Request) {
  try {
    const update = await request.json();

    console.log('TELEGRAM_UPDATE:', JSON.stringify(update, null, 2));

    // Caso 1: usuario le escribe al bot por privado.
    if (update.message?.chat?.type === 'private') {
      const from = update.message.from;

      if (!from || from.is_bot) {
        return NextResponse.json({
          ok: true,
          ignored: 'private_message_without_valid_user',
        });
      }

      const telegramId = from.id;
      const telegramUsername = cleanUsername(from.username);
      const firstName = from.first_name || null;
      const lastName = from.last_name || null;

      await saveTelegramIdentity({
        telegramId,
        telegramUsername,
        firstName,
        lastName,
      });

      await sendTelegramMessage(
        telegramId,
        `✅ <b>Telegram confirmado</b>\n\nTu cuenta fue identificada correctamente.\n\nAhora completá la verificación en la página de Franco Trading con tu UID, usuario de Telegram y email.`
      );

      return NextResponse.json({
        ok: true,
        type: 'private_identity_saved',
        telegram_id: telegramId,
        telegram_username: telegramUsername,
      });
    }

    const results = [];

    // Caso 2: Telegram manda mensaje de nuevo miembro.
    if (update.message?.new_chat_members?.length) {
      const inviteLink = update.message.invite_link?.invite_link || null;

      for (const member of update.message.new_chat_members) {
        if (member.is_bot) continue;

        const telegramId = member.id;
        const telegramUsername = cleanUsername(member.username);

        const result = await processJoinedUser({
          telegramId,
          telegramUsername,
          inviteLink,
        });

        results.push(result);
      }

      return NextResponse.json({
        ok: true,
        type: 'message_new_chat_members',
        results,
      });
    }

    // Caso 3: Telegram manda actualización de miembro del chat.
    if (update.chat_member) {
      const oldStatus = update.chat_member.old_chat_member?.status;
      const newStatus = update.chat_member.new_chat_member?.status;
      const user = update.chat_member.new_chat_member?.user;
      const inviteLink = update.chat_member.invite_link?.invite_link || null;

      const joined =
        ['left', 'kicked'].includes(oldStatus) &&
        ['member', 'restricted', 'administrator'].includes(newStatus);

      if (!joined || !user || user.is_bot) {
        return NextResponse.json({
          ok: true,
          ignored: 'chat_member_not_join_event',
          oldStatus,
          newStatus,
        });
      }

      const telegramId = user.id;
      const telegramUsername = cleanUsername(user.username);

      const result = await processJoinedUser({
        telegramId,
        telegramUsername,
        inviteLink,
      });

      return NextResponse.json({
        ok: true,
        type: 'chat_member_join',
        result,
      });
    }

    return NextResponse.json({
      ok: true,
      ignored: 'unsupported_update_type',
    });
  } catch (error) {
    console.error('ERROR_WEBHOOK_TELEGRAM:', error);

    return NextResponse.json(
      {
        ok: false,
        message: `Error en webhook de Telegram: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 }
    );
  }
}
