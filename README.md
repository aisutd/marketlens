# MarketLens

## Description

MarketLens is an AI-powered product intelligence platform for Amazon entrepreneurs. It analyzes demand, competition, pricing, reviews, keywords, profitability, seasonality, and risk to help users evaluate product opportunities and make data-driven launch decisions.

## Planned Technologies

- Python and JavaScript
- React or Streamlit with Plotly
- FastAPI, Pandas, NumPy, and scikit-learn
- NLP, forecasting, recommendation systems, and PostgreSQL or MongoDB

## Docker Setup

Make sure Docker Desktop is installed and running.

```bash
docker compose up -d
docker compose down
docker compose ps
```

This is a generic starter configuration. The team can add project-specific dependencies and startup commands later.

## Repository layout

Each team keeps its code in its own top-level folder, self-contained: its own README,
requirements and (if it deploys) its own Dockerfile.

| Folder | What it is |
|--------|------------|
| [`product_success/`](product_success/README.md) | The product success model: training, the `predict.py` CLI, and the scoring API on Cloud Run |
| [`sales_forecast/`](sales_forecast/README.md) | The sales forecast: units, revenue, profit, margin, ROI and break-even predictions, and their API |
| [`frontend/`](frontend/README.md) | The web app (React + Vite) |
| `data/` | Shared raw and cleaned CSVs, **gitignored**: every team reads from here, nobody commits it |

## Product success API

The model scores an Amazon product idea from 0 to 100 (the Opportunity Score) and says which
features push it up and down. It runs on Google Cloud Run:

- API: https://marketlens-api-643561615020.us-central1.run.app
- Interactive docs: https://marketlens-api-643561615020.us-central1.run.app/docs

Setup, training, the CLI, running the API locally, tests, deployment and results are in
[`product_success/README.md`](product_success/README.md).

## Contributing

- Branch off `main`, using a name like `<area>-<what>` (for example `frontend-score-page`).
- Open a pull request into `main`. Don't push to `main` directly.
- Never commit data or model files (`.csv`, `.joblib`, `.npy`, `.onnx`, `.parquet`, `data/`,
  `product_success/models/`). The root `.gitignore` blocks them; ask before adding an exception.
- Keep each team's code in its own folder.
