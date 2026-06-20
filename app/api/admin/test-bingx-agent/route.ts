import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';

const ADMIN_SECRET = process.env.ADMIN_SECRET;
const BINGX_API_KEY = process.env.BINGX_API_KEY?.trim();
const BINGX_SECRET_KEY = process.env.BINGX_SECRET_KEY?.trim();
const BINGX_SOURCE_KEY = process.env.BINGX_SOURCE_KEY?.trim();

const BINGX_BASE_URL = 'https://open-api.bingx.com';

function buildCanonical(params: Record<string, string | number>) {
  return Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
}

function signParams(params: Record<string, string | number>) {
  if (!BINGX_SECRET_KEY) {
    throw new Error('Falta BINGX_SECRET_KEY en Vercel.');
  }

  const canonical = buildCanonical(params);

  const signature = crypto
    .createHmac('sha256', BINGX_SECRET_KEY)
    .update(canonical)
    .digest('hex');

  return {
    canonical,
    signature,
  };
}

function maskKey(value: string | undefined) {
  if (!value) return null;
  if (value.length <= 10) return '********';
  return `${value.slice(0, 5)}...${value.slice(-4)}`;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret');

    if (!ADMIN_SECRET) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Falta ADMIN_SECRET en Vercel.',
        },
        { status: 500 }
      );
    }

    if (secret !== ADMIN_SECRET) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Clave admin incorrecta.',
        },
        { status: 401 }
      );
    }

    if (!BINGX_API_KEY || !BINGX_SECRET_KEY) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Faltan BINGX_API_KEY o BINGX_SECRET_KEY en Vercel.',
          env_check: {
            BINGX_API_KEY: Boolean(BINGX_API_KEY),
            BINGX_SECRET_KEY: Boolean(BINGX_SECRET_KEY),
          },
        },
        { status: 500 }
      );
    }

    const endpoint = '/openApi/agent/v1/account/inviteAccountList';

    const params = {
      pageIndex: 1,
      pageSize: 20,
      recvWindow: 5000,
      timestamp: Date.now(),
    };

    const { canonical, signature } = signParams(params);

    const bingxUrl = `${BINGX_BASE_URL}${endpoint}?${canonical}&signature=${signature}`;

    const headers: Record<string, string> = {
      'X-BX-APIKEY': BINGX_API_KEY,
    };

    if (BINGX_SOURCE_KEY) {
      headers['X-SOURCE-KEY'] = BINGX_SOURCE_KEY;
    }

    const bingxResponse = await fetch(bingxUrl, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    const responseText = await bingxResponse.text();

    let bingxData: any = null;

    try {
      bingxData = JSON.parse(responseText);
    } catch {
      bingxData = {
        raw: responseText.slice(0, 500),
      };
    }

    const code = bingxData?.code;
    const msg = bingxData?.msg || bingxData?.message || null;
    const data = bingxData?.data || null;
    const list = Array.isArray(data?.list) ? data.list : [];

    const connected =
      bingxResponse.ok && (code === 0 || code === '0');

    const preview = list.slice(0, 5).map((user: any) => ({
      uid: user.uid,
      inviterSid: user.inviterSid,
      directInvitation: user.directInvitation,
      kycResult: user.kycResult,
      deposit: user.deposit,
      trade: user.trade,
      balanceVolume: user.balanceVolume,
      registerTime: user.registerTime,
    }));

    return NextResponse.json({
      ok: true,
      connected,
      message: connected
        ? 'Conexión Agent/Broker exitosa. BingX devolvió usuarios invitados.'
        : 'BingX respondió, pero no confirmó conexión exitosa.',
      env_check: {
        BINGX_API_KEY: true,
        BINGX_SECRET_KEY: true,
        BINGX_SOURCE_KEY: Boolean(BINGX_SOURCE_KEY),
        BINGX_API_KEY_MASKED: maskKey(BINGX_API_KEY),
      },
      endpoint,
      bingx_status: bingxResponse.status,
      bingx_code: code,
      bingx_message: msg,
      total: data?.total ?? null,
      currentAgentUid: data?.currentAgentUid ?? null,
      users_preview: preview,
      note:
        'Esta prueba solo muestra una vista previa de hasta 5 usuarios. No actualiza Supabase.',
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: `Error probando Agent API de BingX: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 }
    );
  }
}
