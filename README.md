# MarketLens: Product Success Model

MarketLens is an AI tool that scores Amazon product ideas from 0 to 100. This repo holds the
model behind that score: it reads a product's title, price, list price, category, and (if it
has them) its star rating and review count, and predicts how likely it is to become a
**successful** product.

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

`isBestSeller` is **not** used, because Amazon derives it from sales and it would leak the answer.

`predict.py` turns the model's output into the **Opportunity Score**: the share of real products
in the same category that the new product beats, from 0 to 100. Each score comes with the three
features pushing it up and down the most, which are SHAP values from XGBoost.

## Get the data

The model uses the Kaggle dataset
[Amazon Products Dataset 2023 (1.4M Products)](https://www.kaggle.com/datasets/asaniczka/amazon-products-dataset-2023-1-4m-products).

1. Download it from Kaggle (you need a free account), and unzip it.
2. Put `amazon_products.csv` and `amazon_categories.csv` in a `data\` folder in this repo.

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
pip install -r requirements.txt
```

Keep every `.py` file in this one folder. Later scripts import functions from
`compare_models.py` and `improve_xgb.py`.

## Run the pipeline

Run these commands from the repo root, in this order. The paths are written for Windows; on
macOS/Linux use `/`.

| Step | Command | What it does |
|------|---------|--------------|
| 1 | `python clean_data.py --data data\amazon_products.csv --categories-file data\amazon_categories.csv --out data\products_clean.csv` | Cleans the raw CSV and writes `cleaning_report.txt`. |
| 2 | `python make_holdout.py --data data\products_clean.csv` | Locks away 10% as `data\products_holdout.csv` (seed 2026). The other 90% is `data\products_dev.csv`. It refuses to overwrite an existing holdout. |
| 3 | `python compare_models.py --data data\products_dev.csv` | Compares Logistic Regression, Random Forest, HistGradientBoosting and XGBoost on the base features. |
| 4 | `python improve_xgb.py --data data\products_dev.csv` | Adds the listing and title/brand text features. Reports ROC-AUC, PR-AUC and within-category ROC-AUC, plus a launch-time run. |
| 5 | `python train_final.py --data data\products_dev.csv` | Trains the final full and launch-time models on all the dev data and saves both to `models\combined_model.joblib` (about 11 minutes on a laptop CPU). |
| 6 | `python predict.py --title "Stainless Steel Insulated Water Bottle 32 oz" --price 24.99 --category "Kitchen & Dining"` | Gives a 0-100 Opportunity Score with its reasons. A product with no stars and no reviews is scored by the launch-time model; add `--stars 4.7 --reviews 3500` and it is scored by the full model. The `model` column says which one was used. Use `--csv ideas.csv --out scored.csv` to score many products at once, and `--model` to pick another saved model. |
| 7 | `python evaluate_holdout.py` | The final test on the holdout. **Run it once**, when you have finished improving the model. |

All splits use seed 42. The dev data is split 80/20 into train and test, stratified by category
and label.

**GPU:** `compare_models.py`, `improve_xgb.py`, `train_final.py` and `push_auc.py` accept `--gpu`
to train XGBoost on an NVIDIA GPU (CUDA). The saved model always scores on the CPU, so
`predict.py` works on any laptop.

**Quick runs:** the training scripts (steps 3-5 and `push_auc.py`) take `--sample N` to use N random rows. For example,
`python improve_xgb.py --data data\products_dev.csv --sample 50000 --no-text` finishes in under
a minute.

`predict.py` reads the data file the model was trained on, to compare new products with real
ones. Keep `data\products_dev.csv` in place after training.

### Helper scripts

| Script | Purpose |
|--------|---------|
| `check_data.py` | Read-only checks: duplicate titles across the split, price outliers, dead categories, missing values. |
| `export_split.py` | Writes `data\split_for_vishal.csv` (`asin`, `train`/`test`): the exact split used by `improve_xgb.py`, so other models can be scored on the same products. |
| `push_auc.py` | Experiments with extra features (brand x category, title sales score, similar titles) and a tuned XGBoost. |
| `check_reviews_match.py` | Checks how many of our products appear in the Amazon Reviews 2023 dataset before anyone builds on it. |

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
(`data\products_holdout.csv`, 138,810 products) with `python evaluate_holdout.py`. Nothing was tuned
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
