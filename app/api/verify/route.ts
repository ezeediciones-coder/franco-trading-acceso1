import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const INVITER_UID = '8316719';
const MIN_VOLUME = 2000;

export async function POST(request: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { ok: false, message: 'Faltan variables de entorno de Supabase.' },
        { status: 500 }
      );
    }

    const body = await request.json();

    const exchange = String(body.exchange || '').trim().toLowerCase();
    const uid = String(body.uid || '').trim();
    const telegramUsername = String(body.telegram_username || '').trim();
    const email = String(body.email || '').trim().toLowerCase();

    if (!exchange || !uid || !telegramUsername || !email) {
      return NextResponse.json(
        { ok: false, message: 'Faltan datos obligatorios.' },
        { status: 400 }
      );
    }

    const headers = {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    };

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
      return NextResponse.json(
        { ok: false, message: 'Error consultando la base de referidos.' },
        { status: 500 }
      );
    }

    const exchangeUsers = await exchangeResponse.json();
    const exchangeUser = exchangeUsers[0];

    let status = 'pending_verification';
    let result = 'UID_NO_ENCONTRADO';
    let approved = false;
    let volume30d = 0;

    if (exchangeUser) {
      volume30d = Number(exchangeUser.volume_30d || 0);

      if (exchangeUser.inviter_uid !== INVITER_UID) {
        result = 'NO_ES_REFERIDO';
      } else if (volume30d < MIN_VOLUME) {
        result = 'NO_CUMPLE_VOLUMEN';
      } else {
        result = 'APROBADO';
        status = 'approved';
        approved = true;
      }
    }

    const verificationCode =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

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
        }),
      }
    );

    if (!registrationResponse.ok) {
      return NextResponse.json(
        { ok: false, message: 'Error guardando el registro.' },
        { status: 500 }
      );
    }

    if (approved) {
      return NextResponse.json({
        ok: true,
        approved: true,
        result,
        volume_30d: volume30d,
        message:
          'Verificación aprobada. Tu UID cumple con los requisitos para ingresar a la comunidad privada.',
      });
    }

    return NextResponse.json({
      ok: true,
      approved: false,
      result,
      volume_30d: volume30d,
      message:
        'Tu UID está siendo verificado. Te estaremos avisando por mail en las próximas 24 hs cuando actualicemos nuestra base de referidos.',
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: 'Error inesperado en la verificación.' },
      { status: 500 }
    );
  }
}
