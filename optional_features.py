"""
MarketLens: optional features, cleaning and a Random Forest from the random-forest notebook
(product_predictor_rf/), as switches that can be turned on in the pipeline.

    has_discount        1 if the product sells below its list price
    cat_median_price    the category's median price
    cat_sales_encoded   the category's average log(1 + sales), smoothed toward the overall
                        average. Built from sales, so it is out-of-fold on training rows and fit on
                        training rows only.
    notebook_cleaning   the notebook's cleaning rules (list price, missing stars/reviews)
    rf_features, train_rf   the notebook's Random Forest and its 14 inputs, for blending with XGBoost

Also switches for push_auc.py's brand_cat_rate, title_sales_score and similar_titles_rate.
run_experiment.py switches them on one at a time and reports what each one changes.
brand_cat_rate made the cut and is part of train_final.py / predict.py (fit_brand_cat_rate below).
"""
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import KFold

from compare_models import SEED, build_target

OPTIONAL_FEATURES = ["has_discount", "cat_median_price", "cat_sales_encoded"]
RF_REVIEW_COLS = ["stars", "reviews", "has_reviews"]   # dropped for the launch-time forest


def notebook_cleaning(df):
    """Rows with no real list price (missing, 0 or below the price) get list price = price, i.e. no
    discount, and missing stars/reviews become 0. Rows are never removed here: our cleaning already
    drops duplicate ASINs and missing prices, so the test split stays the same."""
    df = df.copy()
    no_list = df["listPrice"].isna() | (df["listPrice"] <= 0) | (df["listPrice"] < df["price"])
    df.loc[no_list, "listPrice"] = df.loc[no_list, "price"]
    df["stars"] = df["stars"].fillna(0)
    df["reviews"] = df["reviews"].fillna(0)
    return df


def has_discount(df):
    list_price = df["listPrice"].replace(0, np.nan)
    return ((1 - df["price"] / list_price) > 0).astype(int).rename("has_discount")


def cat_median_price(df):
    price = df["price"].replace(0, np.nan)
    return price.groupby(df["category_id"]).transform("median").rename("cat_median_price")


def _cat_sales_map(log_sales, cats, smoothing):
    overall = log_sales.mean()
    stats = log_sales.groupby(cats).agg(["mean", "count"])
    return (stats["mean"] * stats["count"] + overall * smoothing) / (stats["count"] + smoothing), overall


def cat_sales_encoded(df, fit_idx, apply_idx, smoothing=20, n_folds=5):
    """Rows in fit_idx get averages from the other folds; rows in apply_idx from all of fit_idx."""
    log_sales = np.log1p(df["boughtInLastMonth"].clip(lower=0))
    cats = df["category_id"]
    out = pd.Series(np.nan, index=df.index, name="cat_sales_encoded")

    def fill(train_rows, pred_rows):
        means, overall = _cat_sales_map(log_sales.loc[train_rows], cats.loc[train_rows], smoothing)
        out.loc[pred_rows] = cats.loc[pred_rows].map(means).fillna(overall).values

    fit_idx = np.asarray(fit_idx)
    for a, b in KFold(n_folds, shuffle=True, random_state=SEED).split(fit_idx):
        fill(fit_idx[a], fit_idx[b])
    if len(apply_idx):
        fill(fit_idx, np.asarray(apply_idx))
    return out


def fit_cat_sales(df, smoothing=20):
    """Category averages from ALL rows, used only to score new products."""
    means, overall = _cat_sales_map(np.log1p(df["boughtInLastMonth"].clip(lower=0)), df["category_id"],
                                    smoothing)
    return {"map": means.to_dict(), "prior": float(overall)}


def fit_brand_cat_rate(brands, cats, y, smoothing=20):
    """Brand x category success rates from ALL rows, used only to score new products. Same smoothing
    as push_auc.brand_cat_rate: pulled toward the category's own rate."""
    cat_rate = y.groupby(cats).mean()
    key = brands.astype(str) + "|" + cats.astype(str)
    stats = pd.DataFrame({"key": key, "cat": cats, "y": y}).groupby("key").agg(
        s=("y", "sum"), n=("y", "count"), cat=("cat", "first"))
    rate = (stats["s"] + smoothing * stats["cat"].map(cat_rate)) / (stats["n"] + smoothing)
    return {"map": rate.to_dict(), "cat_rate": cat_rate.to_dict(), "prior": float(y.mean())}


def apply_brand_cat_rate(fitted, brands, cats):
    key = brands.astype(str) + "|" + cats.astype(str)
    fallback = cats.map(fitted["cat_rate"]).fillna(fitted["prior"])
    return key.map(fitted["map"]).fillna(fallback)


def optional_features(df, names, fit_idx, apply_idx):
    # The last three come from push_auc.py; all three are out-of-fold.
    from improve_xgb import brand_of
    from push_auc import brand_cat_rate, similar_titles_rate, title_sales_score
    titles = df["title"].fillna("")
    y = build_target(df)
    cols = {"has_discount": lambda: has_discount(df),
            "cat_median_price": lambda: cat_median_price(df),
            "cat_sales_encoded": lambda: cat_sales_encoded(df, fit_idx, apply_idx),
            "brand_cat_rate": lambda: brand_cat_rate(titles.map(brand_of), df["category_id"], y,
                                                     fit_idx, apply_idx),
            "title_sales_score": lambda: title_sales_score(
                titles, np.log1p(df["boughtInLastMonth"].clip(lower=0)), fit_idx, apply_idx),
            "similar_titles_rate": lambda: similar_titles_rate(titles, y, fit_idx, apply_idx)}
    unknown = set(names) - set(cols)
    if unknown:
        raise SystemExit(f"unknown optional feature(s): {sorted(unknown)}; choose from {sorted(cols)}")
    return pd.concat([cols[n]() for n in names], axis=1) if names else pd.DataFrame(index=df.index)


def rf_features(df, base, listing, text, cse):
    """The notebook's 14 Random Forest inputs, built from our columns."""
    F = pd.DataFrame(index=df.index)
    F["price"] = df["price"]
    F["discount_pct"] = 100 * base["discount_pct"]
    F["has_discount"] = has_discount(df)
    F["stars"] = df["stars"].fillna(0)
    F["reviews"] = df["reviews"].fillna(0)
    F["has_reviews"] = (F["reviews"] > 0).astype(int)
    F["title_length"] = base["title_len"]
    F["title_words"] = listing["title_words"]
    F["cat_products"] = df.groupby("category_id")["asin"].transform("count")
    F["cat_median_price"] = cat_median_price(df)
    F["price_vs_category"] = base["price_vs_cat_median"]
    F["cat_sales_encoded"] = cse
    F["title_score"] = text["title_score"]
    F["brand_rate"] = text["brand_rate"]
    return F


def train_rf(X_tr, y_tr, X_te, n_estimators=300, min_samples_leaf=50):
    # The notebook's settings (leaf size 50, half the features per split); n_estimators capped at 300.
    model = RandomForestClassifier(n_estimators=n_estimators, min_samples_leaf=min_samples_leaf,
                                   max_features=0.5, n_jobs=-1, random_state=SEED)
    model.fit(X_tr, y_tr)
    return model, model.predict_proba(X_te)[:, 1]
