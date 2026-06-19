import { NextResponse } from 'next/server';

const SUPABASE_URL = 'https://gxqusszgidztjcbjrbiw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

type ExchangeRule = {
  exchange: string;
  display_name: string;
  inviter_uid: string | null;
  min_volume_30d: number;
  is_active: boolean;
};

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

function cleanTelegramUsername(username: string) {
  const value = username.trim();

  if (!value) return '';

  return value.startsWith('@') ? value : `@${value}`;
}

function getPendingMessage(result: string, displayName?: string, volume30d?: number, minVolume?: number) {
  if (result === 'EXCHANGE_NO_CONFIGURADO') {
    return 'Este exchange todavía no está configurado en la base de Franco Trading.';
  }

  if (result === 'EXCHANGE_NO_HABILITADO') {
    return `${displayName || 'Este exchange'} todavía no está habilitado para verificación automática. Pronto vamos a activar esta opción.`;
  }

  if (result === 'EXCHANGE_SIN_REFERIDOR') {
    return `${displayName || 'Este exchange'} todavía no tiene configurado el UID referidor oficial.`;
  }

  if (result === 'UID_NO_ENCONTRADO') {
    return 'Tu UID todavía no figura en nuestra base de referidos. Si te registraste hace poco, aguardá la próxima actualización.';
  }

  if (result === 'NO_ES_REFERIDO') {
    return 'Tu UID existe, pero no figura registrado como referido oficial de Franco Trading.';
  }

  if (result === 'NO_CUMPLE_VOLUMEN') {
    return `Tu UID figura como referido, pero todavía no cumple el volumen mínimo requerido. Volumen actual: ${volume30d || 0} USDT. Mínimo requerido: ${minVolume || 2000} USDT.`;
  }

  return 'Tu UID está siendo verificado. Te estaremos avisando por mail cuando actualicemos nuestra base de referidos.';
}

async function createTelegramInviteLink(exchange: string, uid: string) {
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
        name: `${exchange.toUpperCase()} UID ${uid}`.slice(0, 32),
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

async function findExchangeRule(exchange: string): Promise<ExchangeRule | null> {
  const headers = getSupabaseHeaders();

  const url =
    `${SUPABASE_URL}/rest/v1/exchange_rules` +
    `?select=exchange,display_name,inviter_uid,min_volume_30d,is_active` +
    `&exchange=eq.${encodeURIComponent(exchange)}` +
    `&limit=1`;

  const response = await fetch(url, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Supabase rechazó buscar exchange_rules. Status: ${response.status}. Detalle: ${errorText}`
    );
  }

  const rows = await response.json();
  return rows?.[0] || null;
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

async function findTelegramIdentityByUsername(telegramUsername: string) {
  const headers = getSupabaseHeaders();

  const url =
    `${SUPABASE_URL}/rest/v1/telegram_identities` +
    `?select=telegram_id,telegram_username,first_name,last_name` +
    `&telegram_username=eq.${encodeURIComponent(telegramUsername)}` +
    `&limit=1`;

  const response = await fetch(url, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Supabase rechazó buscar telegram_identities. Status: ${response.status}. Detalle: ${errorText}`
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
  volume30d,
}: {
  registrationId: string;
  telegramId: number;
  telegramUsername: string;
  uid: string;
  email: string;
  exchange: string;
  volume30d: number;
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
        last_volume_30d: volume30d,
        last_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Supabase rechazó guardar community_members. Status: ${response.status}. Detalle: ${errorText}`
    );
  }

  return response.json();
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

    let body: any;

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
    const telegramUsername = cleanTelegramUsername(
      String(body.telegram_username || '')
    );
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

    const rule = await findExchangeRule(exchange);

    let status = 'pending_verification';
    let result = 'UID_NO_ENCONTRADO';
    let approved = false;
    let volume30d = 0;
    let inviteLink: string | null = null;
    let inviteExpiresAt: string | null = null;
    let reusedInvite = false;
    let displayName = exchange;
    let minVolume = 2000;
    let telegramIdentityLinked = false;

    if (!rule) {
      result = 'EXCHANGE_NO_CONFIGURADO';
    } else {
      displayName = rule.display_name;
      minVolume = Number(rule.min_volume_30d || 2000);

      if (!rule.is_active) {
        result = 'EXCHANGE_NO_HABILITADO';
      } else if (!rule.inviter_uid) {
        result = 'EXCHANGE_SIN_REFERIDOR';
      } else {
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

        if (exchangeUser) {
          volume30d = Number(exchangeUser.volume_30d || 0);

          if (String(exchangeUser.inviter_uid) !== String(rule.inviter_uid)) {
            result = 'NO_ES_REFERIDO';
          } else if (volume30d < minVolume) {
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
              const telegramInvite = await createTelegramInviteLink(exchange, uid);
              inviteLink = telegramInvite.inviteLink;
              inviteExpiresAt = new Date(
                telegramInvite.expireDate * 1000
              ).toISOString();
            }
          }
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

    const savedRegistrations = await registrationResponse.json();
    const registration = savedRegistrations?.[0] || null;

    if (approved && registration?.id) {
      const telegramIdentity = await findTelegramIdentityByUsername(telegramUsername);

      if (telegramIdentity?.telegram_id) {
        await saveCommunityMember({
          registrationId: registration.id,
          telegramId: Number(telegramIdentity.telegram_id),
          telegramUsername,
          uid,
          email,
          exchange,
          volume30d,
        });

        telegramIdentityLinked = true;
      }
    }

    if (approved) {
      return NextResponse.json({
        ok: true,
        approved: true,
        result,
        exchange,
        display_name: displayName,
        reused_invite: reusedInvite,
        telegram_identity_linked: telegramIdentityLinked,
        volume_30d: volume30d,
        min_volume_30d: minVolume,
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
      exchange,
      display_name: displayName,
      volume_30d: volume30d,
      min_volume_30d: minVolume,
      invite_link: null,
      message: getPendingMessage(result, displayName, volume30d, minVolume),
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
