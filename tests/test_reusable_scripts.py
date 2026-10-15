"""Run using: python -m unittest discover -s tests -v"""
import gzip
import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

import pandas as pd

SOURCE = Path(__file__).resolve().parents[1] / "sales_forecasting" / "scripts"


class TeamScriptsTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name) / "marketlens"
        (self.root / "data").mkdir(parents=True)
        self.scripts = self.root / "sales_forecasting" / "scripts"
        self.scripts.mkdir(parents=True)
        for filename in ("eda.py", "clean_data.py"):
            shutil.copy(SOURCE / filename, self.scripts / filename)

    def run_script(self, name, *args, success=True):
        proc = subprocess.run([sys.executable, str(self.scripts / name), *map(str, args)],
                              cwd=self.root, capture_output=True, text=True)
        if success:
            self.assertEqual(proc.returncode, 0, proc.stderr)
        else:
            self.assertNotEqual(proc.returncode, 0, proc.stdout)
        return proc

    def write_jsonl(self, category, rows):
        destination = self.root / "data" / f"{category}.jsonl.gz"
        with gzip.open(destination, "wt", encoding="utf-8") as output:
            for row in rows:
                output.write(json.dumps(row) + "\n")
        return destination

    def test_all_beauty_jsonl_sample_and_full_preserve_raw(self):
        base = {"asin": "VAR1", "parent_asin": " P1 ", "timestamp": 1680307200000,
                "rating": 5, "title": "Great", "text": "Works", "user_id": " U1 ",
                "helpful_vote": 2, "verified_purchase": True, "images": [{"bad": "nested"}]}
        rows = [base, dict(base), dict(base, user_id="U2", timestamp=1680393600000, rating=8, helpful_vote=-1),
                dict(base, user_id="U3", parent_asin=None),
                dict(base, user_id="U4", timestamp="bad-time"),
                dict(base, user_id="U5", parent_asin="P2", timestamp=1680479999000, verified_purchase=False)]
        source = self.write_jsonl("All_Beauty", rows)
        before = source.read_bytes()
        sample = self.run_script("clean_data.py", "--input", source, "--sample", "3")
        sample_out = self.root / "data/processed/All_Beauty_sample_3_clean.csv"
        self.assertTrue(sample_out.is_file())
        self.assertIn("clean_rows: 2", sample.stdout)
        self.assertFalse((self.root / "data/processed/All_Beauty_clean.csv").exists())

        full = self.run_script("clean_data.py", "--input", source)
        self.assertIn("input_rows: 6", full.stdout)
        self.assertIn("missing_product_ids: 1", full.stdout)
        self.assertIn("invalid_timestamps: 1", full.stdout)
        self.assertIn("duplicates_removed: 1", full.stdout)
        self.assertIn("clean_rows: 3", full.stdout)
        df = pd.read_csv(self.root / "data/processed/All_Beauty_clean.csv")
        self.assertEqual(len(df), 3)
        self.assertTrue(set(df.parent_asin) == {"P1", "P2"})
        self.assertTrue((df.review_month == "2023-04").all())
        self.assertEqual(int(df.rating.isna().sum()), 1)
        self.assertEqual(int(df.helpful_vote.isna().sum()), 1)
        self.assertNotIn("images", df.columns)
        self.assertEqual(before, source.read_bytes())

    def test_other_category_and_csv(self):
        rows = [
            {"parent_asin": "E001", "timestamp": 1672531200000, "user_id": "buyer1", "rating": 4},
            {"parent_asin": "E002", "timestamp": 1675209600000, "user_id": "buyer2", "rating": 5},
        ]
        electronic_source = self.write_jsonl("Electronics", rows)
        r = self.run_script("eda.py", "--input", electronic_source, "--sample", "2")
        self.assertIn("Unique product families: 2", r.stdout)
        self.assertIn("2023-01", r.stdout)
        self.run_script("clean_data.py", "--input", electronic_source)
        self.assertTrue((self.root / "data/processed/Electronics_clean.csv").is_file())
        csv_path = self.root / "data" / "Home_and_Kitchen.csv"
        pd.DataFrame(rows).to_csv(csv_path, index=False)
        self.run_script("clean_data.py", "--input", csv_path)
        self.assertTrue((self.root / "data/processed/Home_and_Kitchen_clean.csv").is_file())

    def test_missing_user_id_is_not_used_for_unsafe_deduplication(self):
        rows = [{"parent_asin": "B", "timestamp": 1660000000000, "rating": 4},
                {"parent_asin": "B", "timestamp": 1660000000000, "rating": 4}]
        source = self.write_jsonl("Gift_Cards", rows)
        r = self.run_script("clean_data.py", "--input", source)
        self.assertIn("duplicates_removed: 0", r.stdout)
        self.assertIn("clean_rows: 2", r.stdout)

    def test_invalid_columns_or_sample_fail_safely(self):
        bad_input = self.write_jsonl("Bad", [{"rating": 5, "timestamp": 1672531200000}])
        self.assertIn("Required Amazon Reviews 2023 columns missing", self.run_script(
            "clean_data.py", "--input", bad_input, success=False).stderr)
        self.assertIn("--sample must be a positive integer", self.run_script(
            "clean_data.py", "--input", bad_input, "--sample", "0", success=False).stderr)
        csv_path = self.root / "data" / "bad.csv"
        pd.DataFrame([{"parent_asin": "X", "timestamp": 1672531200000}]).to_csv(csv_path, index=False)
        self.assertIn("cannot overwrite the raw input", self.run_script(
            "clean_data.py", "--input", csv_path, "--output", csv_path, success=False).stderr)


if __name__ == "__main__":
    unittest.main()
