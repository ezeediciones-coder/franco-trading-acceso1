import { NextResponse } from 'next/server';

const ADMIN_SECRET = process.env.ADMIN_SECRET;
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  try {
    const authorization = request.headers.get('authorization');

    if (!CRON_SECRET || authorization !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json(
        {
          ok: false,
          message: 'No autorizado.',
        },
        { status: 401 }
      );
    }

    if (!ADMIN_SECRET) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Falta ADMIN_SECRET en Vercel.',
        },
        { status: 500 }
      );
    }

    const origin = new URL(request.url).origin;

    const response = await fetch(
      `${origin}/api/admin/send-reminders?secret=${encodeURIComponent(
        ADMIN_SECRET
      )}&execute=true`,
      {
        method: 'GET',
        cache: 'no-store',
      }
    );

    const data = await response.json();

    if (!response.ok || !data.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Error ejecutando recordatorios desde cron.',
          detail: data,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'Recordatorios enviados correctamente desde cron.',
      result: data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: `Error en cron de recordatorios: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 }
    );
  }
}
