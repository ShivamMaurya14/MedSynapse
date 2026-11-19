import os
import tempfile
import unittest
from pathlib import Path


class ClinicianReviewWorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.old_database_path = os.environ.get("MEDSYNAPSE_DATABASE_PATH")
        os.environ["MEDSYNAPSE_DATABASE_PATH"] = str(
            Path(self.temporary_directory.name) / "review.sqlite3"
        )
        from backend.database import initialize_database

        initialize_database()

    def tearDown(self):
        if self.old_database_path is None:
            os.environ.pop("MEDSYNAPSE_DATABASE_PATH", None)
        else:
            os.environ["MEDSYNAPSE_DATABASE_PATH"] = self.old_database_path
        self.temporary_directory.cleanup()

    @staticmethod
    def _report():
        return {
            "clinical_inputs": [{"name": "radius_mean", "value": 14.2}],
            "explainability": {
                "status": "available",
                "all_contributions": [
                    {"feature": "radius_mean", "patient_value": 14.2, "shap_value": 0.11},
                    {"feature": "concavity_worst", "patient_value": 0.2, "shap_value": -0.07},
                ],
                "top_positive_contributors": [
                    {"feature": "radius_mean", "patient_value": 14.2, "shap_value": 0.11},
                ],
                "top_negative_contributors": [
                    {"feature": "concavity_worst", "patient_value": 0.2, "shap_value": -0.07},
                ],
            },
            "safety": {"screening_only": True},
        }

    def _run_id(self):
        from backend.database import save_model_run

        return save_model_run(
            disease_type="breast",
            prediction={"risk_probability": 0.42, "diagnosis": "Benign"},
            clinical_report=self._report(),
        )["model_run_id"]

    def test_approval_requires_verified_shap_and_llm_package_filters_to_it(self):
        from backend.database import build_approved_report_package, review_model_run

        run_id = self._run_id()
        with self.assertRaisesRegex(ValueError, "selecting at least one verified SHAP"):
            review_model_run(run_id, decision="approved", reviewed_by="Clinician-01")

        review_model_run(
            run_id,
            decision="approved",
            reviewed_by="Clinician-01",
            verified_features=["concavity_worst"],
        )
        package = build_approved_report_package(run_id)
        self.assertEqual(
            [item["feature"] for item in package["explainability"]["all_contributions"]],
            ["concavity_worst"],
        )
        self.assertEqual(
            package["explainability"]["clinician_verified_feature_names"],
            ["concavity_worst"],
        )

    def test_rejection_requires_reason_and_unknown_shap_features_are_rejected(self):
        from backend.database import review_model_run

        with self.assertRaisesRegex(ValueError, "rejection requires a review comment"):
            review_model_run(
                self._run_id(), decision="rejected", reviewed_by="Clinician-01"
            )

        with self.assertRaisesRegex(ValueError, "not part of this model run"):
            review_model_run(
                self._run_id(),
                decision="approved",
                reviewed_by="Clinician-01",
                verified_features=["invented_feature"],
            )


if __name__ == "__main__":
    unittest.main()
