"""
MarketLens product success model: compare Logistic Regression, Random Forest,
HistGradientBoosting and XGBoost on the Kaggle "Amazon Products Dataset 2023 (1.4M)".

Setup:
    pip install scikit-learn xgboost pandas shap
    # Download from https://www.kaggle.com/datasets/asaniczka/amazon-products-dataset-2023-1-4m-products
    # and put amazon_products.csv next to this script.

Run:
    python compare_models.py                    # all rows
    python compare_models.py --sample 200000    # faster first run

Target: a product is "successful" if its boughtInLastMonth is in the top 20%
of its own category (and above 0). isBestSeller is NOT used as a feature,
because it is derived from sales and would leak the answer.
"""
import argparse
import time

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (average_precision_score, brier_score_loss, f1_score,
                             roc_auc_score)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from xgboost import XGBClassifier

SEED = 42


def load(path, sample=None):
    df = pd.read_csv(path)
    if sample and sample < len(df):
        df = df.sample(sample, random_state=SEED)
    return df


def build_target(df):
    # Top 20% of boughtInLastMonth inside each category, and must have sold something.
    cutoff = df.groupby("category_id")["boughtInLastMonth"].transform(lambda s: s.quantile(0.8))
    return ((df["boughtInLastMonth"] >= cutoff) & (df["boughtInLastMonth"] > 0)).astype(int)


def build_features(df):
    X = pd.DataFrame(index=df.index)
    price = df["price"].replace(0, np.nan)          # price 0 means "unknown" in this data
    list_price = df["listPrice"].replace(0, np.nan)  # listPrice 0 means "no list price"
    X["log_price"] = np.log1p(price)
    X["discount_pct"] = (1 - price / list_price).clip(lower=0).fillna(0)
    X["stars"] = df["stars"].replace(0, np.nan)      # 0 stars means "no rating yet"
    # Only ~21% of rows have a review count; 0 means "not scraped", not "no reviews"
    # (best sellers with 2,000 sales/month show 0), so treat it as missing.
    reviews = df["reviews"].where(df["reviews"] > 0)
    X["log_reviews"] = np.log1p(reviews)
    X["has_review_count"] = reviews.notna().astype(int)
    cat_median = price.groupby(df["category_id"]).transform("median")
    X["price_vs_cat_median"] = price / cat_median
    X["cat_size_log"] = np.log1p(df.groupby("category_id")["asin"].transform("count"))
    X["cat_median_reviews_log"] = np.log1p(reviews.groupby(df["category_id"]).transform("median"))
    X["title_len"] = df["title"].fillna("").str.len()
    X["category_id"] = df["category_id"].astype("category")
    return X


def models(numeric_cols, pos_weight):
    # Logistic Regression cannot take NaN or raw categories, so it gets imputation + one-hot.
    from sklearn.impute import SimpleImputer
    lr_prep = ColumnTransformer([
        ("num", make_pipeline(SimpleImputer(strategy="median"), StandardScaler()), numeric_cols),
        ("cat", OneHotEncoder(handle_unknown="ignore", min_frequency=50), ["category_id"]),
    ])
    # Random Forest supports NaN (scikit-learn 1.4+) but not pandas categories,
    # so the category becomes an integer code.
    rf_prep = ColumnTransformer([
        ("num", "passthrough", numeric_cols),
        ("cat", "passthrough", ["category_code"]),
    ])
    return {
        "Logistic Regression": make_pipeline(
            lr_prep, LogisticRegression(max_iter=2000, class_weight="balanced")),
        "Random Forest": make_pipeline(rf_prep, RandomForestClassifier(
            n_estimators=300, min_samples_leaf=20, max_features="sqrt",
            class_weight="balanced_subsample", n_jobs=-1, random_state=SEED)),
        "HistGradientBoosting (sklearn)": HistGradientBoostingClassifier(
            learning_rate=0.1, max_iter=500, early_stopping=True,
            categorical_features="from_dtype", class_weight="balanced", random_state=SEED),
        "XGBoost": XGBClassifier(
            n_estimators=2000, learning_rate=0.05, max_depth=6, subsample=0.8,
            colsample_bytree=0.8, tree_method="hist", enable_categorical=True,
            scale_pos_weight=pos_weight, eval_metric="aucpr",
            early_stopping_rounds=100, n_jobs=-1, random_state=SEED),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="amazon_products.csv")
    ap.add_argument("--sample", type=int, default=None)
    args = ap.parse_args()

    df = load(args.data, args.sample)
    y = build_target(df)
    X = build_features(df)
    numeric_cols = [c for c in X.columns if c != "category_id"]
    print(f"rows={len(X):,}  positive rate={y.mean():.1%}")

    # Stratify on category + label so every category appears in train and test.
    strat = df["category_id"].astype(str) + "_" + y.astype(str)
    strat = strat.where(strat.map(strat.value_counts()) >= 10, "rare")
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, stratify=strat, random_state=SEED)
    X_tr, X_val, y_tr, y_val = train_test_split(X_tr, y_tr, test_size=0.1, stratify=y_tr, random_state=SEED)
    for part in (X_tr, X_val, X_te):
        part["category_code"] = part["category_id"].cat.codes

    pos_weight = (y_tr == 0).sum() / max((y_tr == 1).sum(), 1)
    rows = []
    for name, model in models(numeric_cols, pos_weight).items():
        t0 = time.time()
        if name == "XGBoost":
            cols = numeric_cols + ["category_id"]
            model.fit(X_tr[cols], y_tr, eval_set=[(X_val[cols], y_val)], verbose=False)
            p = model.predict_proba(X_te[cols])[:, 1]
        elif name.startswith("Hist"):
            cols = numeric_cols + ["category_id"]
            model.fit(X_tr[cols], y_tr)
            p = model.predict_proba(X_te[cols])[:, 1]
        else:
            model.fit(X_tr, y_tr)
            p = model.predict_proba(X_te)[:, 1]
        rows.append({
            "model": name,
            "ROC-AUC": roc_auc_score(y_te, p),
            "PR-AUC": average_precision_score(y_te, p),
            "F1@0.5": f1_score(y_te, p >= 0.5),
            "Brier": brier_score_loss(y_te, p),
            "train_sec": time.time() - t0,
        })
        print(rows[-1])

    print("\n", pd.DataFrame(rows).round(4).to_string(index=False))

    # SHAP explanation for the XGBoost model: the "why this score" for the dashboard.
    try:
        import shap
        xgb = models(numeric_cols, pos_weight)["XGBoost"]
        cols = numeric_cols + ["category_id"]
        xgb.fit(X_tr[cols], y_tr, eval_set=[(X_val[cols], y_val)], verbose=False)
        explainer = shap.TreeExplainer(xgb)
        sv = explainer(X_te[cols].head(2000))
        imp = pd.Series(np.abs(sv.values).mean(0), index=cols).sort_values(ascending=False)
        print("\nMean |SHAP| (global feature importance):\n", imp.round(4).to_string())
    except Exception as e:  # SHAP is optional
        print("SHAP step skipped:", e)


if __name__ == "__main__":
    main()
