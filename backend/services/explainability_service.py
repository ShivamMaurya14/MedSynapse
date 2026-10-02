"""Model explanation helpers for the clinical-report layer.

Explanations are computed from the exact transformed inputs used for inference.
They describe model behaviour, never clinical causality or a confirmed diagnosis.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from uuid import uuid4

import numpy as np


class ExplainabilityService:
    """Generate structured SHAP/Grad-CAM evidence without inventing values."""

    @staticmethod
    def _missing_shap(reason: str, method: str = "SHAP") -> dict:
        return {"status": "unavailable", "method": method, "reason": reason,
                "limitations": ["No feature attribution was generated."]}

    @staticmethod
    def _contribution_report(*, values, base_value, feature_names, raw_values, method, output_space) -> dict:
        contributions = []
        for name, value in zip(feature_names, np.asarray(values).reshape(-1)):
            numeric_value = float(value)
            contributions.append({
                "feature": name,
                "patient_value": raw_values.get(name),
                "shap_value": round(numeric_value, 6),
                "effect": "increased predicted positive-class score" if numeric_value >= 0 else "reduced predicted positive-class score",
            })
        ranked = sorted(contributions, key=lambda item: abs(item["shap_value"]), reverse=True)
        return {
            "status": "available", "method": method, "base_value": round(float(base_value), 6),
            "output_space": output_space,
            "top_positive_contributors": [item for item in ranked if item["shap_value"] > 0][:5],
            "top_negative_contributors": [item for item in ranked if item["shap_value"] < 0][:5],
            "all_contributions": ranked,
            "limitations": ["SHAP attributes model behaviour for this input; it does not prove causality."],
        }

    @staticmethod
    def _attach_reference_metadata(report: dict, background_path: Path) -> dict:
        test_marker = background_path.with_suffix(".test-only.json")
        if not test_marker.exists():
            return report
        try:
            marker = json.loads(test_marker.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            marker = {"test_only": True, "warning": "Synthetic SHAP background marker is unreadable."}
        report["reference_background"] = marker
        report["limitations"].append(
            "The reference background is synthetic and suitable only for software pipeline testing."
        )
        return report

    @staticmethod
    def _exact_interventional_shap(*, predict_proba, model_input: np.ndarray,
                                   background: np.ndarray, feature_names: list[str],
                                   raw_values: dict, method_label: str) -> dict:
        """Compute exact model-agnostic Shapley values for a small feature set.

        This fallback is practical for the nine-feature diabetes model. It is
        intentionally refused for wider models because its cost grows as 2^M.
        """
        feature_count = model_input.shape[1]
        if feature_count > 12:
            return ExplainabilityService._missing_shap(
                "Install the optional 'shap' package; the exact fallback is limited to 12 features.",
                method_label,
            )

        mask_count = 1 << feature_count
        evaluation_batches = []
        for mask in range(mask_count):
            candidates = np.array(background, dtype=float, copy=True)
            for index in range(feature_count):
                if mask & (1 << index):
                    candidates[:, index] = model_input[0, index]
            evaluation_batches.append(candidates)

        probabilities = np.asarray(predict_proba(np.vstack(evaluation_batches)))
        if probabilities.ndim != 2 or probabilities.shape[1] < 1:
            raise ValueError("predict_proba returned an incompatible shape")
        positive_index = 1 if probabilities.shape[1] > 1 else 0
        coalition_values = probabilities[:, positive_index].reshape(
            mask_count, len(background)
        ).mean(axis=1)

        contributions = np.zeros(feature_count, dtype=float)
        denominator = math.factorial(feature_count)
        for index in range(feature_count):
            bit = 1 << index
            for mask in range(mask_count):
                if mask & bit:
                    continue
                subset_size = mask.bit_count()
                weight = (
                    math.factorial(subset_size)
                    * math.factorial(feature_count - subset_size - 1)
                    / denominator
                )
                contributions[index] += weight * (
                    coalition_values[mask | bit] - coalition_values[mask]
                )

        report = ExplainabilityService._contribution_report(
            values=contributions,
            base_value=coalition_values[0],
            feature_names=feature_names,
            raw_values=raw_values,
            method=f"Exact interventional SHAP fallback ({method_label})",
            output_space="positive-class probability",
        )
        reconstructed = float(coalition_values[0] + contributions.sum())
        report["additivity_check"] = {
            "reconstructed_probability": round(reconstructed, 6),
            "model_probability": round(float(coalition_values[-1]), 6),
            "absolute_error": round(abs(reconstructed - float(coalition_values[-1])), 12),
        }
        return report

    @staticmethod
    def _monte_carlo_interventional_shap(*, predict_proba, model_input: np.ndarray,
                                         background: np.ndarray, feature_names: list[str],
                                         raw_values: dict, method_label: str,
                                         sample_count: int = 256) -> dict:
        """Estimate interventional Shapley values for wider tabular models.

        The exact enumeration used for the small diabetes contract grows as
        ``2**feature_count`` and is not practical for WDBC's 30 features.
        This samples background rows and random feature orderings instead.  A
        contribution remains the model-score change when one feature is added
        to a coalition; averaging those marginal changes is a standard
        Monte-Carlo Shapley estimator.  It is deterministic for a fixed input
        and reference cohort so that a clinician can reproduce an audit.
        """
        feature_count = model_input.shape[1]
        if feature_count == 0:
            raise ValueError("Model input has no explainable features.")
        if len(background) < 2:
            raise ValueError("Reference background must contain at least two rows.")

        seed = 20261009 + feature_count + len(background)
        generator = np.random.default_rng(seed)
        sample_count = max(32, int(sample_count))
        background_indices = generator.integers(0, len(background), size=sample_count)
        permutations = np.array([generator.permutation(feature_count) for _ in range(sample_count)])

        # Each sampled ordering produces a baseline and one row after every
        # additional feature. Predict the whole batch once for both speed and
        # a single, auditable model invocation path.
        trajectories = np.empty((sample_count, feature_count + 1, feature_count), dtype=float)
        trajectories[:, 0, :] = background[background_indices]
        for sample_index, ordering in enumerate(permutations):
            current = trajectories[sample_index, 0, :].copy()
            for step, feature_index in enumerate(ordering, start=1):
                current = current.copy()
                current[feature_index] = model_input[0, feature_index]
                trajectories[sample_index, step, :] = current

        probabilities = np.asarray(predict_proba(trajectories.reshape(-1, feature_count)))
        if probabilities.ndim != 2 or probabilities.shape[1] < 1:
            raise ValueError("predict_proba returned an incompatible shape")
        positive_index = 1 if probabilities.shape[1] > 1 else 0
        scores = probabilities[:, positive_index].reshape(sample_count, feature_count + 1)
        marginal_changes = np.diff(scores, axis=1)
        contributions = np.zeros(feature_count, dtype=float)
        for sample_index, ordering in enumerate(permutations):
            contributions[ordering] += marginal_changes[sample_index]
        contributions /= sample_count

        report = ExplainabilityService._contribution_report(
            values=contributions,
            base_value=scores[:, 0].mean(),
            feature_names=feature_names,
            raw_values=raw_values,
            method=f"Monte-Carlo interventional Shapley approximation ({method_label})",
            output_space="positive-class probability",
        )
        target_probability = float(predict_proba(model_input)[0, positive_index])
        reconstructed = float(scores[:, 0].mean() + contributions.sum())
        report["estimation"] = {
            "sample_count": sample_count,
            "background_rows": len(background),
            "random_seed": seed,
            "method": "random feature orderings over reference rows",
        }
        report["additivity_check"] = {
            "reconstructed_probability": round(reconstructed, 6),
            "model_probability": round(target_probability, 6),
            "absolute_error": round(abs(reconstructed - target_probability), 12),
        }
        report["limitations"].append(
            "Attributions are a deterministic Monte-Carlo Shapley approximation; small residual additivity error is expected."
        )
        return report

    @staticmethod
    def tree_shap(*, model, transformed_input: np.ndarray, feature_names: list[str], raw_values: dict, positive_class_idx: int = 1) -> dict:
        """Explain a tree-only classifier using the exact scaled inference values."""
        try:
            import shap
        except ImportError:
            return ExplainabilityService._missing_shap("Install the optional 'shap' package to compute tabular explanations.", "SHAP TreeExplainer")

        try:
            explainer = shap.TreeExplainer(model)
            shap_values = explainer.shap_values(transformed_input)
            expected_value = explainer.expected_value
            # SHAP versions/models differ: list[class], (rows, features), or
            # (rows, features, classes). Normalize to positive-class values.
            target_idx = positive_class_idx
            if isinstance(shap_values, list):
                idx = target_idx if len(shap_values) > target_idx else (1 if len(shap_values) > 1 else 0)
                values = np.asarray(shap_values[idx])[0]
                base_value = np.asarray(expected_value).reshape(-1)
                base_value = float(base_value[idx] if base_value.size > idx else base_value[0])
            else:
                values_array = np.asarray(shap_values)
                if values_array.ndim == 3:
                    idx = target_idx if values_array.shape[2] > target_idx else (1 if values_array.shape[2] > 1 else 0)
                    values = values_array[0, :, idx]
                else:
                    values = values_array[0]
                base_array = np.asarray(expected_value).reshape(-1)
                idx = target_idx if base_array.size > target_idx else (1 if base_array.size > 1 else 0)
                base_value = float(base_array[idx])

            return ExplainabilityService._contribution_report(
                values=values, base_value=base_value, feature_names=feature_names, raw_values=raw_values,
                method="SHAP TreeExplainer", output_space="tree-model output; check calibration before interpreting as probability",
            )
        except Exception as exc:
            return ExplainabilityService._missing_shap(f"SHAP computation failed: {exc}", "SHAP TreeExplainer")

    @staticmethod
    def permutation_shap(*, predict_proba, model_input: np.ndarray, background_path: Path,
                         feature_names: list[str], raw_values: dict, method_label: str) -> dict:
        """Explain a complete non-tree pipeline with a persisted reference cohort.

        ``background_path`` must hold de-identified training examples in the
        same representation accepted by ``predict_proba``. It is never
        synthesized from the current patient record.
        """
        if not background_path.exists():
            return ExplainabilityService._missing_shap(
                f"Reference background data is missing: {background_path.name}. Export it during model training.",
                method_label,
            )
        try:
            background = np.load(background_path, allow_pickle=False)
            if background.ndim != 2 or background.shape[1] != model_input.shape[1] or len(background) < 2:
                raise ValueError("Reference background has an incompatible shape.")
        except Exception as exc:
            return ExplainabilityService._missing_shap(
                f"SHAP reference background could not be loaded: {exc}", method_label
            )
        try:
            import shap
        except ImportError:
            try:
                if model_input.shape[1] <= 12:
                    report = ExplainabilityService._exact_interventional_shap(
                        predict_proba=predict_proba,
                        model_input=model_input,
                        background=background,
                        feature_names=feature_names,
                        raw_values=raw_values,
                        method_label=method_label,
                    )
                else:
                    report = ExplainabilityService._monte_carlo_interventional_shap(
                        predict_proba=predict_proba,
                        model_input=model_input,
                        background=background,
                        feature_names=feature_names,
                        raw_values=raw_values,
                        method_label=method_label,
                    )
                return ExplainabilityService._attach_reference_metadata(report, background_path)
            except Exception as exc:
                return ExplainabilityService._missing_shap(
                    f"Exact SHAP fallback failed: {exc}", method_label
                )
        try:
            explainer = shap.Explainer(predict_proba, background, algorithm="permutation")
            result = explainer(model_input, max_evals=max(2 * model_input.shape[1] + 1, 33))
            values = np.asarray(result.values)
            base_values = np.asarray(result.base_values)
            # Explanations of predict_proba have an output-class axis.
            if values.ndim == 3:
                positive_values = values[0, :, 1 if values.shape[2] > 1 else 0]
            else:
                positive_values = values[0]
            if base_values.ndim >= 2:
                base_value = base_values[0, 1 if base_values.shape[-1] > 1 else 0]
            else:
                base_value = base_values.reshape(-1)[0]
            report = ExplainabilityService._contribution_report(
                values=positive_values, base_value=base_value, feature_names=feature_names,
                raw_values=raw_values, method=method_label, output_space="positive-class probability",
            )
            return ExplainabilityService._attach_reference_metadata(report, background_path)
        except Exception as exc:
            return ExplainabilityService._missing_shap(f"SHAP computation failed: {exc}", method_label)

    @staticmethod
    def grad_cam(*, model, image_tensor: np.ndarray, target_positive: bool, report_id: str, storage_dir: Path,
                 positive_label: str = "Positive class", negative_label: str = "Negative class") -> dict:
        """Create a Grad-CAM heatmap file for a CNN, when it has a Conv2D layer."""
        try:
            import tensorflow as tf

            def find_last_conv(layer):
                if isinstance(layer, tf.keras.layers.Conv2D):
                    return layer
                if hasattr(layer, "layers"):
                    for child in reversed(layer.layers):
                        found = find_last_conv(child)
                        if found is not None:
                            return found
                return None

            last_conv = find_last_conv(model)
            if last_conv is None:
                raise ValueError("The CNN has no accessible Conv2D layer for Grad-CAM.")
            model_output = model.outputs[0] if isinstance(model.outputs, (list, tuple)) else model.output
            grad_model = tf.keras.Model(model.inputs, [last_conv.output, model_output])
            with tf.GradientTape() as tape:
                conv_output, predictions = grad_model(image_tensor, training=False)
                if predictions.shape[-1] == 1:
                    score = predictions[:, 0] if target_positive else 1.0 - predictions[:, 0]
                else:
                    class_index = 1 if target_positive and predictions.shape[-1] > 1 else 0
                    score = predictions[:, class_index]
            gradients = tape.gradient(score, conv_output)
            weights = tf.reduce_mean(gradients, axis=(0, 1, 2))
            heatmap = tf.reduce_sum(conv_output[0] * weights, axis=-1)
            heatmap = tf.maximum(heatmap, 0)
            maximum = float(tf.reduce_max(heatmap).numpy())
            if maximum > 0:
                heatmap = heatmap / maximum

            storage_dir.mkdir(parents=True, exist_ok=True)
            path = storage_dir / f"{report_id}-{uuid4().hex[:8]}-gradcam.npy"
            np.save(path, heatmap.numpy().astype(np.float32))
            return {
                "status": "available",
                "method": "Grad-CAM",
                "target_class": positive_label if target_positive else negative_label,
                "heatmap_path": str(path),
                "heatmap_shape": list(heatmap.shape),
                "limitations": ["Highlighted pixels influenced the CNN score; they are not confirmed anatomical findings."],
            }
        except Exception as exc:
            return {
                "status": "unavailable",
                "method": "Grad-CAM",
                "reason": f"Grad-CAM computation failed: {exc}",
                "limitations": ["No image explanation was generated."],
            }
