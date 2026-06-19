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

function cleanUsername(username?: string) {
  if (!username) return null;
  return username.startsWith('@') ? username : `@${username}`;
}

async function findRegistrationByInviteLink(inviteLink: string) {
  const headers = getSupabaseHeaders();

  const url =
    `${SUPABASE_URL}/rest/v1/registrations` +
    `?select=id,exchange,uid,email,telegram_username,invite_link,status` +
    `&invite_link=eq.${encodeURIComponent(inviteLink)}` +
    `&limit=1`;

  console.log('BUSCANDO_REGISTRATION_URL:', url);

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

  console.log('REGISTRATION_ENCONTRADA:', JSON.stringify(rows, null, 2));

  if (!rows || rows.length === 0) {
    return null;
  }

  return rows[0];
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

  const payload = {
    registration_id: registrationId,
    telegram_id: telegramId,
    telegram_username: telegramUsername,
    uid,
    email,
    exchange,
    status: 'active',
    joined_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  console.log('GUARDANDO_COMMUNITY_MEMBER:', JSON.stringify(payload, null, 2));

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/community_members?on_conflict=telegram_id`,
    {
      method: 'POST',
      headers: {
        ...headers,
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Error guardando community_member. Status: ${response.status}. Detalle: ${errorText}`
    );
  }

  const result = await response.json();

  console.log('COMMUNITY_MEMBER_GUARDADO:', JSON.stringify(result, null, 2));

  return result;
}

export async function POST(request: Request) {
  try {
    const update = await request.json();

    console.log('TELEGRAM_UPDATE:', JSON.stringify(update, null, 2));

    const message = update.message;

    if (!message) {
      console.log('IGNORADO: no_message');
      return NextResponse.json({ ok: true, ignored: 'no_message' });
    }

    const newMembers = message.new_chat_members;

    if (!newMembers || !Array.isArray(newMembers) || newMembers.length === 0) {
      console.log('IGNORADO: no_new_members');
      return NextResponse.json({ ok: true, ignored: 'no_new_members' });
    }

    console.log('NEW_MEMBERS:', JSON.stringify(newMembers, null, 2));

    const inviteLink = message.invite_link?.invite_link;

    if (!inviteLink) {
      console.log('IGNORADO: no_invite_link_in_message');
      console.log('MESSAGE_COMPLETO:', JSON.stringify(message, null, 2));

      return NextResponse.json({
        ok: true,
        ignored: 'no_invite_link_in_message',
      });
    }

    console.log('INVITE_LINK_USADO:', inviteLink);

    const registration = await findRegistrationByInviteLink(inviteLink);

    if (!registration) {
      console.log('IGNORADO: registration_not_found_for_invite_link');

      return NextResponse.json({
        ok: true,
        ignored: 'registration_not_found_for_invite_link',
        invite_link: inviteLink,
      });
    }

    console.log('REGISTRATION_USADA:', JSON.stringify(registration, null, 2));

    const savedMembers = [];

    for (const member of newMembers) {
      if (member.is_bot) {
        console.log('IGNORADO: miembro_es_bot');
        continue;
      }

      const telegramId = member.id;
      const telegramUsername = cleanUsername(member.username);

      const saved = await saveCommunityMember({
        registrationId: registration.id,
        telegramId,
        telegramUsername,
        uid: registration.uid,
        email: registration.email,
        exchange: registration.exchange,
      });

      savedMembers.push(saved);
    }

    console.log('TOTAL_MIEMBROS_GUARDADOS:', savedMembers.length);

    return NextResponse.json({
      ok: true,
      saved_members: savedMembers.length,
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
