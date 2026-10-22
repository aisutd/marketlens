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
OBS_END = "2026-09-01"           # last month of simulated history
ECOMMERCE_GROWTH_YR = 1.07       # macro index growth used beyond the calendar file
