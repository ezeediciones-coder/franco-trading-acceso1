import { NextResponse } from 'next/server';

const SUPABASE_URL = 'https://gxqusszgidztjcbjrbiw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

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

async function getActiveMembers() {
  const headers = getSupabaseHeaders();

  const url =
    `${SUPABASE_URL}/rest/v1/community_members` +
    `?select=id,telegram_id,telegram_username,uid,email,exchange,status` +
    `&status=eq.active`;

  const response = await fetch(url, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Error buscando miembros activos. Status: ${response.status}. Detalle: ${errorText}`
    );
  }

  return response.json();
}

async function getExchangeUser(exchange: string, uid: string) {
  const headers = getSupabaseHeaders();

  const url =
    `${SUPABASE_URL}/rest/v1/exchange_users` +
    `?select=uid,inviter_uid,volume_30d,kyc_status` +
    `&exchange=eq.${encodeURIComponent(exchange)}` +
    `&uid=eq.${encodeURIComponent(uid)}` +
    `&limit=1`;

  const response = await fetch(url, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Error buscando UID en exchange_users. Status: ${response.status}. Detalle: ${errorText}`
    );
  }

  const rows = await response.json();
  return rows?.[0] || null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret');

    if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
      return NextResponse.json(
        {
          ok: false,
          message: 'No autorizado.',
        },
        { status: 401 }
      );
    }

    const members = await getActiveMembers();

    const results = [];

    for (const member of members) {
      const exchangeUser = await getExchangeUser(member.exchange, member.uid);

      let shouldRemove = false;
      let reason = '';
      let volume30d = 0;
      let inviterUid = null;

      if (!exchangeUser) {
        shouldRemove = true;
        reason = 'UID_NO_ENCONTRADO';
      } else {
        volume30d = Number(exchangeUser.volume_30d || 0);
        inviterUid = exchangeUser.inviter_uid;

        if (String(exchangeUser.inviter_uid) !== INVITER_UID) {
          shouldRemove = true;
          reason = 'NO_ES_REFERIDO';
        } else if (volume30d < MIN_VOLUME) {
          shouldRemove = true;
          reason = 'NO_CUMPLE_VOLUMEN';
        } else {
          shouldRemove = false;
          reason = 'CUMPLE';
        }
      }

      results.push({
        community_member_id: member.id,
        telegram_id: member.telegram_id,
        telegram_username: member.telegram_username,
        uid: member.uid,
        email: member.email,
        exchange: member.exchange,
        volume_30d: volume30d,
        inviter_uid: inviterUid,
        status_actual: member.status,
        resultado: reason,
        seria_eliminado: shouldRemove,
      });
    }

    const total = results.length;
    const cumplen = results.filter((item) => !item.seria_eliminado).length;
    const noCumplen = results.filter((item) => item.seria_eliminado).length;

    return NextResponse.json({
      ok: true,
      modo: 'PRUEBA_NO_ELIMINA',
      total_miembros_activos: total,
      cumplen,
      no_cumplen: noCumplen,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: `Error en control mensual: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 }
    );
  }
}
