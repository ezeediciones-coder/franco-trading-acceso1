'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';

export default function HomePage() {
  const [mensaje, setMensaje] = useState('');
  const [estado, setEstado] = useState<'aprobado' | 'pendiente' | 'error' | ''>('');
  const [cargando, setCargando] = useState(false);
  const [inviteLink, setInviteLink] = useState('');

  async function verificarUsuario(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setCargando(true);
    setMensaje('');
    setEstado('');
    setInviteLink('');

    const formData = new FormData(e.currentTarget);

    const exchange = String(formData.get('exchange') || '');
    const uid = String(formData.get('uid') || '');
    const telegram = String(formData.get('telegram') || '');
    const email = String(formData.get('email') || '');

    try {
      const response = await fetch('/api/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exchange,
          uid,
          telegram_username: telegram,
          email,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setEstado('error');
        setMensaje(data.message || 'Ocurrió un error al verificar el UID.');
        return;
      }

      if (data.approved) {
        setEstado('aprobado');
        setMensaje(
          '✅ Verificación aprobada. Tu UID cumple con los requisitos para ingresar a la comunidad privada. Usá el link único de acceso para entrar al grupo.'
        );

        if (data.invite_link) {
          setInviteLink(data.invite_link);
        }
      } else {
  setEstado('pendiente');
  setMensaje(
    data.message ||
      '⏳ Tu UID está siendo verificado. Te estaremos avisando por mail cuando actualicemos nuestra base de referidos.'
  );
}
    } catch {
      setEstado('error');
      setMensaje('Ocurrió un error inesperado. Intentá nuevamente en unos minutos.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <div style={{ marginBottom: '24px' }}>
          <p style={brandStyle}>FRANCO TRADING</p>

          <h1 style={titleStyle}>Acceso a la comunidad privada</h1>

          <p style={descriptionStyle}>
            Para ingresar al grupo privado tenés que estar registrado como referido y cumplir
            con el volumen mínimo requerido.
          </p>
        </div>

        <div style={requirementStyle}>
          Requisito actual:{' '}
          <strong>2.000 USDT de volumen en los últimos 30 días.</strong>
        </div>

        <form onSubmit={verificarUsuario}>
          <label style={labelStyle}>
            <span style={labelTextStyle}>Exchange</span>

            <select
              required
              name="exchange"
              defaultValue="bingx"
              style={selectStyle}
            >
              <option value="bingx">BingX</option>
              <option value="bitunix">Bitunix</option>
              <option value="bitget">Bitget</option>
            </select>
          </label>

          <label style={labelStyle}>
            <span style={labelTextStyle}>UID del exchange</span>

            <input
              required
              name="uid"
              placeholder="Ej: 10348085"
              style={inputStyle}
            />
          </label>

          <label style={labelStyle}>
            <span style={labelTextStyle}>Usuario de Telegram</span>

            <input
              required
              name="telegram"
              placeholder="@usuario"
              style={inputStyle}
            />
          </label>

          <label style={{ ...labelStyle, marginBottom: '20px' }}>
            <span style={labelTextStyle}>Correo electrónico</span>

            <input
              required
              type="email"
              name="email"
              placeholder="tuemail@gmail.com"
              style={inputStyle}
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
            {cargando ? 'Verificando...' : 'Verificar y unirme'}
          </button>
        </form>

        {mensaje && (
          <div
            style={{
              ...messageBoxStyle,
              background:
                estado === 'aprobado'
                  ? 'rgba(79,237,150,0.12)'
                  : estado === 'pendiente'
                  ? 'rgba(99,217,253,0.10)'
                  : 'rgba(239,68,68,0.12)',
              border:
                estado === 'aprobado'
                  ? '1px solid rgba(79,237,150,0.35)'
                  : estado === 'pendiente'
                  ? '1px solid rgba(99,217,253,0.30)'
                  : '1px solid rgba(239,68,68,0.35)',
              color:
                estado === 'aprobado'
                  ? '#d1fae5'
                  : estado === 'pendiente'
                  ? '#e0f2fe'
                  : '#fee2e2',
            }}
          >
            <div>{mensaje}</div>

            {inviteLink && (
              <a
                href={inviteLink}
                target="_blank"
                rel="noopener noreferrer"
                style={telegramButtonStyle}
              >
                Entrar al Telegram
              </a>
            )}

            {inviteLink && (
              <p style={linkNoteStyle}>
                Este link es único, vence en 30 minutos y solo puede usarse una vez.
              </p>
            )}
          </div>
        )}
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
  maxWidth: '520px',
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
  fontSize: '34px',
  lineHeight: '1.1',
  margin: 0,
  marginBottom: '12px',
};

const descriptionStyle: CSSProperties = {
  color: '#cbd5e1',
  lineHeight: '1.5',
  margin: 0,
};

const requirementStyle: CSSProperties = {
  background: 'rgba(79,237,150,0.08)',
  border: '1px solid rgba(79,237,150,0.25)',
  borderRadius: '16px',
  padding: '16px',
  marginBottom: '24px',
  color: '#d1fae5',
};

const labelStyle: CSSProperties = {
  display: 'block',
  marginBottom: '14px',
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

const buttonStyle: CSSProperties = {
  width: '100%',
  border: 'none',
  borderRadius: '14px',
  padding: '15px',
  color: '#06111f',
  fontWeight: 800,
  fontSize: '16px',
};

const messageBoxStyle: CSSProperties = {
  marginTop: '20px',
  borderRadius: '16px',
  padding: '16px',
  lineHeight: '1.5',
};

const telegramButtonStyle: CSSProperties = {
  display: 'block',
  marginTop: '16px',
  textAlign: 'center',
  background: '#4FED96',
  color: '#06111f',
  padding: '14px',
  borderRadius: '12px',
  fontWeight: 800,
  textDecoration: 'none',
};

const linkNoteStyle: CSSProperties = {
  marginTop: '12px',
  marginBottom: 0,
  fontSize: '13px',
  color: '#bbf7d0',
};
