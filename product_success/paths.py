"""MarketLens: where the data and the models live, so defaults work from the repo root and from product_success/.

    DATA_DIR     data/ at the repo root, shared by every team (gitignored)
    MODELS_DIR   product_success/models/ (gitignored)
"""
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(os.path.dirname(ROOT), "data")
MODELS_DIR = os.path.join(ROOT, "models")
