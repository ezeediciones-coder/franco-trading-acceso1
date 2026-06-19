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
            Desde acá se actualiza la base de referidos de BingX, Bitunix y Bitget.
            Cada archivo reemplaza la base anterior del exchange seleccionado.
          </p>
        </div>

        <div style={warningStyle}>
          <strong>Importante:</strong> antes de subir un CSV, asegurate de elegir correctamente
          el exchange. Si elegís Bitget, se borra la base anterior de Bitget y se carga la nueva.
          No afecta BingX ni Bitunix.
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
            <span style={labelTextStyle}>Exchange que querés actualizar</span>

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
          <h2 style={helpTitleStyle}>¿Qué datos necesita el CSV?</h2>

          <p style={helpTextStyle}>
            El archivo puede venir con muchas columnas del exchange, pero el sistema solo usa
            estas columnas importantes:
          </p>

          <div style={infoGridStyle}>
            <div style={infoItemStyle}>
              <strong>uid</strong>
              <span>UID del usuario referido.</span>
            </div>

            <div style={infoItemStyle}>
              <strong>inviter_uid</strong>
              <span>UID referidor de Franco en ese exchange.</span>
            </div>

            <div style={infoItemStyle}>
              <strong>volume_30d</strong>
              <span>Volumen de trading de los últimos 30 días.</span>
            </div>

            <div style={infoItemStyle}>
              <strong>kyc_status</strong>
              <span>Estado KYC. Puede ser YES, NO o UNKNOWN.</span>
            </div>
          </div>

          <div style={miniWarningStyle}>
            Si el CSV trae columnas extra como nombre, fecha, país, email, comisión, balance,
            teléfono u otros datos, el sistema las ignora. Lo importante es que existan UID,
            referidor y volumen.
          </div>

          <h3 style={subTitleStyle}>Formato recomendado</h3>

          <pre style={codeStyle}>{`uid,inviter_uid,volume_30d,kyc_status
10348085,8316719,723967.53,YES
33814876,8316719,482.51,YES`}</pre>

          <p style={helpTextStyle}>
            El exchange no hace falta ponerlo dentro del CSV porque se selecciona arriba en el
            panel. Si elegís BingX, todos los UID del archivo se guardan como BingX. Si elegís
            Bitget, se guardan como Bitget.
          </p>
        </div>

        <div style={stepsBoxStyle}>
          <h2 style={helpTitleStyle}>Pasos recomendados para Fran</h2>

          <ol style={stepsListStyle}>
            <li>Descargar el CSV actualizado desde el exchange.</li>
            <li>Revisar que tenga UID del usuario, UID referidor y volumen de 30 días.</li>
            <li>Entrar a este panel admin.</li>
            <li>Elegir el exchange correcto: BingX, Bitunix o Bitget.</li>
            <li>Subir el CSV y tocar “Actualizar base”.</li>
            <li>Verificar que aparezca el mensaje de carga correcta.</li>
          </ol>
        </div>

        <div style={dangerBoxStyle}>
          <h2 style={dangerTitleStyle}>Qué no hacer</h2>

          <ul style={dangerListStyle}>
            <li>No subir un CSV de Bitget seleccionando BingX.</li>
            <li>No subir archivos Excel .xlsx. Tiene que ser CSV.</li>
            <li>No borrar columnas de UID, referidor o volumen.</li>
            <li>No cargar datos directo en Supabase si no es necesario.</li>
          </ul>
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
  maxWidth: '680px',
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
  fontSize: '20px',
  margin: 0,
  marginBottom: '12px',
};

const subTitleStyle: CSSProperties = {
  fontSize: '16px',
  margin: 0,
  marginTop: '18px',
  marginBottom: '10px',
  color: '#e5e7eb',
};

const helpTextStyle: CSSProperties = {
  color: '#cbd5e1',
  margin: 0,
  marginTop: '12px',
  lineHeight: '1.5',
};

const infoGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '12px',
  marginTop: '16px',
};

const infoItemStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: '12px',
  padding: '12px',
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  color: '#cbd5e1',
  lineHeight: '1.4',
};

const miniWarningStyle: CSSProperties = {
  marginTop: '16px',
  background: 'rgba(79,237,150,0.08)',
  border: '1px solid rgba(79,237,150,0.25)',
  borderRadius: '12px',
  padding: '14px',
  color: '#d1fae5',
  lineHeight: '1.5',
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

const stepsBoxStyle: CSSProperties = {
  marginTop: '18px',
  background: 'rgba(99,217,253,0.08)',
  border: '1px solid rgba(99,217,253,0.20)',
  borderRadius: '16px',
  padding: '18px',
};

const stepsListStyle: CSSProperties = {
  color: '#e0f2fe',
  paddingLeft: '20px',
  margin: 0,
  lineHeight: '1.7',
};

const dangerBoxStyle: CSSProperties = {
  marginTop: '18px',
  background: 'rgba(239,68,68,0.10)',
  border: '1px solid rgba(239,68,68,0.28)',
  borderRadius: '16px',
  padding: '18px',
};

const dangerTitleStyle: CSSProperties = {
  fontSize: '20px',
  margin: 0,
  marginBottom: '12px',
  color: '#fecaca',
};

const dangerListStyle: CSSProperties = {
  color: '#fee2e2',
  paddingLeft: '20px',
  margin: 0,
  lineHeight: '1.7',
};
