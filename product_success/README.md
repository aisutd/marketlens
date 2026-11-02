# Product success model

Scores Amazon product ideas from 0 to 100. The model reads a product's title, price, list price,
category, and (if it has them) its star rating and review count, and predicts how likely it is to
become a **successful** product. It is served by a FastAPI app on Google Cloud Run.

- Live API: https://marketlens-api-643561615020.us-central1.run.app
- Interactive docs: https://marketlens-api-643561615020.us-central1.run.app/docs

## What the model predicts

A product counts as **successful** if its `boughtInLastMonth` is in the **top 20% of its own
category** and is above 0. Judging each product against its own category means a phone case is
compared with other phone cases, not with groceries.

The model is an XGBoost classifier. It uses the following features:

- **Price:** price, discount, and where the price sits inside its category.
- **Reviews:** star rating, review count, and their rank inside the category.
- **Listing:** brand size, pack/set size, and title shape.
- **Text:** a score learned from the title's words, and the brand's track record. Both are built
  out-of-fold, so the model never scores a title it trained on.
- **Brand in category:** `brand_cat_rate`, the brand's success rate inside this product's category,
  smoothed toward the category's own rate and built out-of-fold.
- **Title meaning:** the title's MiniLM embedding reduced to 32 dimensions with PCA
  (`train_final.py --title-emb`, saved as `models\embed_model.joblib`, the model the API serves).

The launch-time model (for product ideas with no stars or reviews yet) uses tuned XGBoost settings:
a slower learning rate and deeper trees.

`isBestSeller` is **not** used, because Amazon derives it from sales and it would leak the answer.

`predict.py` turns the model's output into the **Opportunity Score**: the share of real products
in the same category that the new product beats, from 0 to 100. Each score comes with the three
features pushing it up and down the most, which are SHAP values from XGBoost.

## Folder layout

| Path | What it is |
|------|------------|
| `training/` | Cleaning, holdout, model comparison, feature experiments, title embeddings and the final training script |
| `predict.py` | Command-line scoring of one product or a CSV |
| `api/` | The FastAPI app, its tests, `categories.json` and the serving requirements |
| `tools/` | Parity checks (API vs `predict.py`, ONNX vs PyTorch), the ONNX export, reference tables, measurements |
| `paths.py` | Where the shared `data\` (repo root) and `models\` (this folder) are, so defaults work from anywhere |
| `Dockerfile`, `.dockerignore`, `.gcloudignore` | The Cloud Run image; the build context is this folder |
| `models\` | Saved models, **gitignored** |

`product_success\` is the import root: modules import each other as `predict`, `training.*`, `api.*`
and `tools.*`. Run the commands below from the **repo root**. Training scripts and tools run as
modules (`python -m product_success.training.train_final`); `predict.py` runs as a file.

## Get the data

The model uses the Kaggle dataset
[Amazon Products Dataset 2023 (1.4M Products)](https://www.kaggle.com/datasets/asaniczka/amazon-products-dataset-2023-1-4m-products).

1. Download it from Kaggle (you need a free account), and unzip it.
2. Put `amazon_products.csv` and `amazon_categories.csv` in the `data\` folder at the repo root.

Alternatively, you can download it with the Kaggle CLI (`pip install kaggle`, with an API token set up):

```
kaggle datasets download -d asaniczka/amazon-products-dataset-2023-1-4m-products -p data --unzip
```

`data\` and `models\` are in `.gitignore`. The dataset has more than 1M rows, so never commit it.

## Setup

You need Python 3.14, which is the version the results below were produced with.

```
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r product_success\requirements.txt
```

The title-embedding model (`--title-emb`, `embed_titles.py`, and `predict.py` with
`models\embed_model.joblib`) also needs `sentence-transformers`, `torch` and `pyarrow`. The exact
training venv is pinned in `api\requirements-freeze.txt`.

## Train

Run these commands from the repo root, in this order. The paths are written for Windows; on
macOS/Linux use `/`.

| Step | Command | What it does |
|------|---------|--------------|
| 1 | `python -m product_success.training.clean_data --data data\amazon_products.csv --categories-file data\amazon_categories.csv --out data\products_clean.csv` | Cleans the raw CSV and writes `cleaning_report.txt`. |
| 2 | `python -m product_success.training.make_holdout --data data\products_clean.csv` | Locks away 10% as `data\products_holdout.csv` (seed 2026). The other 90% is `data\products_dev.csv`. It refuses to overwrite an existing holdout. |
| 3 | `python -m product_success.training.compare_models --data data\products_dev.csv` | Compares Logistic Regression, Random Forest, HistGradientBoosting and XGBoost on the base features. |
| 4 | `python -m product_success.training.improve_xgb --data data\products_dev.csv` | Adds the listing and title/brand text features. Reports ROC-AUC, PR-AUC and within-category ROC-AUC, plus a launch-time run. |
| 5 | `python -m product_success.training.embed_titles --data data\products_dev.csv` | Embeds every dev title with MiniLM into `data\embeddings\` (resumable). |
| 6 | `python -m product_success.training.train_final --data data\products_dev.csv --title-emb` | Trains the final full and launch-time models on all the dev data and saves both to `product_success\models\embed_model.joblib`. Without `--title-emb` it saves `combined_model.joblib`, the model without title embeddings. |
| 7 | `python -m product_success.training.evaluate_holdout` | The final test on the holdout. **Run it once**, when you have finished improving the model. |

All splits use seed 42. The dev data is split 80/20 into train and test, stratified by category
and label.

**GPU:** `compare_models`, `improve_xgb`, `train_final` and `push_auc` accept `--gpu` to train
XGBoost on an NVIDIA GPU (CUDA). The saved model always scores on the CPU, so `predict.py` works
on any laptop.

**Quick runs:** the training scripts (steps 3, 4, 6 and `push_auc`) take `--sample N` to use N
random rows. For example,
`python -m product_success.training.improve_xgb --data data\products_dev.csv --sample 50000 --no-text`
finishes in under a minute.

The saved model stores the absolute path of the data file it was trained on (`data_path`), and
`predict.py` reads that file to compare new products with real ones. Keep `data\products_dev.csv`
in place after training.

Until this layout is merged into `main`, retrain only from `C:\Projects\MarketLens`, so the stored
`data_path` stays `C:\Projects\MarketLens\data\products_dev.csv` and matches the reference tables.

`push_auc.py` holds the experiments behind `brand_cat_rate` and the tuned launch-time settings;
`train_final.py` imports both from it. `optional_features.py` holds the switches brought in from the
random-forest notebook.

## Predict from the command line

```
python product_success\predict.py --title "Hardside Carry On Luggage 20 Inch Spinner Wheels TSA Lock" --price 89.99 --list-price 119.99 --category "Suitcases"
```

This is the demo product: it gets an Opportunity Score of **84** (probability 0.4224) from the
launch-time model. A product with no stars and no reviews is scored by the launch-time model; add
`--stars 4.7 --reviews 3500` and it is scored by the full model. The `model` column says which one
was used. Use `--csv ideas.csv --out scored.csv` to score many products at once, and `--model` to
pick another saved model.

## Run the API locally

The API has its own small set of requirements: no torch, because titles are embedded with ONNX
Runtime. Use a separate venv:

```
python -m venv C:\Projects\venvs\marketlens-api
C:\Projects\venvs\marketlens-api\Scripts\activate
pip install -r product_success\api\requirements-api.txt -r product_success\api\requirements-dev.txt
cd product_success
uvicorn api.app:app --port 8080 --workers 1
```

From the repo root, `uvicorn --app-dir product_success api.app:app --port 8080` does the same. The
models are read from `product_success\models\` (or `MODEL_DIR`). Then open
http://localhost:8080/docs.

| Endpoint | What it does |
|----------|--------------|
| `GET /health` | Status, model version, reference rows |
| `GET /categories` | The categories the model can score |
| `POST /predict` | Product -> `opportunity_score`, `probability`, `model_used` |
| `POST /rescore` | Product and changes -> the new score and the change |
| `POST /reasons` | Product -> up to three reasons up and three down |
| `POST /what-if` | Product and 1 to 20 prices -> the score at each price |

## Test

```
pytest product_success\api\tests
```

55 tests. They check that the API gives exactly the same probability, score and reasons as
`predict.py` on 117 products. With `API_BASE_URL` set, the same tests run against a deployed
service. The parity checks behind them:

```
python -m product_success.tools.check_fast_features    # API features vs predict.py (cached slow path)
python -m product_success.tools.check_onnx_parity      # ONNX vs PyTorch embeddings (needs torch)
```

## Deploy

The API runs on Google Cloud Run from the `Dockerfile` in this folder: one vCPU, 2 GiB of memory,
one uvicorn worker, CPU only. `.gcloudignore` uploads only the Dockerfile, `api\`, `predict.py`,
`paths.py`, the three training modules the API imports and three model items (`embed_model.joblib`,
`reference_tables.joblib`, `minilm-onnx\`). From the repo root:

```
gcloud run deploy marketlens-api --source product_success --region us-central1 --cpu 1 --memory 2Gi --max-instances 1 --allow-unauthenticated --set-env-vars ALLOWED_ORIGINS=http://localhost:3000
```

`gcloud meta list-files-for-upload product_success` lists exactly what would be uploaded.

## Results

These results are on the **dev test split**: 20% of `products_dev.csv`, seed 42.

| Model | ROC-AUC | PR-AUC | ROC-AUC within category |
|-------|--------:|-------:|------------------------:|
| Full model | 0.854 | 0.579 | 0.816 |
| Launch-time model (without the product's own stars and reviews) | 0.817 | 0.509 | 0.768 |
| Baseline: category only | 0.69 | 0.32 | 0.50 |

A random ranking gets a PR-AUC of 0.19, which is the share of successful products.

**ROC-AUC within category** is ROC-AUC computed inside each category and then averaged, weighted
by category size. It only rewards ranking a product against its own category peers, which is what
the Opportunity Score claims to do. That is why the category-only baseline scores exactly 0.50
on it.

### Holdout

The final model (`models\combined_model.joblib`) was scored once on the locked holdout
(`data\products_holdout.csv`, 138,810 products) with `evaluate_holdout`. Nothing was tuned
after this run.

| Model | ROC-AUC | PR-AUC | ROC-AUC within category |
|-------|--------:|-------:|------------------------:|
| Full model | 0.858 | 0.589 | 0.820 |
| Launch-time model | 0.821 | 0.521 | 0.775 |

A random ranking gets a PR-AUC of 0.18 on the holdout. How often holdout products in each
Opportunity Score band were really successful:

| Score band | Full model | Launch-time model |
|-----------:|-----------:|------------------:|
| 0-19 | 3.0% | 4.9% |
| 20-39 | 7.3% | 9.5% |
| 40-59 | 13.9% | 15.1% |
| 60-79 | 23.5% | 22.4% |
| 80-89 | 35.7% | 32.9% |
| 90-100 | 54.4% | 48.7% |

### Cloud Run timings

Measured on 2026-11-01 with
`python -m product_success.tools.measure_api --base-url https://<service>.run.app`: 50 HTTP calls
per case, three runs, timed from the development laptop to the service in `us-central1`. Each cell
gives the lowest and highest of the three runs. The targets apply to the median. Every call includes
the network round trip, which `GET /health` measures (about 37 ms). Subtract it to get the server's
own time.

| Call | Median | p95 | Target (median) | Same call on the laptop (median) |
|------|-------:|----:|----------------:|---------------------------------:|
| `GET /health` (round trip) | 36-38 ms | 41-49 ms | | 1 ms |
| `/predict`, new title | 127-130 ms | 166-255 ms | under 200 ms | 79 ms |
| `/rescore`, price change | 192-252 ms | 313-325 ms | under 300 ms | 136 ms |
| `/reasons`, launch-time product | 678-724 ms | 793-1,341 ms | | 526 ms |
| `/reasons`, full product | 184-205 ms | 291-300 ms | | 105 ms |
| `/what-if`, 20 prices | 1,547-1,619 ms | 1,770-2,302 ms | under 2 s | 1,191 ms |

All three medians are within their targets in every run. One score takes about 85-90 ms on a
Cloud Run vCPU against about 65 ms on the laptop (a ThinkPad CPU). `/rescore` scores two products
(the original and the edited one), and `/what-if` scores one per price. `/reasons` on a launch-time
product is the slowest call, because exact SHAP on that model's 3,864 trees takes about 0.5 s.

Memory was not measured on Cloud Run. On the laptop the server's peak working set is 744-851 MB.
