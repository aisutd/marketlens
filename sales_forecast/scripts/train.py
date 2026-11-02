"""Retrain all 34 production models from data/final (the training steps of notebooks 05-07 as one command).

    python scripts/train.py                  # saves to models/candidate
    python scripts/train.py --out some/dir

models/final is never changed by this script. For each model it: picks the number of trees on validation data
(where applicable), fits on train and scores once on test, then refits on train + test and saves the model.

The output folder has the model files, model_registry.csv, product_track_record_encoders.joblib and
category_monthly_demand.csv. To adopt the new models after comparing the scores: copy that CSV to data/reference/, the
rest to models/final/, then run scripts/build_inference_reference.py and pytest. Retraining can change predictions.
"""
import argparse
import json
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
from sklearn.metrics import accuracy_score, f1_score, log_loss, mean_absolute_error, r2_score, roc_auc_score
from sklearn.model_selection import StratifiedKFold, train_test_split

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from marketlens.config import BREAK_EVEN_CAP_MONTHS, FINAL, MODELS, PROCESSED, ROOT, SEED  # noqa: E402
from marketlens.models import predict_target  # noqa: E402

PARAMS = dict(learning_rate=0.1, max_leaf_nodes=31, min_samples_leaf=40, l2_regularization=1.0,
              random_state=SEED, early_stopping=False)
STEP, MAX_TREES, PATIENCE = 100, 1500, 3
FORWARD = {"log1p": np.log1p, "none": lambda y: y}
BREAK_EVEN_SETUP = dict(learning_rate=0.05, max_leaf_nodes=31, min_samples_leaf=20, l2_regularization=1.0, max_iter=700)
SHARE_SETUP = dict(learning_rate=0.03, min_samples_leaf=15, max_iter=900, l2_regularization=1.0)
TE_SPECS = {"brand_te_log_revenue": ("brand", "revenue_12m", "log"), "brand_te_log_units": ("brand", "units_sold_12m", "log"),
            "brand_te_margin": ("brand", "margin_pct_12m", "raw"), "leaf_te_log_revenue": ("cat_leaf", "revenue_12m", "log"),
            "leaf_te_log_units": ("cat_leaf", "units_sold_12m", "log")}
K_SMOOTH = 5


def regressor(**params):
    return HistGradientBoostingRegressor(random_state=SEED, early_stopping=False, **params)


def new_model(cfg: dict, trees: int, warm: bool = False):
    if cfg.get("classifier"):
        return HistGradientBoostingClassifier(**PARAMS, class_weight="balanced", max_iter=trees, warm_start=warm)
    return HistGradientBoostingRegressor(**PARAMS, max_features=0.8, loss=cfg.get("loss", "squared_error"),
                                         max_iter=trees, warm_start=warm)


def target_space(df: pd.DataFrame, cfg: dict) -> np.ndarray:
    if cfg.get("classifier"):
        return df[cfg["target"]].to_numpy()
    base = df[cfg["base_col"]].fillna(0).to_numpy() if cfg.get("base_col") else 0
    return FORWARD[cfg["tf"]](df[cfg["target"]].to_numpy() - base)


def make_bundle(cfg: dict, model, trees: int, rows: int) -> dict:
    return {"model": model, "features": cfg["features"], "target": cfg["target"], "level": cfg["level"],
            "transform": cfg.get("tf"), "base_col": cfg.get("base_col"), "loss": cfg.get("loss", "squared_error"),
            "classifier": bool(cfg.get("classifier")), "composite": cfg.get("composite"), "trees": trees,
            "trained_rows": rows, "algorithm": type(model).__name__ if model is not None else "composite: revenue × margin / 100"}


def fit_yearly_profit(df: pd.DataFrame, features: list) -> dict:
    has_prev = df.gross_revenue_prev_year.fillna(0) > 0
    return {"growth": regressor(learning_rate=0.05, max_iter=600, min_samples_leaf=20).fit(
                df[has_prev][features], np.log(df[has_prev].gross_revenue.clip(lower=1) / df[has_prev].gross_revenue_prev_year)),
            "level": regressor(learning_rate=0.1, max_iter=600).fit(df[features], np.log1p(df.gross_revenue)),
            "margin": regressor(learning_rate=0.1, max_iter=300).fit(df[features], df.profit_margin_pct)}


def fit_bundle(cfg: dict, df: pd.DataFrame) -> dict:
    """Fit one model on df (rows with a known target) and return the same bundle format as models/final."""
    d = df[df[cfg["target"]].notna()]
    kind = cfg.get("kind")
    if cfg.get("composite"):
        return make_bundle(cfg, None, 0, len(d))
    if kind == "break_even":
        model = regressor(**BREAK_EVEN_SETUP).fit(d[cfg["features"]], np.log1p(d[cfg["target"]].clip(upper=BREAK_EVEN_CAP_MONTHS)))
        return make_bundle(cfg, model, BREAK_EVEN_SETUP["max_iter"], len(d)) | {
            "cap_months": BREAK_EVEN_CAP_MONTHS, "inputs_note": "output capped at 36 = '36+ months'"}
    if kind == "composite_share":
        d = d[d.cat_market_size_12m.notna()]
        model = regressor(**SHARE_SETUP).fit(d[cfg["features"]], np.log1p(d.avg_monthly_demand_12m))
        return {"kind": kind, "demand_model": model, "features": cfg["features"], "target": cfg["target"], "level": cfg["level"],
                "trees": SHARE_SETUP["max_iter"], "trained_rows": len(d), "algorithm": "composite: demand / market size",
                "formula": "expm1(demand_model) / cat_market_size_12m * 100", "market_reference": "data/reference/category_monthly_demand.csv"}
    if kind == "composite_profit":
        return {"kind": kind, "models": fit_yearly_profit(d, cfg["features"]), "features": cfg["features"], "target": cfg["target"],
                "level": cfg["level"], "trees": 600, "trained_rows": len(d), "algorithm": "composite: (prev revenue × growth) × margin",
                "formula": "revenue × margin/100; revenue = prev-year revenue × exp(growth) if a previous year exists, else expm1(level)"}
    trees = cfg["trees"]
    return make_bundle(cfg, new_model(cfg, trees).fit(d[cfg["features"]], target_space(d, cfg)), trees, len(d))


def choose_trees(cfg: dict, fit_df: pd.DataFrame, val_df: pd.DataFrame) -> int:
    """Add trees in steps; stop after PATIENCE steps without validation improvement."""
    tr, va = fit_df[fit_df[cfg["target"]].notna()], val_df[val_df[cfg["target"]].notna()]
    model, y = new_model(cfg, STEP, warm=True), target_space(tr, cfg)
    best, best_trees, wait, trees = np.inf, STEP, 0, 0
    while trees < MAX_TREES and wait < PATIENCE:
        trees += STEP
        model.set_params(max_iter=trees)
        model.fit(tr[cfg["features"]], y)
        bundle = make_bundle(cfg, model, trees, len(tr))
        pred = predict_target({(cfg["level"], cfg["target"]): bundle}, cfg["level"], cfg["target"], va)
        score = log_loss(va[cfg["target"]], pred) if cfg.get("classifier") else mean_absolute_error(va[cfg["target"]], pred)
        if score < best * (1 - 1e-4):
            best, best_trees, wait = score, trees, 0
        else:
            wait += 1
    return best_trees


def score_test(cfg: dict, bundles: dict, test: pd.DataFrame) -> dict:
    te = test[test[cfg["target"]].notna()]
    if cfg.get("kind") == "composite_share":
        te = te[te.cat_market_size_12m.notna()]
    pred = predict_target(bundles, cfg["level"], cfg["target"], te)
    y = te[cfg["target"]]
    if cfg.get("kind") == "break_even":
        y = y.clip(upper=BREAK_EVEN_CAP_MONTHS)
    if cfg.get("classifier"):
        return {"test_AUC": roc_auc_score(y, pred), "test_accuracy": accuracy_score(y, pred >= 0.5), "test_F1": f1_score(y, pred >= 0.5)}
    return {"test_R2": r2_score(y, pred), "test_MAE": mean_absolute_error(y, pred)}


def te_fit(df: pd.DataFrame, key: str, target: str, kind: str):
    y = np.log1p(df[target]) if kind == "log" else df[target]
    known = y.notna()
    counts, prior = y[known].groupby(df.loc[known, key]).agg(["sum", "count"]), y[known].mean()
    return (counts["sum"] + K_SMOOTH * prior) / (counts["count"] + K_SMOOTH), prior


def add_product_features(train_df: pd.DataFrame, apply_dfs: list) -> tuple:
    """Out-of-fold track-record encodings on train; encodings from all of train on apply_dfs."""
    train_df, out = train_df.copy(), [d.copy() for d in apply_dfs]
    for name in TE_SPECS:
        train_df[name] = np.nan
    for fit_i, val_i in StratifiedKFold(5, shuffle=True, random_state=SEED).split(train_df, train_df.category_group):
        for name, (key, target, kind) in TE_SPECS.items():
            enc, prior = te_fit(train_df.iloc[fit_i], key, target, kind)
            train_df.iloc[val_i, train_df.columns.get_loc(name)] = train_df.iloc[val_i][key].map(enc).fillna(prior).values
    encoders = {}
    for name, (key, target, kind) in TE_SPECS.items():
        enc, prior = te_fit(train_df, key, target, kind)
        encoders[name] = (key, enc, prior)
        for d in out:
            d[name] = d[key].map(enc).fillna(prior)
    med = train_df.groupby("category_group").demand_share_pct_12m.median()
    encoders["cat_median_share_12m"] = ("category_group", med, med.median())
    return train_df, out, encoders


def add_traction_and_market(df: pd.DataFrame, market_size: pd.Series) -> pd.DataFrame:
    df = df.copy()
    df["log_listing_age"] = np.log1p(df.age_months_at_obs_end)
    df["log_reviews_per_month"] = df.log_rating_count - df.log_listing_age
    df["cat_market_size_12m"] = df.product_id.map(market_size)
    df["log_cat_market_size"] = np.log1p(df.cat_market_size_12m)
    return df


def category_market(products: pd.DataFrame) -> tuple:
    """Category demand per month, and each product's average category demand during its first 12 months."""
    panel = pd.read_csv(PROCESSED / "monthly_panel.csv", usecols=["product_id", "month", "age_months", "demand_units"], parse_dates=["month"])
    panel = panel.merge(products[["product_id", "us_category"]], on="product_id", how="inner")
    market = panel.groupby(["us_category", "month"]).demand_units.sum().rename("category_demand_units").reset_index()
    first_year = panel[panel.age_months < 12].merge(market, on=["us_category", "month"])
    return market, first_year.groupby("product_id").category_demand_units.mean()


def model_configs(spec: dict) -> list:
    monthly_f, yearly_f = spec["monthly"]["features"], spec["yearly"]["features"]
    price_f = [f for f in monthly_f if f not in spec["monthly"]["drop_when_target_is_price"] + ["everyday_price"]]
    traction = ["log_rating_count", "log_listing_age", "log_reviews_per_month"]
    break_even_f = spec["product"]["launch_features"] + traction
    launch_f = break_even_f + list(TE_SPECS)
    c = [dict(level="monthly", target=t, tf=tf, features=price_f if t == "avg_price" else monthly_f) for t, tf in {
        "units_sold": "log1p", "demand_units": "log1p", "demand_share_pct": "log1p", "avg_price": "log1p", "gross_revenue": "log1p",
        "profit_margin_pct": "none", "roi_unit_pct": "none"}.items()]
    c.append(dict(level="monthly", target="net_profit", tf="none", loss="absolute_error", features=monthly_f))
    c.append(dict(level="monthly", target="roi_cum_pct", tf="none", base_col="roi_cum_pct_lag1", features=monthly_f))
    c += [dict(level="yearly", target=t, tf=tf, features=yearly_f) for t, tf in {
        "units_sold": "log1p", "demand_units": "log1p", "demand_share_pct": "log1p", "gross_revenue": "log1p",
        "profit_margin_pct": "none", "roi_year_pct": "none", "roi_cum_pct": "none"}.items()]
    c.append(dict(level="yearly", target="avg_price", tf="none", base_col="avg_price_prev_year", loss="absolute_error", features=yearly_f))
    c.append(dict(level="yearly", target="net_profit", kind="composite_profit", features=yearly_f))
    c += [dict(level="product", target=t, tf=tf, features=launch_f) for t, tf in {
        "units_sold_12m": "log1p", "demand_units_12m": "log1p", "avg_monthly_demand_12m": "log1p", "avg_price_12m": "log1p",
        "revenue_12m": "log1p", "margin_pct_12m": "none", "roi_pct_12m": "none", "units_sold_24m": "log1p", "revenue_24m": "log1p",
        "margin_pct_24m": "none", "roi_pct_24m": "none"}.items()]
    c.append(dict(level="product", target="break_even_months", tf="log1p", kind="break_even", features=break_even_f))
    c.append(dict(level="product", target="profit_12m", composite=("revenue_12m", "margin_pct_12m"), features=launch_f))
    c.append(dict(level="product", target="profit_24m", composite=("revenue_24m", "margin_pct_24m"), features=launch_f))
    c.append(dict(level="product", target="demand_share_pct_12m", kind="composite_share", features=break_even_f + ["log_cat_market_size"]))
    c.append(dict(level="product", target="never_breaks_even", tf="none", classifier=True, features=launch_f))
    return c


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--out", type=Path, default=ROOT / "models" / "candidate", help="output folder (default: models/candidate)")
    out_dir = parser.parse_args().out.resolve()
    if out_dir == MODELS.resolve():
        parser.error("refusing to write to models/final: save to another folder, compare, then copy the files over")
    out_dir.mkdir(parents=True, exist_ok=True)

    spec = json.loads((FINAL / "feature_spec.json").read_text())
    m_train = pd.read_csv(FINAL / "monthly_train.csv", parse_dates=["month"])
    m_test = pd.read_csv(FINAL / "monthly_test.csv", parse_dates=["month"])
    y_train, y_test = pd.read_csv(FINAL / "yearly_train.csv"), pd.read_csv(FINAL / "yearly_test.csv")
    p_train, p_test = pd.read_csv(FINAL / "product_train.csv"), pd.read_csv(FINAL / "product_test.csv")

    market, market_size = category_market(pd.concat([p_train, p_test]))
    market.to_csv(out_dir / "category_monthly_demand.csv", index=False)
    p_train, p_test = add_traction_and_market(p_train, market_size), add_traction_and_market(p_test, market_size)
    p_train_te, (p_test_te,), _ = add_product_features(p_train, [p_test])
    p_all, _, encoders = add_product_features(pd.concat([p_train, p_test], ignore_index=True), [])

    val_months = sorted(m_train.month.unique())[-6:]
    p_fit_i, p_val_i = train_test_split(p_train_te.index, test_size=0.2, random_state=SEED, stratify=p_train_te.category_group)
    splits = {"monthly": (m_train[~m_train.month.isin(val_months)], m_train[m_train.month.isin(val_months)]),
              "yearly": (y_train[y_train.year < y_train.year.max()], y_train[y_train.year == y_train.year.max()]),
              "product": (p_train_te.loc[p_fit_i], p_train_te.loc[p_val_i])}
    train_sets = {"monthly": m_train, "yearly": y_train, "product": p_train_te}
    test_sets = {"monthly": m_test, "yearly": y_test, "product": p_test_te}
    all_sets = {"monthly": pd.concat([m_train, m_test], ignore_index=True), "yearly": pd.concat([y_train, y_test], ignore_index=True),
                "product": p_all}

    train_bundles, registry = {}, []
    configs = model_configs(spec)
    for i, cfg in enumerate(configs, 1):
        key, level, target = (cfg["level"], cfg["target"]), cfg["level"], cfg["target"]
        print(f"[{i}/{len(configs)}] {level}/{target}", flush=True)
        if "kind" not in cfg and "composite" not in cfg:
            cfg["trees"] = choose_trees(cfg, *splits[level])
        train_bundles[key] = fit_bundle(cfg, train_sets[level])
        scores = score_test(cfg, train_bundles, test_sets[level])
        final = fit_bundle(cfg, all_sets[level])
        (out_dir / level).mkdir(exist_ok=True)
        joblib.dump(final, out_dir / level / f"{target}.joblib")
        registry.append({"level": level, "target": target, "algorithm": final["algorithm"], "transform": final.get("transform"),
                         "base_col": final.get("base_col"), "loss": final.get("loss"), "trees": final["trees"],
                         "trained_rows": final["trained_rows"], "n_features": len(final["features"]), **scores,
                         "path": f"models/final/{level}/{target}.joblib"})

    joblib.dump({"encoders": encoders, "k_smooth": K_SMOOTH, "specs": TE_SPECS}, out_dir / "product_track_record_encoders.joblib")
    pd.DataFrame(registry).to_csv(out_dir / "model_registry.csv", index=False)
    print(f"Saved {len(registry)} models to {out_dir}. models/final was not changed.")


if __name__ == "__main__":
    main()
