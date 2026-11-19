"""Model explanation helpers for the clinical-report layer.

Explanations are computed from the exact transformed inputs used for inference.
They describe model behaviour, never clinical causality or a confirmed diagnosis.
"""

from __future__ import annotations

import io
import base64
import json
import math
from pathlib import Path
from uuid import uuid4

import numpy as np
from PIL import Image


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
    def _jet_colormap(gray: np.ndarray) -> np.ndarray:
        """Convert normalized 2D float array in [0, 1] to RGB uint8 array using Jet colormap."""
        gray = np.clip(gray, 0.0, 1.0)
        r = np.clip(1.5 - np.abs(4.0 * gray - 3.0), 0.0, 1.0)
        g = np.clip(1.5 - np.abs(4.0 * gray - 2.0), 0.0, 1.0)
        b = np.clip(1.5 - np.abs(4.0 * gray - 1.0), 0.0, 1.0)
        return (np.stack([r, g, b], axis=-1) * 255.0).astype(np.uint8)

    @staticmethod
    def _generate_visual_overlays(image_bytes: bytes | None, cam_2d: np.ndarray) -> tuple[str | None, str | None]:
        """Generate base64 data URLs for heatmap and blended overlay."""
        if not image_bytes:
            return None, None
        try:
            pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            w, h = pil_img.size
            cam_uint8 = (np.clip(cam_2d, 0.0, 1.0) * 255.0).astype(np.uint8)
            cam_pil = Image.fromarray(cam_uint8).resize((w, h), Image.BILINEAR)
            cam_norm = np.array(cam_pil, dtype=np.float32) / 255.0

            heat_rgb = ExplainabilityService._jet_colormap(cam_norm)
            img_arr = np.array(pil_img)
            blend_arr = (0.55 * img_arr + 0.45 * heat_rgb).astype(np.uint8)

            buf_overlay = io.BytesIO()
            Image.fromarray(blend_arr).save(buf_overlay, format="PNG")
            overlay_url = "data:image/png;base64," + base64.b64encode(buf_overlay.getvalue()).decode("ascii")

            buf_heat = io.BytesIO()
            Image.fromarray(heat_rgb).save(buf_heat, format="PNG")
            heatmap_url = "data:image/png;base64," + base64.b64encode(buf_heat.getvalue()).decode("ascii")

            return overlay_url, heatmap_url
        except Exception:
            return None, None

    @staticmethod
    def grad_cam_keras(*, model, image_tensor: np.ndarray, image_bytes: bytes | None = None,
                       target_class_idx: int = 1, target_label: str = "Positive",
                       report_id: str, storage_dir: Path, confidence_percentage: float | None = None) -> dict:
        """Create a Grad-CAM heatmap and visual overlay for a Keras CNN model."""
        try:
            import tensorflow as tf

            conv_output = None
            predictions = None
            layer_name = "conv2d"

            # Case A: Sequential with nested Xception backbone (e.g. Brain Tumor)
            if hasattr(model, "layers") and any(l.name.lower() == "xception" for l in model.layers):
                xc = model.get_layer("xception")
                c_layer = xc.get_layer("block14_sepconv2_act")
                layer_name = "block14_sepconv2_act"
                conv_model = tf.keras.Model(xc.inputs, c_layer.output)
                pool = xc.get_layer("global_max_pooling2d")
                head_layers = model.layers[1:]
                with tf.GradientTape() as tape:
                    conv_output = conv_model(image_tensor, training=False)
                    tape.watch(conv_output)
                    x = pool(conv_output)
                    for l in head_layers:
                        x = l(x)
                    predictions = x
                    if predictions.shape[-1] == 1:
                        score = predictions[:, 0] if target_class_idx == 1 else 1.0 - predictions[:, 0]
                    else:
                        cls_idx = target_class_idx if target_class_idx < predictions.shape[-1] else 0
                        score = predictions[:, cls_idx]
                gradients = tape.gradient(score, conv_output)

            # Case B: Sequential stack with Conv2D layers (e.g. Skin Cancer)
            elif isinstance(model, tf.keras.models.Sequential):
                conv_indices = [
                    i for i, l in enumerate(model.layers)
                    if isinstance(l, (tf.keras.layers.Conv2D, tf.keras.layers.SeparableConv2D, tf.keras.layers.DepthwiseConv2D)) or "conv" in l.name.lower()
                ]
                if not conv_indices:
                    raise ValueError("Sequential CNN has no accessible Conv2D layers.")
                conv_idx = conv_indices[-1]
                layer_name = model.layers[conv_idx].name
                with tf.GradientTape() as tape:
                    x = image_tensor
                    for i, l in enumerate(model.layers):
                        x = l(x)
                        if i == conv_idx:
                            conv_output = x
                            tape.watch(conv_output)
                    predictions = x
                    if predictions.shape[-1] == 1:
                        score = predictions[:, 0] if target_class_idx == 1 else 1.0 - predictions[:, 0]
                    else:
                        cls_idx = target_class_idx if target_class_idx < predictions.shape[-1] else 0
                        score = predictions[:, cls_idx]
                gradients = tape.gradient(score, conv_output)

            # Case C: Functional models and standard architectures (e.g. Pneumonia Xception, Kidney CT)
            else:
                def find_last_conv(layer):
                    if hasattr(layer, "layers"):
                        for child in reversed(layer.layers):
                            found = find_last_conv(child)
                            if found is not None:
                                return found
                    if isinstance(layer, (tf.keras.layers.Conv2D, tf.keras.layers.SeparableConv2D, tf.keras.layers.DepthwiseConv2D)) or "conv" in getattr(layer, "name", "").lower():
                        return layer
                    return None

                last_conv = find_last_conv(model)
                if last_conv is None:
                    raise ValueError("The CNN has no accessible Conv2D layer for Grad-CAM.")
                layer_name = last_conv.name
                model_output = model.outputs[0] if isinstance(model.outputs, (list, tuple)) else model.output
                grad_model = tf.keras.Model(model.inputs, [last_conv.output, model_output])
                with tf.GradientTape() as tape:
                    conv_output, predictions = grad_model(image_tensor, training=False)
                    if predictions.shape[-1] == 1:
                        score = predictions[:, 0] if target_class_idx == 1 else 1.0 - predictions[:, 0]
                    else:
                        cls_idx = target_class_idx if target_class_idx < predictions.shape[-1] else 0
                        score = predictions[:, cls_idx]
                gradients = tape.gradient(score, conv_output)

            weights = tf.reduce_mean(gradients, axis=(0, 1, 2))
            heatmap = tf.reduce_sum(conv_output[0] * weights, axis=-1)
            heatmap = tf.maximum(heatmap, 0)
            heatmap_np = heatmap.numpy().astype(np.float32)
            maximum = float(np.max(heatmap_np))
            if maximum > 0:
                heatmap_np = heatmap_np / maximum

            storage_dir.mkdir(parents=True, exist_ok=True)
            path = storage_dir / f"{report_id}-{uuid4().hex[:8]}-gradcam.npy"
            np.save(path, heatmap_np)

            overlay_url, heat_url = ExplainabilityService._generate_visual_overlays(image_bytes, heatmap_np)

            return {
                "status": "available",
                "method": "Grad-CAM",
                "target_class": target_label,
                "target_layer": layer_name,
                "attention_statistics": {
                    "max_attention": round(float(np.max(heatmap_np)), 4),
                    "mean_attention": round(float(np.mean(heatmap_np)), 4),
                    "focal_ratio_above_50pct": round(float(np.mean(heatmap_np >= 0.5)), 4),
                },
                "confidence_percentage": confidence_percentage,
                "heatmap_path": str(path),
                "heatmap_shape": list(heatmap_np.shape),
                "heatmap_data_url": heat_url,
                "overlay_data_url": overlay_url,
                "limitations": ["Highlighted pixels influenced the CNN classification score; they are not confirmed anatomical findings."],
            }
        except Exception as exc:
            return {
                "status": "unavailable",
                "method": "Grad-CAM",
                "reason": f"Grad-CAM computation failed: {exc}",
                "limitations": ["No image explanation was generated."],
            }

    @staticmethod
    def grad_cam_pytorch(*, model, image_tensor, image_bytes: bytes | None = None,
                         target_class_idx: int = 0, target_label: str = "Predicted Class",
                         report_id: str, storage_dir: Path, confidence_percentage: float | None = None) -> dict:
        """Create a Grad-CAM heatmap and visual overlay for PyTorch models (e.g. ResNet-18)."""
        try:
            import torch

            activations = []
            def hook_fn(module, input, output):
                activations.append(output)

            target_layer = getattr(model, "base", None)
            if target_layer and hasattr(target_layer, "layer4"):
                hook = model.base.layer4.register_forward_hook(hook_fn)
            else:
                raise ValueError("PyTorch model does not have an accessible base.layer4.")

            model.eval()
            if not isinstance(image_tensor, torch.Tensor):
                image_tensor = torch.from_numpy(image_tensor).float()
            if image_tensor.ndim == 3:
                image_tensor = image_tensor.unsqueeze(0)
            if image_tensor.shape[-1] == 3 and image_tensor.shape[1] != 3:
                image_tensor = image_tensor.permute(0, 3, 1, 2)

            output = model(image_tensor)
            cls_idx = target_class_idx if target_class_idx < output.shape[-1] else 0
            score = output[0, cls_idx]
            model.zero_grad()
            grads = torch.autograd.grad(score, activations[0], retain_graph=False)[0]
            hook.remove()

            weights = torch.mean(grads, dim=(2, 3), keepdim=True)
            cam = torch.relu(torch.sum(weights * activations[0], dim=1, keepdim=True))
            cam_np = cam.squeeze().detach().cpu().numpy()
            min_v = float(np.min(cam_np))
            max_v = float(np.max(cam_np))
            if max_v > min_v:
                cam_np = (cam_np - min_v) / (max_v - min_v + 1e-8)
            else:
                cam_np = np.zeros_like(cam_np)

            storage_dir.mkdir(parents=True, exist_ok=True)
            path = storage_dir / f"{report_id}-{uuid4().hex[:8]}-gradcam.npy"
            np.save(path, cam_np.astype(np.float32))

            overlay_url, heat_url = ExplainabilityService._generate_visual_overlays(image_bytes, cam_np)

            return {
                "status": "available",
                "method": "Grad-CAM (PyTorch ResNet-18)",
                "target_class": target_label,
                "target_layer": "base.layer4 (ResNet-18)",
                "attention_statistics": {
                    "max_attention": round(float(np.max(cam_np)), 4),
                    "mean_attention": round(float(np.mean(cam_np)), 4),
                    "focal_ratio_above_50pct": round(float(np.mean(cam_np >= 0.5)), 4),
                },
                "confidence_percentage": confidence_percentage,
                "heatmap_path": str(path),
                "heatmap_shape": list(cam_np.shape),
                "heatmap_data_url": heat_url,
                "overlay_data_url": overlay_url,
                "limitations": ["Highlighted retinal zones influenced the ResNet-18 classification score."],
            }
        except Exception as exc:
            return {
                "status": "unavailable",
                "method": "Grad-CAM (PyTorch)",
                "reason": f"Grad-CAM computation failed: {exc}",
                "limitations": ["No image explanation was generated."],
            }

    @staticmethod
    def grad_cam(*, model, image_tensor: np.ndarray, target_positive: bool, report_id: str, storage_dir: Path,
                 positive_label: str = "Positive class", negative_label: str = "Negative class",
                 image_bytes: bytes | None = None) -> dict:
        """Backward-compatible wrapper delegating to grad_cam_keras."""
        return ExplainabilityService.grad_cam_keras(
            model=model,
            image_tensor=image_tensor,
            image_bytes=image_bytes,
            target_class_idx=1 if target_positive else 0,
            target_label=positive_label if target_positive else negative_label,
            report_id=report_id,
            storage_dir=storage_dir,
        )
