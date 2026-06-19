import { NextResponse } from 'next/server';

const SUPABASE_URL = 'https://gxqusszgidztjcbjrbiw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET;
const RESEND_API_KEY = process.env.RESEND_API_KEY;

const FROM_EMAIL = 'Franco Trading <onboarding@resend.dev>';

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
    `?select=id,telegram_id,telegram_username,uid,email,exchange,status,reminder_sent_at` +
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

async function sendReminderEmail({
  email,
  telegramUsername,
  uid,
}: {
  email: string;
  telegramUsername: string | null;
  uid: string;
}) {
  if (!RESEND_API_KEY) {
    throw new Error('Falta RESEND_API_KEY en Vercel.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [email],
      subject: 'Recordatorio para mantener tu acceso a la comunidad',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
          <h2>Recordatorio Franco Trading</h2>

          <p>Hola${telegramUsername ? ` ${telegramUsername}` : ''},</p>

          <p>
            Te recordamos que para seguir formando parte de la comunidad privada de
            <strong>Franco Trading</strong> tenés que cumplir con el volumen mínimo requerido.
          </p>

          <p>
            <strong>Requisito actual:</strong><br />
            2.000 USDT de volumen en los últimos 30 días.
          </p>

          <p>
            UID registrado: <strong>${uid}</strong>
          </p>

          <p>
            El control mensual se realizará en los próximos días. Si ya cumpliste el volumen,
            no tenés que hacer nada.
          </p>

          <p>
            Equipo Franco Trading
          </p>
        </div>
      `,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Resend rechazó el email. Status: ${response.status}. Detalle: ${JSON.stringify(data)}`
    );
  }

  return data;
}

async function updateReminderSentAt(memberId: string) {
  const headers = getSupabaseHeaders();

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/community_members?id=eq.${encodeURIComponent(
      memberId
    )}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        reminder_sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Error actualizando reminder_sent_at. Status: ${response.status}. Detalle: ${errorText}`
    );
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const secret = url.searchParams.get('secret');
    const execute = url.searchParams.get('execute') === 'true';

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
      let action = execute ? 'EMAIL_ENVIADO' : 'SERIA_ENVIADO';
      let emailResult = null;

      if (execute) {
        emailResult = await sendReminderEmail({
          email: member.email,
          telegramUsername: member.telegram_username,
          uid: member.uid,
        });

        await updateReminderSentAt(member.id);
      }

      results.push({
        community_member_id: member.id,
        telegram_id: member.telegram_id,
        telegram_username: member.telegram_username,
        uid: member.uid,
        email: member.email,
        exchange: member.exchange,
        action,
        email_result: emailResult,
      });
    }

    return NextResponse.json({
      ok: true,
      modo: execute ? 'EJECUTA_ENVIO_EMAILS' : 'PRUEBA_NO_ENVIA',
      total_miembros_activos: members.length,
      total_emails: results.length,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: `Error enviando recordatorios: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 }
    );
  }
}
