#!/usr/bin/env python3
"""
Master Training Runner for all MedSynapse Tabular Diagnostic Backbones
Trains Diabetes, Heart Disease, Breast Cancer, and Liver Disease models.
"""

import sys
import os
from pathlib import Path

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(BASE_DIR))

from scripts.train.train_diabetes import train_diabetes
from scripts.train.train_heart import train_heart
from scripts.train.train_breast_cancer import train_breast_cancer
from scripts.train.train_liver import train_liver

def main():
    print("=" * 70)
    print("🚀 MEDSYNAPSE MULTI-DISEASE MODEL RETRAINING PIPELINE")
    print("=" * 70)

    results = {}

    print("\n[1/4] Training Diabetes Mellitus Soft-Voting Ensemble...")
    try:
        results["Diabetes Mellitus"] = train_diabetes()
    except Exception as e:
        print(f"❌ Error training Diabetes model: {e}")

    print("\n[2/4] Training Coronary Heart Disease Random Forest...")
    try:
        results["Heart Disease"] = train_heart()
    except Exception as e:
        print(f"❌ Error training Heart model: {e}")

    print("\n[3/4] Training Breast Cancer (WDBC) PCA + Classifier...")
    try:
        results["Breast Cancer (WDBC)"] = train_breast_cancer()
    except Exception as e:
        print(f"❌ Error training Breast Cancer model: {e}")

    print("\n[4/4] Training Hepatic Liver Disease Model Suite...")
    try:
        results["Liver Disease (ILPD)"] = train_liver()
    except Exception as e:
        print(f"❌ Error training Liver model: {e}")

    print("\n" + "=" * 70)
    print("📊 MASTER BENCHMARK EVALUATION SUMMARY")
    print("=" * 70)
    print(f"{'Diagnostic Target':<25} | {'Accuracy':<10} | {'Precision':<10} | {'Recall':<10} | {'F1-Score':<10} | {'AUROC':<10}")
    print("-" * 85)

    for target, metrics in results.items():
        acc = f"{metrics.get('accuracy', 0)*100:.2f}%"
        prec = f"{metrics.get('precision', 0):.4f}"
        rec = f"{metrics.get('recall', 0):.4f}"
        f1 = f"{metrics.get('f1', 0):.4f}"
        auc = f"{metrics.get('roc_auc', 0):.4f}"
        print(f"{target:<25} | {acc:<10} | {prec:<10} | {rec:<10} | {f1:<10} | {auc:<10}")

    print("=" * 85)
    print("✅ All diagnostic models trained and saved to models/ directory.")

if __name__ == "__main__":
    main()
