"""
MarketLens step 3: improve XGBoost with new features, and measure what each one adds.

Uses the same cleaned data, label and base features as compare_models.py (keep both files
in the same folder), then trains XGBoost on three (or four) feature sets:

    base         the 10 features from compare_models.py
    + listing    brand size, pack/set size, title shape, rank of price/stars/reviews in category
    + text       a "title score" learned from title words (TF-IDF), and brand track record
    + char text  (only with --char) a second title score from 3-5 letter pieces of words
    launch-time  the best set without the product's own stars and review counts, i.e. what we
                 know about a product idea before it launches (Vishal's "launch-time only" row)

Besides ROC-AUC and PR-AUC it prints "ROC-AUC within category": ROC-AUC worked out inside each
category, then averaged (weighted by size). It only rewards ranking products against their own
category peers, which is what the Opportunity Score claims to do. A category-only baseline
scores 0.50 on it by construction.

Run:
    python improve_xgb.py --data data\\products_clean.csv --sample 200000   # quick, ~2 min
    python improve_xgb.py --data data\\products_clean.csv                   # full data
    python improve_xgb.py --data data\\products_dev.csv --char --sample 300000  # + char n-grams

Text features are built out-of-fold: each training row's title score comes from a model
that never saw that row, and test rows are scored by a model fit only on training rows.
Without this the model would "remember" titles and the test score would be fake.
"""
import argparse
import re
import time

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import HashingVectorizer, TfidfTransformer
from sklearn.pipeline import make_pipeline
from sklearn.linear_model import SGDClassifier
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.model_selection import StratifiedKFold, train_test_split
from xgboost import XGBClassifier

from compare_models import SEED, build_features, build_target, load

# Facts about the product's own reviews, which a product idea doesn't have yet.
REVIEW_COLS = ["stars", "log_reviews", "has_review_count", "stars_pct_in_cat", "reviews_pct_in_cat"]

PACK_RE = re.compile(r"(\d+)\s*[- ]?\s*(?:pack|pk|pcs|pieces?|count|ct|sets?)\b", re.I)


def brand_of(title):
    # The first word of an Amazon title is usually the brand ("Samsonite Winfield 2 ...").
    first = re.split(r"[\s,|(\-]+", title.strip(), maxsplit=1)[0] if title else ""
    return re.sub(r"[^a-z0-9&']", "", first.lower())


def listing_features(df):
    """Features from columns we already have. None of them look at the label."""
    title = df["title"].fillna("")
    brand = title.map(brand_of)
    cat = df["category_id"]
    reviews = df["reviews"].where(df["reviews"] > 0)
    F = pd.DataFrame(index=df.index)
    F["brand_size_log"] = np.log1p(brand.map(brand.value_counts()))      # big brand or one-off seller
    F["brand_cats"] = brand.map(df.groupby(brand)["category_id"].nunique())
    pack = title.str.extract(PACK_RE, expand=False).astype(float)
    F["pack_count"] = pack.clip(upper=500)
    F["is_set"] = title.str.contains(r"\bset\b|\bpiece\b|\bbundle\b|\bkit\b", case=False).astype(int)
    F["title_words"] = title.str.split().str.len()
    F["title_has_size"] = title.str.contains(r"\d+\s*(?:inch|in\b|\"|oz|ml|lb|cm|mm|ft)", case=False).astype(int)
    F["title_caps_ratio"] = title.str.count(r"[A-Z]") / title.str.len().clip(lower=1)
    F["has_list_price"] = df["listPrice"].replace(0, np.nan).notna().astype(int)
    # Where does this product sit inside its own category? (0 = lowest, 1 = highest)
    F["price_pct_in_cat"] = df["price"].groupby(cat).rank(pct=True)
    F["stars_pct_in_cat"] = df["stars"].replace(0, np.nan).groupby(cat).rank(pct=True)
    F["reviews_pct_in_cat"] = reviews.groupby(cat).rank(pct=True)
    return F, brand


def text_features(titles, brands, y, fit_idx, apply_idx, n_folds=5):
    """Out-of-fold title score and brand success rate.

    Rows in fit_idx get scores from models trained on the other folds; rows in apply_idx
    get scores from a model trained on all of fit_idx.
    """
    out = pd.DataFrame(index=titles.index, columns=["title_score", "brand_rate"], dtype=float)
    prior = y.loc[fit_idx].mean()

    def fit_predict(train_rows, pred_rows):
        # Hashing keeps memory flat on an 8 GB laptop (no giant word list for 1M titles).
        vec = make_pipeline(
            HashingVectorizer(ngram_range=(1, 2), n_features=2**20, alternate_sign=False,
                              norm=None, dtype=np.float32),
            TfidfTransformer(sublinear_tf=True))
        Xt = vec.fit_transform(titles.loc[train_rows])
        clf = SGDClassifier(loss="log_loss", alpha=2e-6, max_iter=20, tol=None, random_state=SEED)
        clf.fit(Xt, y.loc[train_rows])
        out.loc[pred_rows, "title_score"] = clf.decision_function(vec.transform(titles.loc[pred_rows]))
        # Smoothed brand success rate: brands with few products are pulled toward the average.
        stats = y.loc[train_rows].groupby(brands.loc[train_rows]).agg(["sum", "count"])
        rate = (stats["sum"] + 20 * prior) / (stats["count"] + 20)
        out.loc[pred_rows, "brand_rate"] = brands.loc[pred_rows].map(rate).fillna(prior).values

    folds = StratifiedKFold(n_folds, shuffle=True, random_state=SEED)
    fit_idx = np.asarray(fit_idx)
    for k, (a, b) in enumerate(folds.split(fit_idx, y.loc[fit_idx])):
        fit_predict(fit_idx[a], fit_idx[b])
        print(f"  text features: fold {k + 1}/{n_folds} done")
    if len(apply_idx):
        fit_predict(fit_idx, apply_idx)
    return out


def char_title_score(titles, y, fit_idx, apply_idx, n_folds=5, chunk=100_000, epochs=3):
    """Out-of-fold title score from character pieces (3-5 letters, e.g. "wate", "proo").

    Catches word parts, plurals and typos that the word-level score misses. Character
    features are big, so the model learns in chunks of rows (partial_fit) to keep memory
    flat on an 8 GB laptop.
    """
    vec = HashingVectorizer(analyzer="char_wb", ngram_range=(3, 5), n_features=2**21,
                            alternate_sign=False, binary=True, norm="l2", dtype=np.float32)
    out = pd.Series(np.nan, index=titles.index, name="char_title_score")
    rng = np.random.default_rng(SEED)

    def fit_predict(train_rows, pred_rows):
        clf = SGDClassifier(loss="log_loss", alpha=1e-6, random_state=SEED)
        for _ in range(epochs):
            order = rng.permutation(train_rows)
            for i in range(0, len(order), chunk):
                part = order[i:i + chunk]
                clf.partial_fit(vec.transform(titles.loc[part]), y.loc[part], classes=[0, 1])
        for i in range(0, len(pred_rows), chunk):
            part = pred_rows[i:i + chunk]
            out.loc[part] = clf.decision_function(vec.transform(titles.loc[part]))

    folds = StratifiedKFold(n_folds, shuffle=True, random_state=SEED)
    fit_idx = np.asarray(fit_idx)
    for k, (a, b) in enumerate(folds.split(fit_idx, y.loc[fit_idx])):
        fit_predict(fit_idx[a], fit_idx[b])
        print(f"  char features: fold {k + 1}/{n_folds} done")
    if len(apply_idx):
        fit_predict(fit_idx, np.asarray(apply_idx))
    return out.to_frame()


def roc_auc_within_category(y, p, cats):
    """ROC-AUC inside each category, averaged with weights by category size.

    Categories where every test product has the same label are skipped (no ranking to judge).
    """
    frame = pd.DataFrame({"y": np.asarray(y), "p": np.asarray(p), "cat": np.asarray(cats)})
    aucs, sizes = [], []
    for _, g in frame.groupby("cat", observed=True):
        if g["y"].nunique() == 2:
            aucs.append(roc_auc_score(g["y"], g["p"]))
            sizes.append(len(g))
    return float(np.average(aucs, weights=sizes)) if aucs else float("nan")


def train_xgb(X_tr, y_tr, X_val, y_val, X_te):
    pos_weight = (y_tr == 0).sum() / max((y_tr == 1).sum(), 1)
    model = XGBClassifier(
        n_estimators=3000, learning_rate=0.05, max_depth=7, min_child_weight=5,
        subsample=0.8, colsample_bytree=0.8, reg_lambda=2.0, tree_method="hist",
        enable_categorical=True, max_cat_to_onehot=1, scale_pos_weight=pos_weight,
        eval_metric="aucpr", early_stopping_rounds=100, n_jobs=-1, random_state=SEED)
    model.fit(X_tr, y_tr, eval_set=[(X_val, y_val)], verbose=False)
    return model, model.predict_proba(X_te)[:, 1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="products_clean.csv")
    ap.add_argument("--sample", type=int, default=None)
    ap.add_argument("--no-text", action="store_true", help="skip the slower TF-IDF title features")
    ap.add_argument("--char", action="store_true",
                    help="also test character n-gram title features (slower, ~5-10 min on full data)")
    args = ap.parse_args()

    t0 = time.time()
    df = load(args.data, args.sample).reset_index(drop=True)
    y = build_target(df)
    base = build_features(df)
    listing, brand = listing_features(df)
    print(f"rows={len(df):,}  positive rate={y.mean():.1%}")

    # Same test split as compare_models.py, so the scores are comparable.
    strat = df["category_id"].astype(str) + "_" + y.astype(str)
    strat = strat.where(strat.map(strat.value_counts()) >= 10, "rare")
    fit_idx, te_idx = train_test_split(df.index, test_size=0.2, stratify=strat, random_state=SEED)
    tr_idx, val_idx = train_test_split(fit_idx, test_size=0.1, stratify=y.loc[fit_idx], random_state=SEED)

    sets = {"base": base, "+ listing": pd.concat([base, listing], axis=1)}
    if not args.no_text:
        print("building text features (the slow part)...")
        text = text_features(df["title"].fillna(""), brand, y, fit_idx, te_idx)
        sets["+ text"] = pd.concat([base, listing, text], axis=1)
        if args.char:
            print("building character title features...")
            char = char_title_score(df["title"].fillna(""), y, fit_idx, te_idx)
            sets["+ char text"] = pd.concat([base, listing, text, char], axis=1)
    best = list(sets)[-1]
    sets["launch-time"] = sets[best].drop(columns=REVIEW_COLS)

    y_te, cats_te = y.loc[te_idx], df.loc[te_idx, "category_id"]
    # Baseline: every product gets its category's success rate from the training rows.
    cat_rate = y.loc[fit_idx].groupby(df.loc[fit_idx, "category_id"]).mean()
    p_cat = cats_te.map(cat_rate).fillna(y.loc[fit_idx].mean())
    rows = [{"features": "baseline: category only", "n_features": 1,
             "ROC-AUC": roc_auc_score(y_te, p_cat), "PR-AUC": average_precision_score(y_te, p_cat),
             "ROC-AUC within category": roc_auc_within_category(y_te, p_cat, cats_te)}]

    final = None
    for name, X in sets.items():
        t1 = time.time()
        model, p = train_xgb(X.loc[tr_idx], y.loc[tr_idx], X.loc[val_idx], y.loc[val_idx], X.loc[te_idx])
        rows.append({"features": name, "n_features": X.shape[1],
                     "ROC-AUC": roc_auc_score(y_te, p),
                     "PR-AUC": average_precision_score(y_te, p),
                     "ROC-AUC within category": roc_auc_within_category(y_te, p, cats_te),
                     "trees": model.best_iteration + 1, "train_sec": time.time() - t1})
        print(rows[-1])
        if name == best:
            final = (model, X)

    print("\n", pd.DataFrame(rows).round(4).to_string(index=False))
    print(f"baseline PR-AUC (share of positives in test) = {y.loc[te_idx].mean():.4f}")

    model, X = final
    gain = pd.Series(model.get_booster().get_score(importance_type="gain"))
    print("\nTop 15 features by gain (best feature set):\n",
          (gain / gain.sum()).sort_values(ascending=False).head(15).round(4).to_string())
    print(f"\ntotal time {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
