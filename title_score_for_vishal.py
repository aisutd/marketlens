# %% [Title score + brand rate for the Random Forest notebook]
# Paste this cell into marketlens_random_forest.ipynb after section 9 (it needs train_df, test_df
# and LABEL), with this repo's folder on sys.path so improve_xgb.py can be imported.
#
# Adds two columns to train_df and test_df, built the same way as in improve_xgb.py:
#   title_score   word + 2-word TF-IDF logistic score of the title
#   brand_rate    smoothed share of the brand's products that are top sellers (brand = first word)
# Training rows are scored out-of-fold (5 folds); test rows by a model fit on all training rows.
# Test labels are never read.
import pandas as pd

from improve_xgb import brand_of, text_features

both = pd.concat([train_df, test_df], ignore_index=True)
n_train = len(train_df)
titles = both["title"].fillna("").astype(str)
brands = titles.map(brand_of)
# Only training labels go in; test rows get a placeholder that text_features never looks at.
y_known = pd.concat([train_df[LABEL].astype(int), pd.Series(0, index=test_df.index)], ignore_index=True)

text = text_features(titles, brands, y_known, both.index[:n_train], both.index[n_train:])
for col in ["title_score", "brand_rate"]:
    train_df[col] = text[col].values[:n_train]
    test_df[col] = text[col].values[n_train:]
print(f"added title_score and brand_rate ({brands.iloc[:n_train].nunique():,} brands in training)")
