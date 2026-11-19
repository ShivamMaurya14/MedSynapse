#!/usr/bin/env python3
"""
Automated Training Pipeline: Coronary Heart Disease Diagnostic Model
Architecture: Random Forest Classifier (100 Estimators) + StandardScaler
Dataset: Cleveland Heart Disease Database (UCI)
"""

import os
import urllib.request
import pickle
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score

DATA_URL = "https://raw.githubusercontent.com/Bhawesh-007/MedSynapse/main/datasets/heart.csv"
FALLBACK_URL = "https://archive.ics.uci.edu/ml/machine-learning-databases/heart-disease/processed.cleveland.data"

COLUMNS = ["age", "sex", "cp", "trestbps", "chol", "fbs", "restecg", "thalach", "exang", "oldpeak", "slope", "ca", "thal", "target"]

def load_or_download_data(data_dir: str = "data/raw") -> pd.DataFrame:
    os.makedirs(data_dir, exist_ok=True)
    csv_path = os.path.join(data_dir, "heart.csv")
    if not os.path.exists(csv_path):
        print(f"📥 Downloading Heart Disease dataset...")
        try:
            urllib.request.urlretrieve("https://raw.githubusercontent.com/shivam4/datasets/master/heart.csv", csv_path)
        except Exception:
            urllib.request.urlretrieve(FALLBACK_URL, csv_path)
            df_raw = pd.read_csv(csv_path, names=COLUMNS, na_values="?")
            df_raw = df_raw.dropna()
            df_raw["target"] = (df_raw["target"] > 0).astype(int)
            df_raw.to_csv(csv_path, index=False)
            return df_raw
    df = pd.read_csv(csv_path)
    # Standardize column names if uppercase
    df.columns = [c.lower() for c in df.columns]
    if "num" in df.columns:
        df["target"] = (df["num"] > 0).astype(int)
    return df

def train_heart(models_dir: str = "models") -> dict:
    os.makedirs(models_dir, exist_ok=True)
    df = load_or_download_data()
    print(f"Loaded Heart dataset shape: {df.shape}")

    feature_cols = ["age", "sex", "cp", "trestbps", "chol", "fbs", "restecg", "thalach", "exang", "oldpeak", "slope", "ca", "thal"]
    df = df.dropna(subset=feature_cols + ["target"])
    X = df[feature_cols].values
    y = df["target"].values

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    model = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42)
    model.fit(X_train_scaled, y_train)

    y_pred = model.predict(X_test_scaled)
    y_prob = model.predict_proba(X_test_scaled)[:, 1]

    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred)),
        "recall": float(recall_score(y_test, y_pred)),
        "f1": float(f1_score(y_test, y_pred)),
        "roc_auc": float(roc_auc_score(y_test, y_prob))
    }

    print("\n--- Heart Disease Model Test Performance ---")
    for k, v in metrics.items():
        print(f"  {k}: {v:.4f}")

    model_path = os.path.join(models_dir, "heart_model.pkl")
    scaler_path = os.path.join(models_dir, "heart_scaler.pkl")

    with open(model_path, "wb") as f:
        pickle.dump(model, f)
    with open(scaler_path, "wb") as f:
        pickle.dump(scaler, f)

    print(f"✅ Saved model: {model_path}")
    print(f"✅ Saved scaler: {scaler_path}")
    return metrics

if __name__ == "__main__":
    train_heart()
