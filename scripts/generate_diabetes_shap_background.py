#!/usr/bin/env python3
"""Generate representative scaled background for Diabetes SHAP explanations."""

import os
from pathlib import Path
import pickle
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATASETS_DIR = ROOT / "datasets" / "diabetes"
DATASETS_DIR.mkdir(parents=True, exist_ok=True)
CSV_PATH = DATASETS_DIR / "diabetes.csv"

# Fetch PIMA Indians dataset if not local
if not CSV_PATH.exists():
    url = "https://raw.githubusercontent.com/plotly/datasets/master/diabetes.csv"
    print(f"Downloading diabetes dataset from {url}...")
    df = pd.read_csv(url)
    df.to_csv(CSV_PATH, index=False)
else:
    df = pd.read_csv(CSV_PATH)

print(f"Loaded dataset: {df.shape}")

# Impute zeros with medians for physiological metrics
zero_cols = ["Glucose", "BloodPressure", "SkinThickness", "Insulin", "BMI"]
for col in zero_cols:
    median_val = df[df[col] != 0][col].median()
    df[col] = df[col].replace(0, median_val)

def categorize_bmi(bmi):
    if bmi < 18.5:
        return 0
    elif 18.5 <= bmi < 25:
        return 1
    elif 25 <= bmi < 30:
        return 2
    else:
        return 3

df["BMI_Cat"] = df["BMI"].apply(categorize_bmi)

feature_cols = [
    "Pregnancies",
    "Glucose",
    "BloodPressure",
    "SkinThickness",
    "Insulin",
    "BMI",
    "DiabetesPedigreeFunction",
    "Age",
    "BMI_Cat",
]

# Load existing production scaler
scaler_path = ROOT / "models" / "diabetes_scaler.pkl"
with open(scaler_path, "rb") as f:
    scaler = pickle.load(f)

# Use a representative cohort of 100 patients for fast & robust interventional SHAP
np.random.seed(42)
sample_indices = np.random.choice(len(df), size=100, replace=False)
sample_df = df.iloc[sample_indices][feature_cols]

scaled_background = scaler.transform(sample_df)

output_dir = ROOT / "models" / "explainability"
output_dir.mkdir(parents=True, exist_ok=True)
output_path = output_dir / "diabetes_background_scaled_9.npy"

np.save(output_path, scaled_background, allow_pickle=False)
print(f"✅ Saved scaled diabetes background: {output_path} (shape={scaled_background.shape})")
