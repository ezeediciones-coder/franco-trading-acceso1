import { NextResponse } from 'next/server';
import crypto from 'crypto';

export const runtime = 'nodejs';

const ADMIN_SECRET = process.env.ADMIN_SECRET;
const BINGX_API_KEY = process.env.BINGX_API_KEY?.trim();
const BINGX_SECRET_KEY = process.env.BINGX_SECRET_KEY?.trim();

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

    const endpoint = '/openApi/spot/v1/account/balance';

    const params = {
      recvWindow: 5000,
      timestamp: Date.now(),
    };

    const { canonical, signature } = signParams(params);

    const bingxUrl = `${BINGX_BASE_URL}${endpoint}?${canonical}&signature=${signature}`;

    const bingxResponse = await fetch(bingxUrl, {
      method: 'GET',
      headers: {
        'X-BX-APIKEY': BINGX_API_KEY,
        'X-SOURCE-KEY': 'BX-AI-SKILL',
      },
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

    const bingxCode = bingxData?.code;
    const bingxMessage = bingxData?.msg || bingxData?.message || null;

    const connected =
      bingxResponse.ok &&
      (bingxCode === 0 || bingxCode === '0' || bingxData?.success === true);

    return NextResponse.json({
      ok: true,
      connected,
      message: connected
        ? 'Conexión con BingX exitosa. La API Key y la firma funcionan.'
        : 'BingX respondió, pero todavía no confirmó conexión exitosa. Revisá bingx_code y bingx_message.',
      env_check: {
        BINGX_API_KEY: true,
        BINGX_SECRET_KEY: true,
        BINGX_API_KEY_MASKED: maskKey(BINGX_API_KEY),
      },
      bingx_status: bingxResponse.status,
      bingx_code: bingxCode,
      bingx_message: bingxMessage,
      note:
        'Si sigue diciendo Incorrect apiKey, la clave está mal copiada, está vencida, fue creada en otra sección o BingX no la reconoce para esta API.',
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: `Error probando conexión con BingX: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 }
    );
  }
}
