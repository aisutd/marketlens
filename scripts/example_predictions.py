"""Print example predictions for the three use cases. Run: python scripts/example_predictions.py"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from marketlens import MarketLensPredictor, ProductInput  # noqa: E402


def show(title, result):
    print(f"\n=== {title} ===")
    for key, p in result["predictions"].items():
        extra = p.get("display") or p.get("risk_level") or ""
        pm = f" ± {p['plus_minus']:,.2f}" if p.get("plus_minus") else ""
        print(f"  {p['label']:<45} {p['value']:>14,.2f} {p['unit']:<11}{pm:<16} {extra}")
    if "demand_trend" in result:
        t = result["demand_trend"]
        print(f"  {t['label']:<45} {t['direction']:>14}  (right ~{t['direction_accuracy_pct']:.0f}% of the time)")
    if "demand_change_yoy" in result:
        t = result["demand_change_yoy"]
        if t["value"] is not None:
            print(f"  {t['label']:<45} {t['value']:>+13.1f}% {t['direction']}  (± {t['plus_minus']} pts, direction right ~{t['direction_accuracy_pct']:.0f}%)")
    for n in result.get("notes", []):
        print("  note:", n)


if __name__ == "__main__":
    predictor = MarketLensPredictor()

    idea = ProductInput(category="Cell Phones & Accessories", price=29.99, list_price=39.99, review_count=1200, months_on_market=10,
                        sub_category="PowerBanks", brand="Ambrane", name="Ambrane 10000mAh slim power bank")
    launch = predictor.predict_launch(idea)
    show("Should I invest in this power bank?", launch)
    print("  unit economics:", json.dumps(launch["unit_economics"]))

    pid = "B07JW9H4J1"
    show(f"Next month for {pid}", predictor.predict_next_month(pid))
    show(f"Next month for {pid} with a planned 20% discount", predictor.predict_next_month(pid, promo_depth_pct=20))
    show(f"Full year 2026 for {pid}", predictor.predict_year(pid, 2026))
