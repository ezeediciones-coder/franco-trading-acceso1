import { NextResponse } from 'next/server';

const SUPABASE_URL = 'https://gxqusszgidztjcbjrbiw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const INVITER_UID = '8316719';
const MIN_VOLUME = 2000;

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

async function createTelegramInviteLink(uid: string) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    throw new Error('Faltan TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID en Vercel.');
  }

  const expireDate = Math.floor(Date.now() / 1000) + 30 * 60;

  const telegramResponse = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/createChatInviteLink`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        name: `UID ${uid}`,
        expire_date: expireDate,
        member_limit: 1,
        creates_join_request: false,
      }),
    }
  );

  const telegramData = await telegramResponse.json();

  if (!telegramResponse.ok || !telegramData.ok) {
    throw new Error(
      telegramData.description || 'Telegram no pudo crear el link de invitación.'
    );
  }

  return {
    inviteLink: telegramData.result.invite_link,
    expireDate,
  };
}

async function findExistingValidInvite({
  exchange,
  uid,
  email,
}: {
  exchange: string;
  uid: string;
  email: string;
}) {
  const headers = getSupabaseHeaders();
  const nowIso = new Date().toISOString();

  const url =
    `${SUPABASE_URL}/rest/v1/registrations` +
    `?select=invite_link,invite_expires_at,status` +
    `&exchange=eq.${encodeURIComponent(exchange)}` +
    `&uid=eq.${encodeURIComponent(uid)}` +
    `&email=eq.${encodeURIComponent(email)}` +
    `&status=eq.approved` +
    `&invite_link=not.is.null` +
    `&invite_expires_at=gt.${encodeURIComponent(nowIso)}` +
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
      `Supabase rechazó buscar link vigente. Status: ${response.status}. Detalle: ${errorText}`
    );
  }

  const rows = await response.json();

  if (rows && rows.length > 0 && rows[0].invite_link) {
    return rows[0];
  }

  return null;
}

export async function POST(request: Request) {
  try {
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Falta SUPABASE_SERVICE_ROLE_KEY en Vercel.',
        },
        { status: 500 }
      );
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          ok: false,
          message: 'No se pudieron leer los datos del formulario.',
        },
        { status: 400 }
      );
    }

    const exchange = String(body.exchange || '').trim().toLowerCase();
    const uid = String(body.uid || '').trim();
    const telegramUsername = String(body.telegram_username || '').trim();
    const email = String(body.email || '').trim().toLowerCase();

    if (!exchange || !uid || !telegramUsername || !email) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Faltan datos obligatorios.',
        },
        { status: 400 }
      );
    }

    const headers = getSupabaseHeaders();

    const searchUrl =
      `${SUPABASE_URL}/rest/v1/exchange_users` +
      `?select=uid,inviter_uid,volume_30d,kyc_status` +
      `&exchange=eq.${encodeURIComponent(exchange)}` +
      `&uid=eq.${encodeURIComponent(uid)}` +
      `&limit=1`;

    const exchangeResponse = await fetch(searchUrl, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (!exchangeResponse.ok) {
      const errorText = await exchangeResponse.text();

      return NextResponse.json(
        {
          ok: false,
          message: `Supabase rechazó la consulta de exchange_users. Status: ${exchangeResponse.status}. Detalle: ${errorText}`,
        },
        { status: 500 }
      );
    }

    const exchangeUsers = await exchangeResponse.json();
    const exchangeUser = exchangeUsers[0];

    let status = 'pending_verification';
    let result = 'UID_NO_ENCONTRADO';
    let approved = false;
    let volume30d = 0;
    let inviteLink: string | null = null;
    let inviteExpiresAt: string | null = null;
    let reusedInvite = false;

    if (exchangeUser) {
      volume30d = Number(exchangeUser.volume_30d || 0);

      if (String(exchangeUser.inviter_uid) !== INVITER_UID) {
        result = 'NO_ES_REFERIDO';
      } else if (volume30d < MIN_VOLUME) {
        result = 'NO_CUMPLE_VOLUMEN';
      } else {
        result = 'APROBADO';
        status = 'approved';
        approved = true;

        const existingInvite = await findExistingValidInvite({
          exchange,
          uid,
          email,
        });

        if (existingInvite) {
          inviteLink = existingInvite.invite_link;
          inviteExpiresAt = existingInvite.invite_expires_at;
          reusedInvite = true;
        } else {
          const telegramInvite = await createTelegramInviteLink(uid);
          inviteLink = telegramInvite.inviteLink;
          inviteExpiresAt = new Date(
            telegramInvite.expireDate * 1000
          ).toISOString();
        }
      }
    }

    const verificationCode = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

    const registrationResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/registrations`,
      {
        method: 'POST',
        headers: {
          ...headers,
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          exchange,
          uid,
          telegram_username: telegramUsername,
          email,
          status,
          verification_code: verificationCode,
          invite_link: inviteLink,
          invite_expires_at: inviteExpiresAt,
        }),
      }
    );

    if (!registrationResponse.ok) {
      const errorText = await registrationResponse.text();

      return NextResponse.json(
        {
          ok: false,
          message: `Supabase rechazó guardar en registrations. Status: ${registrationResponse.status}. Detalle: ${errorText}`,
        },
        { status: 500 }
      );
    }

    if (approved) {
      return NextResponse.json({
        ok: true,
        approved: true,
        result,
        reused_invite: reusedInvite,
        volume_30d: volume30d,
        invite_link: inviteLink,
        invite_expires_at: inviteExpiresAt,
        message: reusedInvite
          ? 'Ya tenés un link único vigente. Usá ese link para ingresar al grupo.'
          : 'Verificación aprobada. Tu UID cumple con los requisitos. Usá el link único para ingresar al grupo.',
      });
    }

    return NextResponse.json({
      ok: true,
      approved: false,
      result,
      volume_30d: volume30d,
      invite_link: null,
      message:
        'Tu UID está siendo verificado. Te estaremos avisando por mail en las próximas 24 hs cuando actualicemos nuestra base de referidos.',
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: `Error inesperado en la verificación: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 }
    );
  }
}
