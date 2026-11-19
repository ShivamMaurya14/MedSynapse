#!/usr/bin/env python3
"""
Automated Training Pipeline: Breast Cancer Diagnostic Model (WDBC)
Architecture: StandardScaler + PCA (n_components=6) + Logistic Regression / Soft-Voting Ensemble
Dataset: Wisconsin Diagnostic Breast Cancer (WDBC)
"""

import os
import pickle
import numpy as np
import pandas as pd
from sklearn.datasets import load_breast_cancer
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, VotingClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score

# Canonical ordering matching backend/services/breast_feature_contract.py
BASE_MEASUREMENTS = (
    "radius", "texture", "perimeter", "area", "smoothness", "compactness",
    "concavity", "concave_points", "symmetry", "fractal_dimension",
)
BREAST_FEATURE_ORDER = tuple(f"{name}_{metric}" for metric in ("mean", "se", "worst") for name in BASE_MEASUREMENTS)

def train_breast_cancer(models_dir: str = "models") -> dict:
    os.makedirs(models_dir, exist_ok=True)
    raw_data = load_breast_cancer(as_frame=True)
    df = raw_data.frame

    # Rename columns to match contract (replace spaces with underscores, concave points -> concave_points)
    col_mapping = {}
    for orig in df.columns:
        norm = orig.replace(" ", "_").replace("concave_points", "concave_points")
        # Handle scikit-learn standard names vs contract names
        # e.g., 'mean radius' -> 'radius_mean'
        parts = orig.split()
        if len(parts) >= 2:
            metric = parts[0] # 'mean', 'worst', 'standard error' -> 'se'
            if metric == 'mean':
                suffix = 'mean'
                base = '_'.join(parts[1:])
            elif metric == 'worst':
                suffix = 'worst'
                base = '_'.join(parts[1:])
            elif 'error' in orig:
                suffix = 'se'
                base = orig.replace(' error', '').replace(' ', '_')
            else:
                base = '_'.join(parts[:-1])
                suffix = parts[-1]
            base = base.replace('concave_points', 'concave_points').replace('concavity', 'concavity')
            # Scikit-learn has 'mean concave points' -> 'concave_points_mean'
            if 'concave points' in orig:
                col_mapping[orig] = f"concave_points_{suffix}"
            else:
                col_mapping[orig] = f"{base}_{suffix}"
    
    # Alternatively build feature matrix directly from raw_data.data matching contract
    # Map scikit-learn feature_names:
    sk_to_contract = {
        'mean radius': 'radius_mean', 'mean texture': 'texture_mean', 'mean perimeter': 'perimeter_mean',
        'mean area': 'area_mean', 'mean smoothness': 'smoothness_mean', 'mean compactness': 'compactness_mean',
        'mean concavity': 'concavity_mean', 'mean concave points': 'concave_points_mean', 'mean symmetry': 'symmetry_mean',
        'mean fractal dimension': 'fractal_dimension_mean',
        'radius error': 'radius_se', 'texture error': 'texture_se', 'perimeter error': 'perimeter_se',
        'area error': 'area_se', 'smoothness error': 'smoothness_se', 'compactness error': 'compactness_se',
        'concavity error': 'concavity_se', 'concave points error': 'concave_points_se', 'symmetry error': 'symmetry_se',
        'fractal dimension error': 'fractal_dimension_se',
        'worst radius': 'radius_worst', 'worst texture': 'texture_worst', 'worst perimeter': 'perimeter_worst',
        'worst area': 'area_worst', 'worst smoothness': 'smoothness_worst', 'worst compactness': 'compactness_worst',
        'worst concavity': 'concavity_worst', 'worst concave points': 'concave_points_worst', 'worst symmetry': 'symmetry_worst',
        'worst fractal dimension': 'fractal_dimension_worst'
    }

    df_features = raw_data.data.rename(columns=sk_to_contract)
    X = df_features[list(BREAST_FEATURE_ORDER)].values
    # In sklearn: 0 = malignant, 1 = benign. We want 1 = malignant, 0 = benign (standard oncology risk direction)
    # Target 1 = malignant, 0 = benign
    y = (raw_data.target == 0).astype(int)

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    pca = PCA(n_components=6, random_state=42)
    X_train_pca = pca.fit_transform(X_train_scaled)
    X_test_pca = pca.transform(X_test_scaled)

    # Train tuned logistic regression
    lr = LogisticRegression(C=1.0, max_iter=1000, random_state=42)
    lr.fit(X_train_pca, y_train)

    # Also train ensemble
    rf = RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42)
    gb = GradientBoostingClassifier(n_estimators=100, learning_rate=0.05, max_depth=3, random_state=42)
    ensemble = VotingClassifier(
        estimators=[("lr", lr), ("rf", rf), ("gb", gb)],
        voting="soft"
    )
    ensemble.fit(X_train_pca, y_train)

    y_pred = lr.predict(X_test_pca)
    y_prob = lr.predict_proba(X_test_pca)[:, 1]

    metrics = {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred)),
        "recall": float(recall_score(y_test, y_pred)),
        "f1": float(f1_score(y_test, y_pred)),
        "roc_auc": float(roc_auc_score(y_test, y_prob))
    }

    print("\n--- Breast Cancer Model Test Performance ---")
    for k, v in metrics.items():
        print(f"  {k}: {v:.4f}")

    model_path = os.path.join(models_dir, "breast_cancer_model.pkl")
    scaler_path = os.path.join(models_dir, "breast_cancer_scaler.pkl")
    pca_path = os.path.join(models_dir, "breast_cancer_pca.pkl")
    ensemble_path = os.path.join(models_dir, "breast_cancer_ensemble.pkl")

    with open(model_path, "wb") as f:
        pickle.dump(lr, f)
    with open(scaler_path, "wb") as f:
        pickle.dump(scaler, f)
    with open(pca_path, "wb") as f:
        pickle.dump(pca, f)
    with open(ensemble_path, "wb") as f:
        pickle.dump(ensemble, f)

    print(f"✅ Saved model: {model_path}")
    print(f"✅ Saved scaler: {scaler_path}")
    print(f"✅ Saved PCA: {pca_path}")
    print(f"✅ Saved ensemble: {ensemble_path}")
    return metrics

if __name__ == "__main__":
    train_breast_cancer()
