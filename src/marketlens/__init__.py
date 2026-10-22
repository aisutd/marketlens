"""MarketLens: Amazon U.S. product financial-performance prediction."""
from .features import ProductInput
from .predictor import MarketLensPredictor

__all__ = ["MarketLensPredictor", "ProductInput"]
__version__ = "0.1.0"
