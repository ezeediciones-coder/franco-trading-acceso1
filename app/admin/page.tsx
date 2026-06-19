'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';

export default function AdminPage() {
  const [secret, setSecret] = useState('');
  const [exchange, setExchange] = useState('bingx');
  const [file, setFile] = useState<File | null>(null);
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [estado, setEstado] = useState<'ok' | 'error' | ''>('');

  async function subirCsv(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setMensaje('');
    setEstado('');

    if (!secret.trim()) {
      setEstado('error');
      setMensaje('Tenés que ingresar la clave admin.');
      return;
    }

    if (!file) {
      setEstado('error');
      setMensaje('Tenés que seleccionar un archivo CSV.');
      return;
    }

    setCargando(true);

    try {
      const formData = new FormData();
      formData.append('secret', secret.trim());
      formData.append('exchange', exchange);
      formData.append('file', file);

      const response = await fetch('/api/admin/upload-csv', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setEstado('error');
        setMensaje(data.message || 'No se pudo actualizar la base.');
        return;
      }

      setEstado('ok');
      setMensaje(
        `${data.message} Filas detectadas: ${data.total_rows_detected}. Filas insertadas: ${data.total_inserted}.`
      );

      setFile(null);

      const fileInput = document.getElementById('csv-file') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';
    } catch {
      setEstado('error');
      setMensaje('Ocurrió un error inesperado al subir el CSV.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <div style={{ marginBottom: '28px' }}>
          <p style={brandStyle}>FRANCO TRADING</p>

          <h1 style={titleStyle}>Panel Admin</h1>

          <p style={descriptionStyle}>
            Cargá el CSV actualizado de cada exchange para actualizar la base de referidos y volumen.
          </p>
        </div>

        <div style={warningStyle}>
          Al subir un CSV, el sistema borra primero los datos anteriores de ese exchange y carga la base nueva.
        </div>

        <form onSubmit={subirCsv}>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Clave admin</span>

            <input
              required
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Ingresar clave admin"
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            <span style={labelTextStyle}>Exchange</span>

            <select
              required
              value={exchange}
              onChange={(e) => setExchange(e.target.value)}
              style={selectStyle}
            >
              <option value="bingx">BingX</option>
              <option value="bitunix">Bitunix</option>
              <option value="bitget">Bitget</option>
            </select>
          </label>

          <label style={labelStyle}>
            <span style={labelTextStyle}>Archivo CSV</span>

            <input
              id="csv-file"
              required
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={fileStyle}
            />
          </label>

          <button
            type="submit"
            disabled={cargando}
            style={{
              ...buttonStyle,
              background: cargando ? '#94a3b8' : '#4FED96',
              cursor: cargando ? 'not-allowed' : 'pointer',
            }}
          >
            {cargando ? 'Actualizando base...' : 'Actualizar base'}
          </button>
        </form>

        {mensaje && (
          <div
            style={{
              ...messageStyle,
              background:
                estado === 'ok'
                  ? 'rgba(79,237,150,0.12)'
                  : 'rgba(239,68,68,0.12)',
              border:
                estado === 'ok'
                  ? '1px solid rgba(79,237,150,0.35)'
                  : '1px solid rgba(239,68,68,0.35)',
              color: estado === 'ok' ? '#d1fae5' : '#fee2e2',
            }}
          >
            {mensaje}
          </div>
        )}

        <div style={helpBoxStyle}>
          <h2 style={helpTitleStyle}>Formato recomendado del CSV</h2>

          <pre style={codeStyle}>{`uid,inviter_uid,volume_30d,kyc_status
10348085,8316719,723967.53,YES
33814876,8316719,482.51,YES`}</pre>

          <p style={helpTextStyle}>
            El exchange no hace falta ponerlo en el CSV, porque se elige arriba en el panel.
          </p>
        </div>
      </section>
    </main>
  );
}

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background: 'linear-gradient(135deg, #0f172a, #111827)',
  color: 'white',
  fontFamily: 'Arial, sans-serif',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
};

const cardStyle: CSSProperties = {
  width: '100%',
  maxWidth: '620px',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '24px',
  padding: '32px',
  boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
};

const brandStyle: CSSProperties = {
  color: '#4FED96',
  fontWeight: 700,
  marginBottom: '8px',
  letterSpacing: '0.08em',
  fontSize: '13px',
};

const titleStyle: CSSProperties = {
  fontSize: '36px',
  lineHeight: '1.1',
  margin: 0,
  marginBottom: '12px',
};

const descriptionStyle: CSSProperties = {
  color: '#cbd5e1',
  lineHeight: '1.5',
  margin: 0,
};

const warningStyle: CSSProperties = {
  background: 'rgba(250,204,21,0.10)',
  border: '1px solid rgba(250,204,21,0.35)',
  borderRadius: '16px',
  padding: '16px',
  marginBottom: '24px',
  color: '#fef3c7',
  lineHeight: '1.5',
};

const labelStyle: CSSProperties = {
  display: 'block',
  marginBottom: '16px',
};

const labelTextStyle: CSSProperties = {
  display: 'block',
  marginBottom: '6px',
  color: '#e5e7eb',
};

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '14px',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(15,23,42,0.9)',
  color: 'white',
  fontSize: '15px',
  outline: 'none',
};

const selectStyle: CSSProperties = {
  width: '100%',
  padding: '14px',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(15,23,42,0.9)',
  color: 'white',
  fontSize: '15px',
  outline: 'none',
  cursor: 'pointer',
};

const fileStyle: CSSProperties = {
  width: '100%',
  padding: '14px',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(15,23,42,0.9)',
  color: '#cbd5e1',
  fontSize: '15px',
};

const buttonStyle: CSSProperties = {
  width: '100%',
  border: 'none',
  borderRadius: '14px',
  padding: '15px',
  color: '#06111f',
  fontWeight: 800,
  fontSize: '16px',
};

const messageStyle: CSSProperties = {
  marginTop: '20px',
  borderRadius: '16px',
  padding: '16px',
  lineHeight: '1.5',
};

const helpBoxStyle: CSSProperties = {
  marginTop: '28px',
  background: 'rgba(15,23,42,0.65)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: '16px',
  padding: '18px',
};

const helpTitleStyle: CSSProperties = {
  fontSize: '18px',
  margin: 0,
  marginBottom: '12px',
};

const codeStyle: CSSProperties = {
  background: '#020617',
  color: '#bbf7d0',
  padding: '14px',
  borderRadius: '12px',
  overflowX: 'auto',
  fontSize: '13px',
  lineHeight: '1.5',
};

const helpTextStyle: CSSProperties = {
  color: '#cbd5e1',
  margin: 0,
  marginTop: '12px',
  lineHeight: '1.5',
};
