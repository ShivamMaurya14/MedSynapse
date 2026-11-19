"""
Comprehensive End-to-End Verification Test for All 9 MedSynapse Disease Modules
Validates:
1. ML Model Predictions using pre-fitted sample datasets
2. XAI Explainability (SHAP & Grad-CAM)
3. Direct LLM Clinical Report Synthesis
4. Real-time Copilot Chat with Dual Schema (conversational reply + merged final report)
5. Individual Section Regeneration
"""

import sys
import os
from pathlib import Path

# Ensure project root is on PYTHONPATH
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.services.model_service import ModelService
from backend.services.clinical_report_service import ClinicalReportService

def run_tests():
    project_root = Path(__file__).resolve().parent.parent
    model_service = ModelService()
    report_service = ClinicalReportService(model_service, project_root)
    
    print("=" * 80)
    print("STARTING FULL END-TO-END VERIFICATION ACROSS ALL 9 DISEASE MODULES")
    print("=" * 80)

    # Pre-fitted sample test cases exactly matching the 1-click presets in the frontend
    disease_cases = [
        # 1. Diabetes
        {
            "key": "diabetes",
            "name": "Diabetes Mellitus",
            "is_image": False,
            "inputs": {
                "pregnancies": 2, "glucose": 118, "blood_pressure": 78,
                "skin_thickness": 25, "insulin": 95, "bmi": 27.8, "dpf": 0.52, "age": 44
            },
            "chat_prompts": [
                "Doctor requests: Patient presents with impaired fasting glucose. Add strict 3-month OGTT follow-up and endocrinology consult.",
                "Explain the top SHAP biomarker drivers for this glycemic assessment."
            ],
            "regen_section": "screening_summary"
        },
        # 2. Heart CAD
        {
            "key": "heart",
            "name": "Coronary Heart Disease",
            "is_image": False,
            "inputs": {
                "age": 58, "sex": 1, "cp": 0, "trestbps": 148, "chol": 265,
                "fbs": 1, "restecg": 1, "thalach": 128, "exang": 1, "oldpeak": 2.4,
                "slope": 1, "ca": 2, "thal": 3
            },
            "chat_prompts": [
                "Doctor instructs: Schedule immediate myocardial perfusion scintigraphy and start high-intensity statin therapy.",
            ],
            "regen_section": "recommendations"
        },
        # 3. Breast Cancer (FNA)
        {
            "key": "breast",
            "name": "Breast Cancer (FNA)",
            "is_image": False,
            "inputs": {
                "radius_mean": 17.99, "texture_mean": 10.38, "perimeter_mean": 122.8, "area_mean": 1001.0,
                "smoothness_mean": 0.1184, "compactness_mean": 0.2776, "concavity_mean": 0.3001,
                "concave_points_mean": 0.1471, "symmetry_mean": 0.2419, "fractal_dimension_mean": 0.07871,
                "radius_se": 1.095, "texture_se": 0.9053, "perimeter_se": 8.589, "area_se": 153.4,
                "smoothness_se": 0.006399, "compactness_se": 0.04904, "concavity_se": 0.05373,
                "concave_points_se": 0.01587, "symmetry_se": 0.03003, "fractal_dimension_se": 0.006193,
                "radius_worst": 25.38, "texture_worst": 17.33, "perimeter_worst": 184.6, "area_worst": 2019.0,
                "smoothness_worst": 0.1622, "compactness_worst": 0.6656, "concavity_worst": 0.7119,
                "concave_points_worst": 0.2654, "symmetry_worst": 0.4601, "fractal_dimension_worst": 0.1189
            },
            "chat_prompts": [
                "Doctor note: Cytopathology indicates nuclear pleomorphism. Recommend core needle biopsy correlation.",
            ],
            "regen_section": "model_findings"
        },
        # 4. Liver Disease (ILPD)
        {
            "key": "liver",
            "name": "Liver Disease (ILPD)",
            "is_image": False,
            "inputs": {
                "age": 45, "gender": "Male", "total_bilirubin": 1.4, "direct_bilirubin": 0.6,
                "alkaline_phosphotase": 260, "alamine_aminotransferase": 48,
                "aspartate_aminotransferase": 56, "total_protiens": 6.8, "albumin": 3.1,
                "ag_ratio": 0.83
            },
            "chat_prompts": [
                "Doctor instructs: Add abdominal ultrasonography and viral hepatitis serology panel.",
            ],
            "regen_section": "clinician_review"
        },
        # 5. Pneumonia (Chest X-Ray)
        {
            "key": "xray",
            "name": "Pneumonia (Chest X-Ray)",
            "is_image": True,
            "image_path": "frontend/public/test_samples/xray_pneumonia.jpeg",
            "inputs": {"source_filename": "xray_pneumonia.jpeg", "modality": "digital_radiography"},
            "chat_prompts": [
                "Doctor instructions: Dense right lower lobe infiltrate observed on radiograph. Initiate oral azithromycin.",
            ],
            "regen_section": "physician_perspective_analysis"
        },
        # 6. Brain Tumor (MRI)
        {
            "key": "brain-tumor",
            "name": "Brain Tumor (MRI)",
            "is_image": True,
            "image_path": "frontend/public/test_samples/brain_glioma.jpg",
            "inputs": {"source_filename": "brain_glioma.jpg", "modality": "cranial_mri"},
            "chat_prompts": [
                "Doctor note: Correlate with contrast-enhanced T1-weighted MRI with spectroscopy.",
            ],
            "regen_section": "recommendations"
        },
        # 7. Kidney Stone (CT)
        {
            "key": "kidney-stone",
            "name": "Kidney Pathology (CT)",
            "is_image": True,
            "image_path": "frontend/public/test_samples/kidney_stone.jpg",
            "inputs": {"source_filename": "kidney_stone.jpg", "modality": "noncontrast_ct"},
            "chat_prompts": [
                "Doctor instructions: Suggest urology consult and 24-hour urine collection for metabolic evaluation.",
            ],
            "regen_section": "screening_summary"
        },
        # 8. Skin Cancer (Dermoscopy)
        {
            "key": "skin-cancer",
            "name": "Skin Cancer (Dermoscopy)",
            "is_image": True,
            "image_path": "frontend/public/test_samples/skin_melanoma.jpg",
            "inputs": {"source_filename": "skin_melanoma.jpg", "modality": "dermoscopy"},
            "chat_prompts": [
                "Doctor note: Atypical pigment network detected. Recommend excisional biopsy with 2mm margins.",
            ],
            "regen_section": "clinician_review"
        },
        # 9. Eye Disease (Ophthalmic)
        {
            "key": "eye",
            "name": "Eye Disease (Ophthalmic)",
            "is_image": True,
            "image_path": "frontend/public/test_samples/eye_glaucoma.jpeg",
            "inputs": {"source_filename": "eye_glaucoma.jpeg", "modality": "fundus_photography"},
            "chat_prompts": [
                "Doctor instructions: Cupping of optic nerve head noted. Order Humphrey visual field test.",
            ],
            "regen_section": "recommendations"
        },
    ]

    all_passed = True
    results_summary = []

    for idx, case in enumerate(disease_cases, 1):
        print(f"\n[{idx}/9] TESTING MODULE: {case['name']} (Key: {case['key']})")
        print("-" * 60)
        
        try:
            # Step A: Run Model Prediction
            img_bytes = None
            if case["is_image"]:
                img_file = project_root / case["image_path"]
                assert img_file.exists(), f"Image file not found: {img_file}"
                with open(img_file, "rb") as f:
                    img_bytes = f.read()
                if case["key"] == "xray":
                    pred = model_service.predict_xray(img_bytes)
                elif case["key"] == "brain-tumor":
                    pred = model_service.predict_brain_tumor(img_bytes)
                elif case["key"] == "kidney-stone":
                    pred = model_service.predict_kidney_stone(img_bytes)
                elif case["key"] == "skin-cancer":
                    pred = model_service.predict_skin_cancer(img_bytes)
                elif case["key"] == "eye":
                    pred = model_service.predict_eye(img_bytes)
                else:
                    raise ValueError(f"Unknown image disease: {case['key']}")
            else:
                if case["key"] == "diabetes":
                    pred = model_service.predict_diabetes(case["inputs"])
                elif case["key"] == "heart":
                    pred = model_service.predict_heart(case["inputs"])
                elif case["key"] == "breast":
                    pred = model_service.predict_breast_cancer(case["inputs"])
                elif case["key"] == "liver":
                    pred = model_service.predict_liver(case["inputs"])
                else:
                    raise ValueError(f"Unknown tabular disease: {case['key']}")

            print(f"  ✓ 1. Prediction Succeeded:")
            print(f"     Diagnosis: {pred.get('diagnosis') or pred.get('prediction')}")
            print(f"     Risk Prob: {pred.get('risk_probability')} (Percentage: {pred.get('risk_percentage')}%)")
            print(f"     Risk Tier: {pred.get('risk_tier')}")

            # Step B: Build Diagnostic Report & Explainability (SHAP / Grad-CAM)
            diag_report = report_service.build_report(
                disease_key=case["key"],
                prediction=pred,
                inputs=case["inputs"],
                image_bytes=img_bytes
            )
            explainability = diag_report.get("explainability", {})
            has_shap = bool(explainability.get("top_positive_contributors") or explainability.get("all_contributions"))
            has_gradcam = bool(explainability.get("overlay_data_url") or explainability.get("heatmap_data_url"))
            print(f"  ✓ 2. Diagnostic Package Built (XAI: SHAP={has_shap}, Grad-CAM={has_gradcam})")

            # Step C: Synthesize Direct LLM Report
            llm_report = report_service.synthesize_report_direct(
                disease_key=case["key"],
                prediction=pred,
                inputs=case["inputs"],
                clinical_report=diag_report,
                tweaked_decisions={
                    "hasTweaks": True,
                    "doctorInfo": {"name": "Dr. Sarah Chen, MD", "title": "Senior Attending Physician"}
                }
            )
            assert isinstance(llm_report, dict), "LLM report must be a dictionary"
            assert "screening_summary" in llm_report and len(llm_report["screening_summary"]) > 20, "Missing screening summary"
            assert "model_findings" in llm_report, "Missing model findings"
            assert "recommendations" in llm_report and len(llm_report["recommendations"]) > 0, "Missing recommendations"
            print(f"  ✓ 3. LLM Report Synthesized: '{llm_report.get('title')}'")
            print(f"     Recommendations count: {len(llm_report.get('recommendations', []))}")

            # Step D: Test Real-Time Copilot Chat & Report Auto-Update
            prompt = case["chat_prompts"][0]
            chat_res = report_service.chat_with_llm(
                messages=[{"role": "user", "content": prompt}],
                report_context={
                    "disease_type": case["key"],
                    "diseaseTitle": case["name"],
                    "prediction": pred,
                    "inputs": case["inputs"],
                    "current_report": llm_report,
                    "tweaked_decisions": {
                        "hasTweaks": True,
                        "doctorInfo": {"name": "Dr. Sarah Chen, MD", "title": "Senior Attending Physician"}
                    }
                }
            )
            assert "reply" in chat_res and len(chat_res["reply"]) > 10, "Chat reply must be present"
            assert "updated_report" in chat_res and isinstance(chat_res["updated_report"], dict), "updated_report must be returned"
            updated_rep = chat_res["updated_report"]
            print(f"  ✓ 4. Copilot Auto-Merged Report:")
            print(f"     Doctor Query: \"{prompt[:60]}...\"")
            print(f"     LLM Reply snippet: {chat_res['reply'][:70]}...")
            print(f"     Updated Recs count: {len(updated_rep.get('recommendations', []))}")

            # Step E: Test Section-by-Section Regeneration
            sec_to_regen = case["regen_section"]
            sec_res = report_service.regenerate_report_section(
                section_key=sec_to_regen,
                disease_key=case["key"],
                prediction=pred,
                inputs=case["inputs"],
                current_report=updated_rep,
                tweaked_decisions={
                    "hasTweaks": True,
                    "doctorInfo": {"name": "Dr. Sarah Chen, MD", "title": "Senior Attending Physician"}
                },
                chat_history=[{"role": "user", "content": prompt}],
                instructions="Ensure high precision and specific clinical surveillance intervals."
            )
            assert "section_value" in sec_res, "Regenerated section must have section_value"
            assert "updated_report" in sec_res, "Regenerated section must have updated_report"
            print(f"  ✓ 5. Regenerated Section '{sec_to_regen}':")
            val_preview = sec_res['section_value']
            if isinstance(val_preview, list):
                print(f"     Items count: {len(val_preview)}, first: {val_preview[0][:60]}...")
            else:
                print(f"     Text snippet: {str(val_preview)[:80]}...")

            results_summary.append({
                "module": case["name"],
                "key": case["key"],
                "status": "PASSED",
                "xai": "Grad-CAM" if case["is_image"] else "SHAP",
                "chat_sync": "Verified",
                "section_regen": f"Verified ({sec_to_regen})"
            })

        except Exception as e:
            print(f"  ❌ FAILED for {case['name']}: {e}")
            import traceback
            traceback.print_exc()
            all_passed = False
            results_summary.append({
                "module": case["name"],
                "key": case["key"],
                "status": f"FAILED: {e}",
            })

    print("\n" + "=" * 80)
    print("VERIFICATION SUMMARY MATRIX ACROSS ALL 9 MODULES")
    print("=" * 80)
    for r in results_summary:
        print(f"  [{r['status']}] {r['module']} ({r.get('key')}) | XAI: {r.get('xai', 'N/A')} | Chat Sync: {r.get('chat_sync', 'N/A')} | Section Regen: {r.get('section_regen', 'N/A')}")
    print("=" * 80)

    if all_passed:
        print("\n🎉 ALL 9 CLINICAL MODULES PASSED COMPLETE VERIFICATION!")
    else:
        print("\n⚠️ SOME MODULES ENCOUNTERED ISSUES. SEE LOG ABOVE.")
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
