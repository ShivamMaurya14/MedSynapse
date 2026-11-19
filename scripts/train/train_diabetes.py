#!/usr/bin/env python3
"""
Automated Training Pipeline: Diabetes Mellitus Diagnostic Model
Architecture: Soft-Voting Ensemble (Random Forest + Gradient Boosting + Extra Trees + Logistic Regression)
Dataset: PIMA Indians Diabetes Database
"""

import os
import urllib.request
import pickle
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, ExtraTreesClassifier, VotingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score

DATA_URL = "https://raw.githubusercontent.com/jbrownlee/Datasets/master/pima-indians-diabetes.data.csv"
COLUMNS = ["Pregnancies", "Glucose", "BloodPressure", "SkinThickness", "Insulin", "BMI", "DiabetesPedigreeFunction", "Age", "Outcome"]

def load_or_download_data(data_dir: str = "data/raw") -> pd.DataFrame:
    os.makedirs(data_dir, exist_ok=True)
    csv_path = os.path.join(data_dir, "diabetes.csv")
    if not os.path.exists(csv_path):
        print(f"📥 Downloading PIMA Diabetes dataset from {DATA_URL}...")
        urllib.request.urlretrieve(DATA_URL, csv_path)
    df = pd.read_csv(csv_path, names=COLUMNS)
    return df

def train_diabetes(models_dir: str = "models") -> dict:
    os.makedirs(models_dir, exist_ok=True)
    df = load_or_download_data()
    print(f"Loaded dataset shape: {df.shape}")

    # Impute zeros with medians for physiological features where 0 is non-viable
    zero_cols = ["Glucose", "BloodPressure", "SkinThickness", "Insulin", "BMI"]
    for col in zero_cols:
        median_val = df[df[col] != 0][col].median()
        df[col] = df[col].replace(0, median_val)

    # Feature Engineering: Categorical BMI
    def categorize_bmi(bmi):
        if bmi < 18.5: return 0
        elif 18.5 <= bmi < 25: return 1
        elif 25 <= bmi < 30: return 2
        else: return 3

    df["BMI_Cat"] = df["BMI"].apply(categorize_bmi)

    feature_cols = ["Pregnancies", "Glucose", "BloodPressure", "SkinThickness", "Insulin", "BMI", "DiabetesPedigreeFunction", "Age", "BMI_Cat"]
    X = df[feature_cols].values
    y = df["Outcome"].values

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Base Classifiers
    rf = RandomForestClassifier(n_estimators=150, max_depth=6, random_state=42)
    gb = GradientBoostingClassifier(n_estimators=100, learning_rate=0.05, max_depth=4, random_state=42)
    et = ExtraTreesClassifier(n_estimators=100, max_depth=6, random_state=42)
    lr = LogisticRegression(max_iter=1000, C=0.5, random_state=42)

    voting_clf = VotingClassifier(
        estimators=[("rf", rf), ("gb", gb), ("et", et), ("lr", lr)],
        voting="soft"
    )

    voting_clf.fit(X_train_scaled, y_train)

    y_pred = voting_clf.predict(X_test_scaled)
    y_prob = voting_clf.predict_proba(X_test_scaled)[:, 1]

    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred)),
        "recall": float(recall_score(y_test, y_pred)),
        "f1": float(f1_score(y_test, y_pred)),
        "roc_auc": float(roc_auc_score(y_test, y_prob))
    }

    print("\n--- Diabetes Model Test Performance ---")
    for k, v in metrics.items():
        print(f"  {k}: {v:.4f}")

    model_path = os.path.join(models_dir, "diabetes_model.pkl")
    scaler_path = os.path.join(models_dir, "diabetes_scaler.pkl")

    with open(model_path, "wb") as f:
        pickle.dump(voting_clf, f)
    with open(scaler_path, "wb") as f:
        pickle.dump(scaler, f)

    print(f"✅ Saved model: {model_path}")
    print(f"✅ Saved scaler: {scaler_path}")
    return metrics

if __name__ == "__main__":
    train_diabetes()
