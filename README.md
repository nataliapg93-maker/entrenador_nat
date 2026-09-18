# Natalia Fit Strava

Version Next.js preparada para Vercel con conexion segura a Strava.

## Por que esta version existe

El prototipo anterior en `index.html` sirve para ver y probar la interfaz rapido. Para conectar Strava hace falta servidor, porque Strava entrega un `client_secret` que no debe publicarse nunca dentro del HTML.

Esta carpeta ya incluye:

- App mobile-first en blanco, rosa y morado.
- Modulos de nutricion, entrenamiento y progreso.
- Plan mensual de fuerza 3-4 dias/semana compatible con padel y bici.
- Fotos de ejercicios en `public/exercises`.
- Flujo OAuth de Strava:
  - `/api/strava/connect`
  - `/api/strava/callback`
  - `/api/strava/status`
  - `/api/strava/activities`
  - `/api/strava/webhook`
- Flujo Anthropic/Claude para analizar fotos de comida:
  - `/api/food/analyze`

## Pasos para usarlo en Vercel

1. Sube esta carpeta completa a GitHub.

2. Entra en Strava Developers:
   `https://www.strava.com/settings/api`

3. Crea una aplicacion de Strava.

4. En Strava, configura el `Authorization Callback Domain`.
   Si tu app queda en:
   `https://natalia-fit.vercel.app`

   En Strava escribe solo el dominio, sin `https://` y sin ruta:
   `natalia-fit.vercel.app`

   La URL completa que usara la app sera:
   `https://natalia-fit.vercel.app/api/strava/callback`

5. En Vercel, abre el proyecto y entra en:
   `Settings > Environment Variables`

6. Anade estas variables:

   ```txt
   STRAVA_CLIENT_ID=tu_client_id
   STRAVA_CLIENT_SECRET=tu_client_secret
   STRAVA_COOKIE_SECRET=una_frase_larga_privada_de_32_caracteres_o_mas
   NEXT_PUBLIC_APP_URL=https://tu-dominio-de-vercel.vercel.app
   STRAVA_REDIRECT_URI=https://tu-dominio-de-vercel.vercel.app/api/strava/callback
   STRAVA_SCOPES=read,activity:read_all
   STRAVA_WEBHOOK_VERIFY_TOKEN=una_palabra_privada_para_validar_strava
   ANTHROPIC_API_KEY=tu_clave_de_anthropic
   ANTHROPIC_FOOD_MODEL=claude-sonnet-5
   ```

7. Haz redeploy en Vercel.

8. Abre la app y pulsa `Conectar`.

9. En nutricion, pulsa el boton de camara y sube una foto. Claude devolvera ingredientes, pesos y macros. Todo queda editable antes de guardarlo.

## Como queda Strava vinculado

La app ya puede leer las ultimas actividades de Natalia cuando ella abre la aplicacion. Para mostrar el gasto calorico, la app pide a Strava el detalle de cada actividad reciente y usa el campo de calorias cuando Strava lo proporciona.

Para que Strava mande actividades a la app automaticamente justo al subirlas, incluso si Natalia no abre la app, hace falta anadir dos piezas mas:

- Una base de datos para guardar tokens, actividades y calorias.
- Un webhook de Strava para recibir eventos de actividad creada o actualizada.

La ruta `/api/strava/webhook` ya esta creada y responde a la verificacion de Strava. Sin base de datos, el webhook puede recibir el aviso, pero todavia no puede guardar nada de forma fiable porque Vercel ejecuta funciones temporales.

## Como queda Claude conectado

La clave de Anthropic vive en Vercel como `ANTHROPIC_API_KEY`, nunca dentro del navegador. La foto se envia a `/api/food/analyze`, el servidor llama a Claude y devuelve JSON estructurado con:

- Nombre probable del plato.
- Ingredientes detectados.
- Gramos estimados.
- Calorias y macros por ingrediente.
- Confianza y motivo de cada estimacion.

La interfaz permite corregir cada dato porque una foto nunca debe ser una verdad absoluta.

## Desarrollo local

1. Crea un archivo `.env.local` copiando `.env.example`.

2. Rellena tus claves de Strava.

3. Instala dependencias:

   ```bash
   npm install
   ```

4. Arranca la app:

   ```bash
   npm run dev
   ```

5. Abre:
   `http://localhost:3000`

## Importante

No subas `.env.local` a GitHub. Ahi van las claves privadas.

Para una primera version real, esta app guarda la sesion de Strava en una cookie segura y cifrada. Para una app con muchos usuarios o historico completo, el siguiente paso seria anadir base de datos.
