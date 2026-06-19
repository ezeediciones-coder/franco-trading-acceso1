import { NextResponse } from 'next/server';

const SUPABASE_URL = 'https://gxqusszgidztjcbjrbiw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

type CsvRow = {
  uid: string;
  inviter_uid: string;
  volume_30d: number;
  kyc_status: string;
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

function normalizeExchange(exchange: string) {
  const value = exchange.trim().toLowerCase();

  if (!['bingx', 'bitunix', 'bitget'].includes(value)) {
    throw new Error('Exchange inválido. Usá bingx, bitunix o bitget.');
  }

  return value;
}

function detectSeparator(headerLine: string) {
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semicolonCount = (headerLine.match(/;/g) || []).length;

  return semicolonCount > commaCount ? ';' : ',';
}

function parseCsvLine(line: string, separator: string) {
  const result: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      current += '"';
      i++;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === separator && !insideQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  result.push(current.trim());
  return result;
}

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
}

function parseNumber(value: string) {
  const raw = String(value || '').trim();

  if (!raw) return 0;

  let cleaned = raw.replace(/\s/g, '');

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');

    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (hasComma && !hasDot) {
    cleaned = cleaned.replace(',', '.');
  }

  const number = Number(cleaned);

  return Number.isFinite(number) ? number : 0;
}

function getColumnValue(
  row: Record<string, string>,
  possibleNames: string[]
) {
  for (const name of possibleNames) {
    if (row[name] !== undefined) {
      return row[name];
    }
  }

  return '';
}

function parseCsv(text: string): CsvRow[] {
  const cleanText = text.replace(/\r/g, '').trim();

  if (!cleanText) {
    throw new Error('El CSV está vacío.');
  }

  const lines = cleanText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('El CSV debe tener encabezados y al menos una fila.');
  }

  const separator = detectSeparator(lines[0]);

  const headers = parseCsvLine(lines[0], separator).map(normalizeHeader);

  const rows: CsvRow[] = [];

  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line, separator);

    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    const uid = getColumnValue(row, [
      'uid',
      'user_uid',
      'user_id',
      'userid',
      'account_uid',
    ]).trim();

    const inviterUid = getColumnValue(row, [
      'inviter_uid',
      'referrer_uid',
      'referer_uid',
      'parent_uid',
      'agent_uid',
      'franco_uid',
    ]).trim();

    const volumeRaw = getColumnValue(row, [
      'volume_30d',
      'volume',
      'trading_volume',
      'total_volume',
      'volumen',
      'volumen_30d',
      '30d_volume',
    ]);

    const kycStatus =
      getColumnValue(row, [
        'kyc_status',
        'kyc',
        'verified',
        'verification_status',
      ]).trim() || 'UNKNOWN';

    if (!uid) {
      continue;
    }

    rows.push({
      uid,
      inviter_uid: inviterUid,
      volume_30d: parseNumber(volumeRaw),
      kyc_status: kycStatus,
    });
  }

  if (rows.length === 0) {
    throw new Error(
      'No se encontraron filas válidas. El CSV debe tener como mínimo una columna UID.'
    );
  }

  return rows;
}

async function deleteOldExchangeUsers(exchange: string) {
  const headers = getSupabaseHeaders();

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/exchange_users?exchange=eq.${encodeURIComponent(
      exchange
    )}`,
    {
      method: 'DELETE',
      headers,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `No se pudieron borrar los usuarios anteriores de ${exchange}. Status: ${response.status}. Detalle: ${errorText}`
    );
  }
}

async function insertExchangeUsers(exchange: string, rows: CsvRow[]) {
  const headers = getSupabaseHeaders();
  const chunkSize = 500;

  let inserted = 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);

    const payload = chunk.map((row) => ({
      exchange,
      uid: row.uid,
      inviter_uid: row.inviter_uid,
      volume_30d: row.volume_30d,
      kyc_status: row.kyc_status,
      updated_at: new Date().toISOString(),
    }));

    const response = await fetch(`${SUPABASE_URL}/rest/v1/exchange_users`, {
      method: 'POST',
      headers: {
        ...headers,
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(
        `No se pudieron insertar usuarios. Status: ${response.status}. Detalle: ${errorText}`
      );
    }

    inserted += payload.length;
  }

  return inserted;
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

    if (!ADMIN_SECRET) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Falta ADMIN_SECRET en Vercel.',
        },
        { status: 500 }
      );
    }

    const formData = await request.formData();

    const secret = String(formData.get('secret') || '');
    const exchangeRaw = String(formData.get('exchange') || '');
    const file = formData.get('file');

    if (secret !== ADMIN_SECRET) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Clave admin incorrecta.',
        },
        { status: 401 }
      );
    }

    const exchange = normalizeExchange(exchangeRaw);

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          ok: false,
          message: 'No se recibió ningún archivo CSV.',
        },
        { status: 400 }
      );
    }

    const csvText = await file.text();
    const rows = parseCsv(csvText);

    await deleteOldExchangeUsers(exchange);
    const inserted = await insertExchangeUsers(exchange, rows);

    return NextResponse.json({
      ok: true,
      exchange,
      total_rows_detected: rows.length,
      total_inserted: inserted,
      message: `Base de ${exchange.toUpperCase()} actualizada correctamente. Se cargaron ${inserted} usuarios.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
