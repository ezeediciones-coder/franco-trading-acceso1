'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';

export default function HomePage() {
  const [mensaje, setMensaje] = useState('');
  const [estado, setEstado] = useState<'aprobado' | 'pendiente' | 'error' | ''>('');
  const [cargando, setCargando] = useState(false);

  async function verificarUsuario(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setCargando(true);
    setMensaje('');
    setEstado('');

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
          '✅ Verificación aprobada. Tu UID cumple con los requisitos para ingresar a la comunidad privada. En el próximo paso conectaremos el bot para entregarte un link único de acceso.'
        );
      } else {
        setEstado('pendiente');
        setMensaje(
          '⏳ Tu UID está siendo verificado. Te estaremos avisando por mail en las próximas 24 hs cuando actualicemos nuestra base de referidos.'
        );
      }
    } catch (error) {
      setEstado('error');
      setMensaje('Ocurrió un error inesperado. Intentá nuevamente en unos minutos.');
    } finally {
      setCargando(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f172a, #111827)',
        color: 'white',
        fontFamily: 'Arial, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '520px',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '24px',
          padding: '32px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ marginBottom: '24px' }}>
          <p
            style={{
              color: '#4FED96',
              fontWeight: 700,
              marginBottom: '8px',
              letterSpacing: '0.08em',
              fontSize: '13px',
            }}
          >
            FRANCO TRADING
          </p>

          <h1
            style={{
              fontSize: '34px',
              lineHeight: '1.1',
              margin: 0,
              marginBottom: '12px',
            }}
          >
            Acceso a la comunidad privada
          </h1>

          <p style={{ color: '#cbd5e1', lineHeight: '1.5', margin: 0 }}>
            Para ingresar al grupo privado tenés que estar registrado como referido y cumplir con el volumen mínimo requerido.
          </p>
        </div>

        <div
          style={{
            background: 'rgba(79,237,150,0.08)',
            border: '1px solid rgba(79,237,150,0.25)',
            borderRadius: '16px',
            padding: '16px',
            marginBottom: '24px',
            color: '#d1fae5',
          }}
        >
          Requisito actual: <strong>2.000 USDT de volumen en los últimos 30 días.</strong>
        </div>

        <form onSubmit={verificarUsuario}>
          <label style={{ display: 'block', marginBottom: '14px' }}>
            <span style={{ display: 'block', marginBottom: '6px', color: '#e5e7eb' }}>
              Exchange
            </span>
            <select required name="exchange" style={inputStyle} defaultValue="bingx">
              <option value="bingx">BingX</option>
              <option value="bitunix">Bitunix</option>
            </select>
          </label>

          <label style={{ display: 'block', marginBottom: '14px' }}>
            <span style={{ display: 'block', marginBottom: '6px', color: '#e5e7eb' }}>
              UID del exchange
            </span>
            <input required name="uid" placeholder="Ej: 10348085" style={inputStyle} />
          </label>

          <label style={{ display: 'block', marginBottom: '14px' }}>
            <span style={{ display: 'block', marginBottom: '6px', color: '#e5e7eb' }}>
              Usuario de Telegram
            </span>
            <input required name="telegram" placeholder="@usuario" style={inputStyle} />
          </label>

          <label style={{ display: 'block', marginBottom: '20px' }}>
            <span style={{ display: 'block', marginBottom: '6px', color: '#e5e7eb' }}>
              Correo electrónico
            </span>
            <input required type="email" name="email" placeholder="tuemail@gmail.com" style={inputStyle} />
          </label>

          <button
            type="submit"
            disabled={cargando}
            style={{
              width: '100%',
              border: 'none',
              borderRadius: '14px',
              padding: '15px',
              background: cargando ? '#94a3b8' : '#4FED96',
              color: '#06111f',
              fontWeight: 800,
              fontSize: '16px',
              cursor: cargando ? 'not-allowed' : 'pointer',
            }}
          >
            {cargando ? 'Verificando...' : 'Verificar y unirme'}
          </button>
        </form>

        {mensaje && (
          <div
            style={{
              marginTop: '20px',
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
              borderRadius: '16px',
              padding: '16px',
              lineHeight: '1.5',
            }}
          >
            {mensaje}
          </div>
        )}
      </section>
    </main>
  );
}

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
