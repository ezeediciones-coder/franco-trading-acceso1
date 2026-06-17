'use client';

import { useState } from 'react';

export default function HomePage() {
  const [mensaje, setMensaje] = useState('');

  function verificarUsuario(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setMensaje(
      'Datos recibidos. En el próximo paso vamos a conectar esta página con Supabase para verificar el UID.'
    );
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
            <select
              required
              name="exchange"
              style={inputStyle}
              defaultValue="bingx"
            >
              <option value="bingx">BingX</option>
              <option value="bitunix">Bitunix</option>
            </select>
          </label>

          <label style={{ display: 'block', marginBottom: '14px' }}>
            <span style={{ display: 'block', marginBottom: '6px', color: '#e5e7eb' }}>
              UID del exchange
            </span>
            <input
              required
              name="uid"
              placeholder="Ej: 10348085"
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'block', marginBottom: '14px' }}>
            <span style={{ display: 'block', marginBottom: '6px', color: '#e5e7eb' }}>
              Usuario de Telegram
            </span>
            <input
              required
              name="telegram"
              placeholder="@usuario"
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'block', marginBottom: '20px' }}>
            <span style={{ display: 'block', marginBottom: '6px', color: '#e5e7eb' }}>
              Correo electrónico
            </span>
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
            style={{
              width: '100%',
              border: 'none',
              borderRadius: '14px',
              padding: '15px',
              background: '#4FED96',
              color: '#06111f',
              fontWeight: 800,
              fontSize: '16px',
              cursor: 'pointer',
            }}
          >
            Verificar y unirme
          </button>
        </form>

        {mensaje && (
          <div
            style={{
              marginTop: '20px',
              background: 'rgba(99,217,253,0.10)',
              border: '1px solid rgba(99,217,253,0.30)',
              color: '#e0f2fe',
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

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px',
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.18)',
  background: 'rgba(15,23,42,0.9)',
  color: 'white',
  fontSize: '15px',
  outline: 'none',
};
