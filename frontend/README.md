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

### 3. Start the Development Server

```bash
npm run dev
```

Open the local URL displayed in your terminal, typically:

`http://localhost:5173`

### 4. Build for Production

```bash
npm run build
```

The production build will be generated in the `dist/` directory.

### 5. Preview the Production Build (Optional)

```bash
npm run preview
```

## Backend Connection

The frontend uses a Vite development proxy configured in `vite.config.js` to communicate with the deployed FastAPI backend.

No additional API configuration is required for the current local development setup.