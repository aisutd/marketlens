# MarketLens Frontend 

## Tech Stack

- **React** — Frontend framework
- **JavaScript (JSX)** — Programming language
- **Vite** — Development server and build tool
- **Tailwind CSS** — Styling
- **React Router** — Client-side routing
- **FastAPI** — Backend API

## Getting Started

### Prerequisites

Make sure you have the following installed:

- Node.js (LTS recommended)
- npm

### 1. Navigate to the Frontend Directory

From the repository root:

```bash
cd frontend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Firebase Authentication

From the `frontend/` directory, copy the example configuration:

```bash
cp .env.example .env.local
```

In the Firebase console, open **Project settings → General → Your apps**, then
select or register a web app. Replace all six placeholders in `.env.local`
with the corresponding values from the web app's Firebase configuration
(`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`,
and `appId`). Under **Authentication → Sign-in method**, enable **Email/Password**.

Vite reads these values at startup and embeds them in production builds.
Restart the development server or rebuild after editing `.env.local`.
Keep `.env.local` out of Git and use only the Firebase web app configuration
here. Service account credentials belong on the backend.

The landing page and anonymous demo work without Firebase. Account routes
show a setup message until authentication is configured.

### 4. Start the Development Server

```bash
npm run dev
```

Open the local URL displayed in your terminal, typically:

`http://localhost:5173`

### 5. Build for Production

```bash
npm run build
```

The production build will be generated in the `dist/` directory.

### 6. Preview the Production Build (Optional)

```bash
npm run preview
```

## Backend Connection

The frontend talks to two APIs, each its own Cloud Run service:

- the **scoring API** (`product_success/`): opportunity score, reasons, price simulation
- the **forecasting API** (`sales_forecast/`): catalogue, launch, monthly and yearly forecasts

### Development

`npm run dev` needs no API configuration. The Vite dev proxy in `vite.config.js`
forwards `/api/forecasting/*` to the forecasting service and `/api/*` to the
scoring service, so the browser only ever talks to the dev server.

### Production build

A production build has no proxy, so it calls both services cross-origin. Before
`npm run build`, set their base URLs (in `.env.production.local`, or as
environment variables in your build job):

```bash
VITE_MARKETLENS_API_URL=https://<scoring-service>.run.app
VITE_FORECASTING_API_URL=https://<forecasting-service>.run.app
```

Each value is the service's own URL, with no trailing path: the app adds
`/predict`, `/api/v1/products` and so on. Values must be `https` (plain `http`
is accepted only for `localhost`). A malformed value stops the app with an error
rather than sending requests, and the user's sign-in token, somewhere else. If
either is left unset, the build falls back to the dev proxy paths, which a static
host cannot serve.

Then allow the frontend's origin on both APIs (exact origins; no wildcards),
alongside any origins already listed:

| API | Variable | Example |
|---|---|---|
| scoring (`product_success`) | `ALLOWED_ORIGINS` | `https://marketlens.web.app,http://localhost:3000` |
| forecasting (`sales_forecast`) | `MARKETLENS_CORS_ORIGINS` | `https://marketlens.web.app,http://localhost:5173` |

With `gcloud run deploy --update-env-vars`, a list containing commas needs a
different delimiter, for example
`--update-env-vars "^@^ALLOWED_ORIGINS=https://marketlens.web.app,http://localhost:3000"`.

Both APIs take the Firebase ID token in the `Authorization` header (no cookies),
and already allow that header and `Content-Type` for `GET` and `POST`.

### Hosting `dist/`

Any static host works. Two things it must do:

- **Serve `index.html` for unknown paths**, so a reload of `/discover` or
  `/product-overview` reaches the app instead of a 404. On Firebase Hosting,
  that is a rewrite of `**` to `/index.html` in `firebase.json`.
- **Be listed as an authorized domain** in Firebase Authentication
  (Authentication > Settings > Authorized domains), or sign-in is refused.

After deploying, sign in, score a product and load a forecast: these touch the
scoring API, the forecasting catalogue and a forecast.
