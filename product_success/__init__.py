"""MarketLens product success model.

The import root is this folder: modules import each other as `predict`, `paths`, `training.*`, `api.*` and
`tools.*`. Run commands from here (`python -m training.train_final`, `uvicorn api.app:app`) or from the repo
root as `python -m product_success.training.train_final`; for the second, this file puts the folder on the path.
"""
import os
import sys

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)
