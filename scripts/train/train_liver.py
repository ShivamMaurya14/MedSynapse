#!/usr/bin/env python3
"""
Automated Training Pipeline: Hepatic / Liver Disease Diagnostic Model
Architecture: Random Forest Classifier + Gradient Boosting + StandardScaler
Dataset: Indian Liver Patient Dataset (ILPD / UCI)
"""

import os
import urllib.request
import pickle
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score

DATA_URL = "https://archive.ics.uci.edu/ml/machine-learning-databases/00225/Indian%20Liver%20Patient%20Dataset%20(ILPD).csv"
COLUMNS = [
    "Age", "Gender", "Total_Bilirubin", "Direct_Bilirubin", "Alkaline_Phosphotase",
    "Alamine_Aminotransferase", "Aspartate_Aminotransferase", "Total_Protiens",
    "Albumin", "Albumin_and_Globulin_Ratio", "Dataset"
]

def load_or_download_data(data_dir: str = "data/raw") -> pd.DataFrame:
    os.makedirs(data_dir, exist_ok=True)
    csv_path = os.path.join(data_dir, "liver.csv")
    if not os.path.exists(csv_path):
        print(f"📥 Downloading Liver Disease ILPD dataset...")
        try:
            urllib.request.urlretrieve(DATA_URL, csv_path)
        except Exception:
            urllib.request.urlretrieve("https://raw.githubusercontent.com/Bhawesh-007/MedSynapse/main/datasets/liver.csv", csv_path)
    df = pd.read_csv(csv_path, names=COLUMNS)
    return df

def train_liver(models_dir: str = "models") -> dict:
    os.makedirs(models_dir, exist_ok=True)
    df = load_or_download_data()
    print(f"Loaded Liver dataset shape: {df.shape}")

    # Encode Gender: Male -> 1, Female -> 0
    df["Gender"] = df["Gender"].apply(lambda x: 1 if str(x).strip().lower() == "male" else 0)

    # Handle missing A/G Ratio with median
    if df["Albumin_and_Globulin_Ratio"].isnull().any():
        median_ag = df["Albumin_and_Globulin_Ratio"].median()
        df["Albumin_and_Globulin_Ratio"] = df["Albumin_and_Globulin_Ratio"].fillna(median_ag)

    # Encode target: Dataset: 1 (Disease) -> 1, 2 (No disease) -> 0
    df["target"] = df["Dataset"].apply(lambda x: 1 if x == 1 else 0)

    feature_cols = [
        "Age", "Gender", "Total_Bilirubin", "Direct_Bilirubin", "Alkaline_Phosphotase",
        "Alamine_Aminotransferase", "Aspartate_Aminotransferase", "Total_Protiens",
        "Albumin", "Albumin_and_Globulin_Ratio"
    ]

    X = df[feature_cols].values
    y = df["target"].values

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    rf_model = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42)
    rf_model.fit(X_train_scaled, y_train)

    gbc_model = GradientBoostingClassifier(n_estimators=100, learning_rate=0.05, max_depth=3, random_state=42)
    gbc_model.fit(X_train_scaled, y_train)

    lr_model = LogisticRegression(max_iter=1000, random_state=42)
    lr_model.fit(X_train_scaled, y_train)

    y_pred = rf_model.predict(X_test_scaled)
    y_prob = rf_model.predict_proba(X_test_scaled)[:, 1]

    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred)),
        "recall": float(recall_score(y_test, y_pred)),
        "f1": float(f1_score(y_test, y_pred)),
        "roc_auc": float(roc_auc_score(y_test, y_prob))
    }

    print("\n--- Liver Disease Model Test Performance ---")
    for k, v in metrics.items():
        print(f"  {k}: {v:.4f}")

    model_path = os.path.join(models_dir, "liver_model.pkl")
    rf_path = os.path.join(models_dir, "liver_rf_model.pkl")
    gbc_path = os.path.join(models_dir, "liver_gbc_model.pkl")
    lr_path = os.path.join(models_dir, "liver_lr_model.pkl")
    scaler_path = os.path.join(models_dir, "liver_scaler.pkl")

    with open(model_path, "wb") as f:
        pickle.dump(rf_model, f)
    with open(rf_path, "wb") as f:
        pickle.dump(rf_model, f)
    with open(gbc_path, "wb") as f:
        pickle.dump(gbc_model, f)
    with open(lr_path, "wb") as f:
        pickle.dump(lr_model, f)
    with open(scaler_path, "wb") as f:
        pickle.dump(scaler, f)

    print(f"✅ Saved models: {model_path}, {rf_path}, {gbc_path}, {lr_path}")
    print(f"✅ Saved scaler: {scaler_path}")
    return metrics

if __name__ == "__main__":
    train_liver()
