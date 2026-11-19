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

The frontend uses a Vite development proxy configured in `vite.config.js` to communicate with the deployed FastAPI backend.

No additional API configuration is required for the current local development setup.