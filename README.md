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

## FastAPI backend

**Integration prerequisite:** This branch contains Raheel’s FastAPI layer only. Nikhil’s `src/marketlens` prediction library, trained models, reference data, and ML packaging/dependencies must be integrated separately before the API can start or its real-model tests can run. They are intentionally not copied into this branch. The API has already been validated with that ML implementation in `rahemans/marketlens`.

The API wraps `MarketLensPredictor` and `ProductInput` without retraining models or duplicating prediction logic. Once integrated with Nikhil’s work, it serves the 34 trained models and catalogue. Models and history are loaded once per server process during startup; missing required files cause startup to fail. There is no database or frontend to start.

### Install and run

After the team integrates Nikhil’s ML package, use Python 3.11 or newer (validated with Python 3.12), from the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt  # supplied by the ML integration
python -m pip install -e .               # supplied by the ML integration
python -m pip install -r requirements-api.txt
export MARKETLENS_ROOT="$PWD"
export MARKETLENS_CORS_ORIGINS="http://localhost:3000,http://localhost:5173"
python -m uvicorn marketlens.api.app:app --host 127.0.0.1 --port 8000 --reload
```

`requirements-api.txt` contains only the API and HTTP-test dependencies added for this backend. It complements the ML package’s dependency and packaging files; it does not replace them. `--reload` is for development. Run from the repository root or set `MARKETLENS_ROOT` to its absolute path so the library can find model and data files. Each additional server worker loads its own models and histories.

Open `/docs` on your running server for Swagger UI, `/redoc` for ReDoc, and `/openapi.json` for the schema. For a basic readiness check:

```bash
curl http://localhost:8000/health
```

### Endpoints

| Method | Path | Purpose / inputs |
|---|---|---|
| GET | `/health` | Startup readiness and loaded model count |
| GET | `/api/v1/categories` | Supported U.S. category names for launch inputs |
| GET | `/api/v1/products?offset=0&limit=100` | Catalogue with `product_id`, `product_name`, `us_category`, `last_month`; includes `total`, `offset`, `limit` (maximum 500) |
| POST | `/api/v1/predictions/launch` | Required: `category`, `price`, `review_count`, `months_on_market`; optional `ProductInput` fields described in `/docs` |
| POST | `/api/v1/predictions/monthly` | Required: `product_id`; optional `promo_depth_pct` (0 ≤ discount < 100), `everyday_price` (>0 USD) |
| POST | `/api/v1/predictions/yearly` | Required: `product_id`; optional `year` (default 2026), `promo_months` (0–12) |

Monthly forecasts predict the month immediately following the product's latest recorded history, currently October 2026; they do not predict an arbitrary requested month. Yearly forecasts require previous-year history for that product; an unsupported year returns 422. Use catalogue IDs for monthly/yearly requests; use launch predictions for new products. `/api/v1/categories` provides valid category strings.

Successful responses have the form `{"data": ...}`. Prediction `data` contains the original library result, including `predictions`, `notes`, unit economics (launch), and demand trends where available. Each applicable metric retains its `label`, `value`, `unit`, `plus_minus`, and `range`; risk metrics have their original fields. The API does not invent uncertainty for metrics that have none.

Errors use `{"error":{"code":"...","message":"...","details":[]}}`: invalid inputs or unsupported category/year return 422, unknown product IDs return 404, and unexpected failures return a generic 500 with details logged on the server. Validation details identify invalid fields. Extra request fields are rejected. Prices and weights must be positive and finite; rating is >0 and ≤5, list price cannot be below selling price, and counts cannot be negative. Review count and months on market may describe a comparable competitor when evaluating a new idea.

### Requests and future frontend integration

```bash
curl -X POST http://localhost:8000/api/v1/predictions/launch \
  -H 'Content-Type: application/json' \
  -d '{"category":"Cell Phones & Accessories","price":29.99,"list_price":39.99,"review_count":1200,"months_on_market":10}'

curl -X POST http://localhost:8000/api/v1/predictions/monthly \
  -H 'Content-Type: application/json' \
  -d '{"product_id":"B07JW9H4J1","promo_depth_pct":20}'

curl -X POST http://localhost:8000/api/v1/predictions/yearly \
  -H 'Content-Type: application/json' \
  -d '{"product_id":"B07JW9H4J1","year":2026}'
```

The future frontend can make JSON requests using its configured API base URL:

```javascript
const apiBase = "http://localhost:8000"; // configure per deployment
const response = await fetch(`${apiBase}/api/v1/predictions/monthly`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ product_id: "B07JW9H4J1" }),
});
const body = await response.json();
if (!response.ok) throw new Error(body.error.message);
const forecast = body.data;
console.log(forecast.predictions.gross_revenue); // value, unit, plus_minus, range
```

Set `MARKETLENS_CORS_ORIGINS` before starting the server to a comma-separated list of exact frontend origins (scheme, hostname, port; no paths). By default, no cross-origin browser access is enabled. Wildcards are rejected; browser credentials are disabled. CORS is a browser policy, not authentication. Authentication, rate limiting, and deployment hardening remain future integration work; this development API should not be exposed publicly as-is.

### Tests and data limitations

```bash
python -m pytest -q                   # once the ML code and its tests are integrated
python -m pytest tests/test_api.py -q # API contracts with real bundled models
python scripts/example_predictions.py # supplied by the ML integration
```

API tests cover real launch/monthly/yearly results, exact preservation of the library outputs and uncertainty, catalogue pagination, validation, unknown IDs, unsupported years, CORS, startup loading/failures, internal errors, and OpenAPI documentation.

The source scrape is Amazon India data localised to the U.S.; sales, costs, and dates used for financial training were simulated. **All forecasts, including monthly/yearly forecasts, inherit this limitation.** Error ranges describe typical held-out model errors and are not guaranteed confidence intervals. The backend exposes only existing financial prediction capabilities; sentiment analysis, competitor intelligence, recommendations, and other planned platform features have no API implementation yet.

In the source fork’s combined ML/API test suite, an existing ML test, `test_cleaning_reproduces_saved_interim_output`, fails with the pinned dependencies because regenerated prices differ from the saved interim CSV (178 of 1,351 products, all with tied rating counts). This was reproduced before the API work. The cleaning routine assigns seeded random noise after an unstable rating-count sort; reference reproducibility needs a separate ML investigation. The API leaves cleaning code, models, and datasets unchanged.
