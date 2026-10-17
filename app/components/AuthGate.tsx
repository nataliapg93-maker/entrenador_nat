"use client";

import { useState } from "react";
import { sendMagicLink } from "../lib/supabase";

export default function AuthGate({ configured }: { configured: boolean }) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();

    if (!email.trim()) {
      return;
    }

    setSending(true);
    setError("");

    try {
      await sendMagicLink(email.trim());
      setSent(true);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "No se ha podido enviar el enlace.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="phone">
        <section className="hero">
          <div>
            <p className="eyebrow">Natalia Fit</p>
            <h1>Entra</h1>
            <p>Tus comidas quedan guardadas y las ves desde cualquier movil.</p>
          </div>
        </section>

        <section className="screen">
          {!configured && (
            <article className="card feedback">
              Falta configurar la conexion con la base de datos. Revisa las variables
              NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en Vercel y vuelve a desplegar.
            </article>
          )}

          {configured && sent && (
            <article className="card feedback">
              <span>Revisa tu correo.</span> Te hemos enviado un enlace a {email}. Abrelo en este
              mismo movil y entraras directo, sin contrasena.
            </article>
          )}

          {configured && !sent && (
            <form onSubmit={submit}>
              <article className="card">
                <label htmlFor="email">Tu email</label>
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </article>

              {error && <article className="card feedback">{error}</article>}

              <button className="primary" type="submit" disabled={sending}>
                {sending ? "Enviando..." : "Enviarme el enlace"}
              </button>

              <p className="muted">
                Sin contrasena. Te llega un enlace al correo y con eso entras.
              </p>
            </form>
          )}
        </section>
      </section>
    </main>
  );
}
