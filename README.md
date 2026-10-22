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

## ML Backend: Financial Metric Prediction

Predicts how an Amazon **U.S.** product will perform financially, so vendors and entrepreneurs can make better investment decisions.
This part of the project covers data preparation, model training and a Python `predict` interface that the web app's API can call.

> **Data note:** the source data is an Amazon India scrape (`amazon.csv`, 1,465 rows) localised to the U.S. market.
> Sales, costs and dates don't exist in the scrape, so they are **simulated** from U.S. Amazon fee schedules and industry
> benchmarks (notebook 03). The predictions are realistic in scale and behaviour, but they aren't real seller data.

### What it predicts

| Use case | Method | Outputs |
|---|---|---|
| **"Should I invest in / launch this product?"** | `predict_launch(ProductInput)` | first 12 and 24 months: units, demand, demand share %, price, revenue, profit, margin %, ROI %; months to break even; chance it never pays back |
| **"How will my product do next month?"** | `predict_next_month(product_id, promo_depth_pct=None)` | units, demand, demand share %, price, revenue, profit, margin %, ROI per unit, cumulative ROI, plus a **demand trend** (increase / decrease vs last month) |
| **"How will my product do this year?"** | `predict_year(product_id, year)` | units, demand, demand share %, price, revenue, profit, margin %, ROI (year and cumulative), plus **demand change vs last year** (% and increase / decrease) |

Every prediction comes with a `plus_minus` (the model's typical error on unseen test data) and a `range`.

**Demand trends** come from the demand forecast compared with the last actual period, not from a separate model:
the monthly increase/decrease is right ~82% of the time; the yearly change is right ~87% on direction and typically ±7 % points.

### Quick start

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/pip install .            # installs the marketlens package (re-run after changing src/)
.venv/bin/python -m pytest         # 29 tests
.venv/bin/python scripts/example_predictions.py
```

```python
from marketlens import MarketLensPredictor, ProductInput

predictor = MarketLensPredictor()          # loads models/final (~1 s)

# 1) Launch / investment: a listing, or a new idea benchmarked on a comparable competitor
result = predictor.predict_launch(ProductInput(
    category="Cell Phones & Accessories",  # one of the U.S. categories in data/reference/us_category_assumptions.csv
    price=29.99, list_price=39.99,
    review_count=1200,                     # market traction: ratings on the listing / comparable competitor
    months_on_market=10,                   # how long that listing has been on Amazon
    sub_category="PowerBanks", brand="Ambrane", name="Ambrane 10000mAh power bank",
    # optional: rating, landed_cost, weight_lb, size_tier, launch_month, n_bullets, review_sentiment, ...
))
result["predictions"]["revenue_12m"]
# {'label': 'Revenue, first 12 months', 'value': 443985.11, 'unit': 'USD', 'plus_minus': 139855.31, 'range': [...]}

# 2) Next month for a catalogue product (optionally with a planned discount)
predictor.predict_next_month("B07JW9H4J1")
predictor.predict_next_month("B07JW9H4J1", promo_depth_pct=20)

# 3) Full year
predictor.predict_year("B07JW9H4J1", 2026)
```

All results are plain JSON-serialisable dicts, ready to return from an API endpoint.

The package finds the project folder (the one holding `models/final`) automatically when run from inside it.
Elsewhere, set `MARKETLENS_ROOT=/path/to/MarketLens`.

### Project structure

```
amazon.csv                      raw scrape (input)
notebooks/                      the full pipeline, run in order
  01_data_cleaning              parse, fix, dedupe, map to U.S. categories, localise prices to USD
  02_eda                        distributions, drivers, correlations
  03_feature_engineering        U.S. FBA economics + simulated monthly history -> all financial targets
  04_model_ready_split          lag features, leakage-safe feature lists, train/test splits
  05_model_training             v1 models (36), early stopping, baselines
  06_model_improvement          v2: fixes, traction inputs, final test, retrain on all data -> models/final
  07_targeted_fixes             v3: break-even, launch demand share, yearly profit
                                (afterwards the two demand-growth models were retired: 34 models deployed)
src/marketlens/                 Python package
  config.py                     paths and constants
  cleaning.py                   notebook 01 as functions (reproduces data/interim exactly)
  economics.py                  U.S. Amazon fees, size tiers, landed cost
  features.py                   feature builders (product input, next month, year)
  models.py                     load bundles, predict in real units (handles composite / delta models)
  predictor.py                  MarketLensPredictor: the API-facing entry point
scripts/
  build_inference_reference.py  rebuilds models/final/inference_reference.json after retraining
  example_predictions.py        prints example outputs
tests/                          pytest suite (cleaning, fees, feature parity with training, predictor)
data/
  final/                        model-ready train/test sets + feature_spec.json + data_dictionary.csv
  reference/                    editable business assumptions: category economics, U.S. retail calendar, market sizes
  interim/, processed/          intermediate outputs of notebooks 01 and 03
models/final/                   34 production models + model_registry.csv + encoders + inference_reference.json
reports/                        figures and metrics (model_metrics*.csv)
```

### Model accuracy (held-out test data)

Accuracy = 100 − average % error. R² = how much of the variation the model explains (1.0 = perfect).

| Monthly | Acc. | R² | Yearly | Acc. | R² | Launch (12m / 24m) | Acc. | R² |
|---|---|---|---|---|---|---|---|---|
| Units sold | 80% | 0.90 | Units sold | 78% | 0.93 | Units 12m / 24m | 66% / 67% | 0.76 / 0.74 |
| Demand | 82% | 0.92 | Demand | 76% | 0.91 | Demand 12m | 65% | 0.75 |
| Demand share | 86% | 0.99 | Demand share | 78% | 0.98 | Avg monthly demand | 66% | 0.76 |
| Demand trend (derived) | 82% right direction | | Demand change YoY (derived) | 87% right direction, ±7 pts | 0.64 | Demand share 12m | 73% | 0.90 |
| Price | 95% | 0.99 | Price | 94% | 0.98 | Price 12m | 89% | 0.95 |
| Revenue | 78% | 0.89 | Revenue | 65% | 0.80 | Revenue 12m / 24m | 69% / 69% | 0.90 / 0.91 |
| Net profit | 74% | 0.88 | Net profit | 78% | 0.95 | Profit 12m / 24m | 68% / 66% | 0.90 / 0.90 |
| Margin | 91% | 0.99 | Margin | 88% | 0.98 | Margin 12m / 24m | 89% / 91% | 0.98 / 0.99 |
| ROI per unit | 90% | 0.99 | ROI (year) | 74% | 0.91 | ROI 12m / 24m | 74% / 75% | 0.89 / 0.90 |
| Cumulative ROI | ~99% | 1.00 | Cumulative ROI | 84% | 0.97 | Break-even (≤36m) | 75% | 0.81 |
| | | | | | | Never pays back | 96% | AUC 0.995 |

### Known limitations

- **Demand growth % models were dropped:** month-to-month and year-to-year swings are mostly random in the data, and the dedicated
  models scored 47% / 39%. Trends are now derived from the (much more accurate) demand forecasts instead.
- **Break-even** is capped at 36 months. Longer paybacks are shown as "36+ months", and `never_breaks_even` flags non-payers.
- **Launch predictions need market traction:** review count and months on market of the listing, or of a comparable competitor for a new idea.
- Monthly and yearly forecasts work for the 1,351 catalogue products (history up to Sep 2026). New products use `predict_launch`.
- Training is still in the notebooks (05–07); only inference and cleaning are packaged so far.
- `data/final/monthly_train.csv` is 52 MB (GitHub warns above 50 MB, hard limit 100 MB). Consider Git LFS if the data grows.

## FastAPI backend

The API wraps `MarketLensPredictor` and `ProductInput` without retraining models or duplicating prediction logic. It serves the committed 34 models and catalogue. Models and history are loaded once per server process during startup; missing required files cause startup to fail. There is no database or frontend to start.

### Install and run

Use Python 3.11 or newer (validated with Python 3.12), from the repository root:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m pip install -e '.[api,dev]'
export MARKETLENS_ROOT="$PWD"
export MARKETLENS_CORS_ORIGINS="http://localhost:3000,http://localhost:5173"
python -m uvicorn marketlens.api.app:app --host 127.0.0.1 --port 8000 --reload
```

Alternatively, `pip install -e '.[api,dev]'` alone installs the library, API, and test dependencies without the optional notebook tools; `requirements.txt` pins the versions tested together. `--reload` is for development. Run from the repository root or set `MARKETLENS_ROOT` to its absolute path so the library can find model and data files. Each additional server worker loads its own models and histories.

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
python -m pytest -q                   # existing ML tests plus API tests
python -m pytest tests/test_api.py -q # API contracts with real bundled models
python scripts/example_predictions.py
```

API tests cover real launch/monthly/yearly results, exact preservation of the library outputs and uncertainty, catalogue pagination, validation, unknown IDs, unsupported years, CORS, startup loading/failures, internal errors, and OpenAPI documentation.

The source scrape is Amazon India data localised to the U.S.; sales, costs, and dates used for financial training were simulated. **All forecasts, including monthly/yearly forecasts, inherit this limitation.** Error ranges describe typical held-out model errors and are not guaranteed confidence intervals. The backend exposes only existing financial prediction capabilities; sentiment analysis, competitor intelligence, recommendations, and other planned platform features have no API implementation yet.

An existing ML test, `test_cleaning_reproduces_saved_interim_output`, fails with the pinned dependencies because regenerated prices differ from the saved interim CSV (178 of 1,351 products, all with tied rating counts). This was reproduced before the API work. The cleaning routine assigns seeded random noise after an unstable rating-count sort; reference reproducibility needs a separate ML investigation. The API leaves cleaning code, models, and datasets unchanged.
