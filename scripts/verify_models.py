import os
import sys
import numpy as np

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

try:
    from backend.services.model_service import ModelService
except ImportError:
    from services.model_service import ModelService

def main():
    print("=" * 60)
    print("🔬 Verifying MedSynapse AI Diagnostic Models")
    print("=" * 60)

    ms = ModelService.get_instance()

    # 1. Diabetes Model
    print("\n1. Verifying Diabetes Model...")
    try:
        res = ms.predict_diabetes({'glucose': 140, 'bmi': 30.5, 'age': 45, 'blood_pressure': 80})
        print(f"   ✅ Diabetes Model Verified! Prediction: {res['prediction']} (Risk: {res['risk_percentage']}%)")
    except Exception as e:
        print(f"   ❌ Error: {e}")

    # 2. Heart Model
    print("\n2. Verifying Heart Disease Model...")
    try:
        res = ms.predict_heart({'age': 55, 'sex': 1, 'cp': 2, 'trestbps': 135, 'chol': 240})
        print(f"   ✅ Heart Model Verified! Prediction: {res['prediction']} (Risk: {res['risk_percentage']}%)")
    except Exception as e:
        print(f"   ❌ Error: {e}")

    # 3. Chest X-Ray Model
    print("\n3. Verifying Chest X-Ray Pneumonia Model...")
    try:
        model = ms.get_xray_model()
        dummy_input = np.random.rand(1, 224, 224, 3).astype(np.float32)
        pred = model.predict(dummy_input, verbose=0)
        print(f"   ✅ Chest X-Ray Model Verified! Prediction shape: {pred.shape}")
    except Exception as e:
        print(f"   ❌ Error: {e}")

    print("\n" + "=" * 60)
    print("🎉 Verification Complete!")
    print("=" * 60)

if __name__ == "__main__":
    main()
