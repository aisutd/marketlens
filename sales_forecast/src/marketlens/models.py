"""Load the saved model bundles (models/final) and turn feature rows into predictions in real units."""
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

INVERSE = {
    "log1p": lambda z: np.expm1(z).clip(min=0),
    "slog": lambda z: np.sign(z) * np.expm1(np.abs(z)),
    "none": lambda z: z,
    None: lambda z: z,
}


def load_bundles(models_dir: Path) -> dict:
    """{(level, target): bundle} for every .joblib under models_dir/<level>/."""
    return {(p.parent.name, p.stem): joblib.load(p) for p in sorted(Path(models_dir).glob("*/*.joblib"))}


def predict_target(bundles: dict, level: str, target: str, X: pd.DataFrame) -> np.ndarray:
    """Predict one target for every row of X. X must contain the bundle's feature columns (plus base/extra columns)."""
    b = bundles[(level, target)]
    kind = b.get("kind")
    if kind == "composite_share":        # product demand share = demand / category market size
        demand = np.expm1(b["demand_model"].predict(X[b["features"]]))
        return demand / X["cat_market_size_12m"].to_numpy() * 100
    if kind == "composite_profit":       # yearly profit = revenue (prev-year × growth, or level) × margin
        m, F = b["models"], b["features"]
        prev = X["gross_revenue_prev_year"].fillna(0).to_numpy()
        revenue = np.where(prev > 0, prev * np.exp(m["growth"].predict(X[F])), np.expm1(m["level"].predict(X[F])))
        return revenue * m["margin"].predict(X[F]) / 100
    if b.get("composite"):               # product profit = revenue × margin / 100
        rev_t, margin_t = b["composite"]
        return predict_target(bundles, level, rev_t, X) * predict_target(bundles, level, margin_t, X) / 100
    if b.get("classifier"):
        return b["model"].predict_proba(X[b["features"]])[:, 1]
    pred = INVERSE[b.get("transform")](b["model"].predict(X[b["features"]]))
    if b.get("base_col"):
        pred = pred + X[b["base_col"]].fillna(0).to_numpy()
    if b.get("cap_months"):
        pred = np.minimum(pred, b["cap_months"])
    return pred
