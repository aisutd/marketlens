"""Paths and project-wide constants."""
import os
from pathlib import Path

def _find_root() -> Path:
    """Project root = the folder holding models/final. Order: $MARKETLENS_ROOT, source tree, current dir and its parents."""
    if os.environ.get("MARKETLENS_ROOT"):
        return Path(os.environ["MARKETLENS_ROOT"]).resolve()
    for candidate in [Path(__file__).resolve().parents[2], Path.cwd(), *Path.cwd().parents]:
        if (candidate / "models" / "final").is_dir():
            return candidate
    raise FileNotFoundError("Can't find the MarketLens project folder (models/final). Set MARKETLENS_ROOT to its path.")


ROOT = _find_root()

DATA = ROOT / "data"
RAW_CSV = ROOT / "amazon.csv"
INTERIM = DATA / "interim"
PROCESSED = DATA / "processed"
FINAL = DATA / "final"
REFERENCE = DATA / "reference"
MODELS = ROOT / "models" / "final"
INFERENCE_REFERENCE = MODELS / "inference_reference.json"

SEED = 42
FX_INR_PER_USD = 83.0
DISCOUNT_CAP_PCT = 60.0          # U.S. reference-price realism (notebook 01)
BREAK_EVEN_CAP_MONTHS = 36       # break-even model output; 36 means "36+ months" (notebook 07)

# Launch consistency rules (predictor._consistent_launch), measured on the simulated launch data (data/processed)
LAUNCH_AVG_PRICE_VS_PLANNED = (0.85, 1.00)   # first-year average selling price vs the planned price (promos pull it down)
LAUNCH_REVENUE_24M_VS_12M = (1.75, 2.45)     # 24-month revenue / 12-month revenue, 5th-95th percentile
LAUNCH_MARGIN_24M_MINUS_12M = (-1.9, 4.0)    # 24-month margin minus 12-month margin (% points), 5th-95th percentile
LAUNCH_SELL_THROUGH = 0.97                   # units sold / demand when demand would otherwise sit below sales (stock-outs)
LAUNCH_INVENTORY_SHARE = 0.152               # share of first-year units bought as the opening inventory (months 1-3)
# Cumulative share of a year's profit earned by the end of each month (median launch, first and second year)
LAUNCH_PROFIT_CURVE_Y1 = (0.016, 0.053, 0.11, 0.185, 0.276, 0.378, 0.474, 0.581, 0.686, 0.795, 0.898, 1.0)
LAUNCH_PROFIT_CURVE_Y2 = (0.096, 0.189, 0.279, 0.369, 0.457, 0.546, 0.631, 0.704, 0.782, 0.855, 0.93, 1.0)
OBS_END = "2026-09-01"           # last month of simulated history
ECOMMERCE_GROWTH_YR = 1.07       # macro index growth used beyond the calendar file
