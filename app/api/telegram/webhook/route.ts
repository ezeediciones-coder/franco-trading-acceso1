import { NextResponse } from 'next/server';

const SUPABASE_URL = 'https://gxqusszgidztjcbjrbiw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

    const results = [];

    // Caso 1: Telegram manda un mensaje de nuevo miembro
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

    // Caso 2: Telegram manda actualización de miembro del chat
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
