"use client";

// Ya no hay registro ni email. La app entra sola con una sesion anonima.
// Esta pantalla solo aparece cuando esa entrada automatica falla.
export default function AuthGate({
  configured,
  error
}: {
  configured: boolean;
  error: string;
}) {
  return (
    <main className="app-shell">
      <section className="phone">
        <section className="hero">
          <div>
            <p className="eyebrow">Natalia Fit</p>
            <h1>Un momento</h1>
            <p>No se ha podido conectar con tus datos.</p>
          </div>
        </section>

        <section className="screen">
          {!configured ? (
            <article className="card feedback">
              Falta configurar la conexion con la base de datos. Revisa las variables
              NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en Vercel y vuelve a
              desplegar.
            </article>
          ) : (
            <article className="card feedback">
              {error || "No se ha podido abrir la sesion. Prueba a recargar la pagina."}
            </article>
          )}

          <button className="primary" type="button" onClick={() => window.location.reload()}>
            Reintentar
          </button>
        </section>
      </section>
    </main>
  );
}
