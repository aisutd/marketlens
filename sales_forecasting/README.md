# MarketLens — Sales Forecasting

This directory contains scripts for data exploration, cleaning, feature engineering, and sales forecasting using Amazon product review datasets.

## 1. Exploratory Data Analysis (`eda.py`)

### Purpose
Explores raw Amazon review datasets to identify data quality issues and analyze review activity before cleaning.

**Features:**
- Displays dataset structure, columns, and data types.
- Identifies missing values and potential duplicates.
- Counts unique products and identifies the most-reviewed products.
- Analyzes monthly review activity.

### Usage

**1. Install dependencies:**
```bash
pip install pandas
```

**2. Configure `eda.py`:**

Update the following variables to match your dataset:

```python
FILE_PATH = "data/All_Beauty.jsonl.gz"
FILE_TYPE = "json"
SAMPLE_SIZE = 10000

USER_COL = "user_id"
PRODUCT_COL = "parent_asin"
DATE_COL = "timestamp"
TIMESTAMP_UNIT = "ms"
```

**3. Run from the project root:**
python sales_forecasting/scripts/eda.py

### Notes
- Supports newline-delimited JSON (`.jsonl.gz`) and CSV files.
- Analyzes the first 10,000
- Does not modify the original dataset.
- Monthly reviews counts represents the loaded sample, not actual sales.


**2. Data Cleaning (clean_data.py)

To be implemented.

3. Feature Engineering (feature_engineering.py)

To be implemented.

4. Model Training (train_model.py)

To be implemented.
