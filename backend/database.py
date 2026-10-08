"""Local persistence configuration for structured clinical feature evidence.

SQLite is used for the local development deployment. The schema deliberately
stores the structured extraction payload and a report digest, not the original
uploaded report text, which may contain sensitive patient information.

For image-only models such as the pneumonia CNN, the local feature store also
keeps the uploaded image bytes. The model's features are derived pixel values,
so a database-backed inference path cannot be reproduced from an OCR digest.
This is intended for the local prototype; production deployments should use
approved encrypted medical-image storage instead of a SQLite BLOB.
"""

from __future__ import annotations

import hashlib
import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Generator


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATABASE_PATH = PROJECT_ROOT / "data" / "medsynapse.db"


def get_database_path() -> Path:
    """Resolve the SQLite file configured for this deployment."""
    configured_path = os.getenv("MEDSYNAPSE_DATABASE_PATH")
    if not configured_path:
        return DEFAULT_DATABASE_PATH

    path = Path(configured_path).expanduser()
    return path if path.is_absolute() else PROJECT_ROOT / path


@contextmanager
def get_connection() -> Generator[sqlite3.Connection, None, None]:
    """Yield a transaction-safe SQLite connection with foreign keys enabled."""
    database_path = get_database_path()
    database_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database_path)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize_database() -> Path:
    """Create the local feature-evidence schema if it does not already exist."""
    with get_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS feature_extractions (
                id TEXT PRIMARY KEY,
                report_id TEXT,
                disease_type TEXT NOT NULL,
                source_filename TEXT,
                report_sha256 TEXT NOT NULL,
                features_json TEXT NOT NULL,
                model_features_json TEXT,
                extraction_status TEXT NOT NULL,
                clinician_approval_status TEXT NOT NULL DEFAULT 'pending'
                    CHECK (clinician_approval_status IN ('pending', 'approved', 'rejected')),
                clinician_reviewed_by TEXT,
                clinician_review_note TEXT,
                clinician_reviewed_at TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_feature_extractions_report_id
                ON feature_extractions(report_id);
            CREATE INDEX IF NOT EXISTS idx_feature_extractions_disease_created
                ON feature_extractions(disease_type, created_at DESC);

            CREATE TABLE IF NOT EXISTS image_feature_extractions (
                id TEXT PRIMARY KEY,
                disease_type TEXT NOT NULL,
                source_filename TEXT,
                image_sha256 TEXT NOT NULL,
                image_bytes BLOB NOT NULL,
                preprocessing_json TEXT NOT NULL DEFAULT '{}',
                extraction_status TEXT NOT NULL,
                clinician_approval_status TEXT NOT NULL DEFAULT 'pending'
                    CHECK (clinician_approval_status IN ('pending', 'approved', 'rejected')),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_image_feature_extractions_disease_created
                ON image_feature_extractions(disease_type, created_at DESC);

            CREATE TABLE IF NOT EXISTS model_runs (
                id TEXT PRIMARY KEY,
                disease_type TEXT NOT NULL,
                feature_extraction_id TEXT,
                prediction_json TEXT NOT NULL,
                clinical_report_json TEXT NOT NULL,
                workflow_status TEXT NOT NULL DEFAULT 'awaiting_clinician_review'
                    CHECK (workflow_status IN (
                        'awaiting_clinician_review', 'clinician_approved',
                        'clinician_rejected', 'final_report_generated'
                    )),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_model_runs_disease_created
                ON model_runs(disease_type, created_at DESC);

            CREATE TABLE IF NOT EXISTS clinician_decisions (
                id TEXT PRIMARY KEY,
                model_run_id TEXT NOT NULL,
                decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
                reviewed_by TEXT NOT NULL,
                comment TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (model_run_id) REFERENCES model_runs(id)
            );

            CREATE INDEX IF NOT EXISTS idx_clinician_decisions_run_created
                ON clinician_decisions(model_run_id, created_at DESC);

            CREATE TABLE IF NOT EXISTS final_reports (
                id TEXT PRIMARY KEY,
                model_run_id TEXT NOT NULL UNIQUE,
                approved_package_json TEXT NOT NULL,
                llm_report_json TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (model_run_id) REFERENCES model_runs(id)
            );
            """
        )
        existing_columns = {
            row["name"] for row in connection.execute("PRAGMA table_info(feature_extractions)")
        }
        for column_name, column_type in (
            ("clinician_reviewed_by", "TEXT"),
            ("clinician_review_note", "TEXT"),
            ("clinician_reviewed_at", "TEXT"),
        ):
            if column_name not in existing_columns:
                connection.execute(
                    f"ALTER TABLE feature_extractions ADD COLUMN {column_name} {column_type}"
                )
    return get_database_path()


def report_sha256(report_text: str) -> str:
    """Return a stable digest for deduplication without persisting report text."""
    return hashlib.sha256(report_text.encode("utf-8")).hexdigest()


def image_sha256(image_bytes: bytes) -> str:
    """Return a stable digest for the source image stored in the local prototype."""
    return hashlib.sha256(image_bytes).hexdigest()


def save_feature_extraction(
    *,
    disease_type: str,
    source_filename: str,
    report_text: str,
    features: dict,
    model_features: dict | None,
    extraction_status: str,
) -> str:
    """Persist extracted evidence and return its immutable extraction ID.

    The original OCR text is intentionally not stored. ``report_sha256`` makes
    repeated extractions traceable without copying patient report content into
    the local database.
    """

    extraction_id = str(uuid.uuid4())
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO feature_extractions (
                id, disease_type, source_filename, report_sha256,
                features_json, model_features_json, extraction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                extraction_id,
                disease_type,
                source_filename or None,
                report_sha256(report_text),
                json.dumps(features, separators=(",", ":"), ensure_ascii=False),
                (
                    json.dumps(model_features, separators=(",", ":"), ensure_ascii=False)
                    if model_features is not None
                    else None
                ),
                extraction_status,
            ),
        )
    return extraction_id


def load_model_features(extraction_id: str, disease_type: str) -> dict:
    """Load inference-ready feature values from the local feature store.

    Raw OCR text is never read by a prediction endpoint. A record must have
    passed the extraction contract and contain its ordered model-feature JSON.
    """
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT disease_type, extraction_status, clinician_approval_status,
                   model_features_json
            FROM feature_extractions
            WHERE id = ?
            """,
            (extraction_id,),
        ).fetchone()

    if row is None:
        raise LookupError("Feature extraction was not found in the local database.")
    if row["disease_type"] != disease_type:
        raise ValueError("Stored features do not belong to the requested disease model.")
    if row["extraction_status"] != "ready_for_inference" or not row["model_features_json"]:
        raise ValueError("Stored features are incomplete or require clinician review before inference.")
    if row["clinician_approval_status"] != "approved":
        raise ValueError(
            "Stored features require clinician approval before inference; "
            f"current status is {row['clinician_approval_status']}."
        )

    try:
        model_features = json.loads(row["model_features_json"])
    except json.JSONDecodeError as exc:
        raise ValueError("Stored model features are corrupted.") from exc
    if not isinstance(model_features, dict):
        raise ValueError("Stored model features have an invalid format.")
    return model_features


def load_feature_extraction_for_review(extraction_id: str) -> dict:
    """Return stored evidence and review state without exposing raw report text."""
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT id, disease_type, source_filename, report_sha256,
                   features_json, model_features_json, extraction_status,
                   clinician_approval_status, clinician_reviewed_by,
                   clinician_review_note, clinician_reviewed_at,
                   created_at, updated_at
            FROM feature_extractions
            WHERE id = ?
            """,
            (extraction_id,),
        ).fetchone()

    if row is None:
        raise LookupError("Feature extraction was not found in the local database.")
    try:
        features = json.loads(row["features_json"])
        model_features = (
            json.loads(row["model_features_json"])
            if row["model_features_json"]
            else None
        )
    except json.JSONDecodeError as exc:
        raise ValueError("Stored feature evidence is corrupted.") from exc
    return {
        "id": row["id"],
        "disease_type": row["disease_type"],
        "source_filename": row["source_filename"],
        "report_sha256": row["report_sha256"],
        "features": features,
        "model_features": model_features,
        "extraction_status": row["extraction_status"],
        "clinician_approval_status": row["clinician_approval_status"],
        "clinician_reviewed_by": row["clinician_reviewed_by"],
        "clinician_review_note": row["clinician_review_note"],
        "clinician_reviewed_at": row["clinician_reviewed_at"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def set_clinician_approval(
    extraction_id: str,
    *,
    status: str,
    reviewed_by: str,
    note: str | None = None,
) -> dict:
    """Record an explicit clinician approval or rejection transition."""
    if status not in {"approved", "rejected"}:
        raise ValueError("Clinician review status must be approved or rejected.")
    reviewed_by = reviewed_by.strip()
    if not reviewed_by:
        raise ValueError("The clinician reviewer name or identifier is required.")
    normalized_note = note.strip() if note and note.strip() else None

    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT extraction_status, model_features_json
            FROM feature_extractions
            WHERE id = ?
            """,
            (extraction_id,),
        ).fetchone()
        if row is None:
            raise LookupError("Feature extraction was not found in the local database.")
        if status == "approved" and (
            row["extraction_status"] != "ready_for_inference"
            or not row["model_features_json"]
        ):
            raise ValueError("Incomplete feature evidence cannot be approved for inference.")
        connection.execute(
            """
            UPDATE feature_extractions
            SET clinician_approval_status = ?, clinician_reviewed_by = ?,
                clinician_review_note = ?, clinician_reviewed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (status, reviewed_by, normalized_note, extraction_id),
        )
    return load_feature_extraction_for_review(extraction_id)


def save_model_run(
    *,
    disease_type: str,
    prediction: dict,
    clinical_report: dict,
    feature_extraction_id: str | None = None,
) -> dict:
    """Persist immutable model output and return its clinician-review package."""
    model_run_id = str(uuid.uuid4())
    report = json.loads(json.dumps(clinical_report))
    report["model_run_id"] = model_run_id
    report["workflow"] = {
        "status": "awaiting_clinician_review",
        "requires_clinician_review": True,
        "final_llm_report_allowed": False,
    }
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO model_runs (
                id, disease_type, feature_extraction_id, prediction_json,
                clinical_report_json, workflow_status
            ) VALUES (?, ?, ?, ?, ?, 'awaiting_clinician_review')
            """,
            (
                model_run_id,
                disease_type,
                feature_extraction_id,
                json.dumps(prediction, separators=(",", ":"), ensure_ascii=False),
                json.dumps(report, separators=(",", ":"), ensure_ascii=False),
            ),
        )
    return {
        "model_run_id": model_run_id,
        "workflow_status": "awaiting_clinician_review",
        "clinical_report": report,
    }


def load_model_run(model_run_id: str) -> dict:
    """Load a model run with its latest clinician decision and final report."""
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT id, disease_type, feature_extraction_id, prediction_json,
                   clinical_report_json, workflow_status, created_at, updated_at
            FROM model_runs WHERE id = ?
            """,
            (model_run_id,),
        ).fetchone()
        decision = connection.execute(
            """
            SELECT id, decision, reviewed_by, comment, created_at
            FROM clinician_decisions
            WHERE model_run_id = ?
            ORDER BY created_at DESC, rowid DESC LIMIT 1
            """,
            (model_run_id,),
        ).fetchone()
        final_report = connection.execute(
            """
            SELECT id, llm_report_json, created_at
            FROM final_reports WHERE model_run_id = ?
            """,
            (model_run_id,),
        ).fetchone()

    if row is None:
        raise LookupError("Model run was not found in the local database.")
    try:
        prediction = json.loads(row["prediction_json"])
        clinical_report = json.loads(row["clinical_report_json"])
        llm_report = json.loads(final_report["llm_report_json"]) if final_report else None
    except json.JSONDecodeError as exc:
        raise ValueError("Stored model-run evidence is corrupted.") from exc
    return {
        "id": row["id"],
        "disease_type": row["disease_type"],
        "feature_extraction_id": row["feature_extraction_id"],
        "prediction": prediction,
        "clinical_report": clinical_report,
        "workflow_status": row["workflow_status"],
        "clinician_decision": (
            {
                "id": decision["id"],
                "decision": decision["decision"],
                "reviewed_by": decision["reviewed_by"],
                "comment": decision["comment"],
                "created_at": decision["created_at"],
            }
            if decision else None
        ),
        "final_report": llm_report,
        "final_report_id": final_report["id"] if final_report else None,
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


def review_model_run(
    model_run_id: str,
    *,
    decision: str,
    reviewed_by: str,
    comment: str | None = None,
) -> dict:
    """Record the doctor's post-model approval or rejection decision."""
    if decision not in {"approved", "rejected"}:
        raise ValueError("Model-run decision must be approved or rejected.")
    reviewed_by = reviewed_by.strip()
    if not reviewed_by:
        raise ValueError("The clinician reviewer name or identifier is required.")
    normalized_comment = comment.strip() if comment and comment.strip() else None
    with get_connection() as connection:
        row = connection.execute(
            "SELECT workflow_status FROM model_runs WHERE id = ?",
            (model_run_id,),
        ).fetchone()
        if row is None:
            raise LookupError("Model run was not found in the local database.")
        if row["workflow_status"] == "final_report_generated":
            raise ValueError("A finalized model run can no longer be reviewed.")
        decision_id = str(uuid.uuid4())
        connection.execute(
            """
            INSERT INTO clinician_decisions (
                id, model_run_id, decision, reviewed_by, comment
            ) VALUES (?, ?, ?, ?, ?)
            """,
            (decision_id, model_run_id, decision, reviewed_by, normalized_comment),
        )
        connection.execute(
            """
            UPDATE model_runs
            SET workflow_status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (
                "clinician_approved" if decision == "approved" else "clinician_rejected",
                model_run_id,
            ),
        )
    return load_model_run(model_run_id)


def build_approved_report_package(model_run_id: str) -> dict:
    """Return the exact approved evidence supplied to the single final LLM call."""
    model_run = load_model_run(model_run_id)
    decision = model_run["clinician_decision"]
    if model_run["workflow_status"] != "clinician_approved" or not decision:
        raise ValueError("Final report generation requires an approved clinician decision.")
    return {
        "model_run_id": model_run["id"],
        "disease_type": model_run["disease_type"],
        "feature_extraction_id": model_run["feature_extraction_id"],
        "prediction": model_run["prediction"],
        "clinical_inputs": model_run["clinical_report"].get("clinical_inputs", []),
        "explainability": model_run["clinical_report"].get("explainability", {}),
        "safety": model_run["clinical_report"].get("safety", {}),
        "clinician_decision": decision,
    }


def save_final_report(model_run_id: str, approved_package: dict, llm_report: dict) -> dict:
    """Persist a final LLM report and close the approved model run."""
    final_report_id = str(uuid.uuid4())
    with get_connection() as connection:
        row = connection.execute(
            "SELECT workflow_status FROM model_runs WHERE id = ?",
            (model_run_id,),
        ).fetchone()
        if row is None:
            raise LookupError("Model run was not found in the local database.")
        if row["workflow_status"] != "clinician_approved":
            raise ValueError("Only an approved model run can generate a final report.")
        connection.execute(
            """
            INSERT INTO final_reports (
                id, model_run_id, approved_package_json, llm_report_json
            ) VALUES (?, ?, ?, ?)
            """,
            (
                final_report_id,
                model_run_id,
                json.dumps(approved_package, separators=(",", ":"), ensure_ascii=False),
                json.dumps(llm_report, separators=(",", ":"), ensure_ascii=False),
            ),
        )
        connection.execute(
            """
            UPDATE model_runs
            SET workflow_status = 'final_report_generated', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            (model_run_id,),
        )
    return load_model_run(model_run_id)


def save_image_feature_extraction(
    *,
    disease_type: str,
    source_filename: str,
    image_bytes: bytes,
    preprocessing: dict,
    extraction_status: str = "ready_for_inference",
) -> str:
    """Persist a validated image-model input and its preprocessing evidence.

    This is deliberately separate from ``feature_extractions``: X-ray CNN
    inputs are image pixels, rather than JSON-compatible tabular features.
    """
    if not image_bytes:
        raise ValueError("Image bytes cannot be empty.")

    extraction_id = str(uuid.uuid4())
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO image_feature_extractions (
                id, disease_type, source_filename, image_sha256, image_bytes,
                preprocessing_json, extraction_status
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                extraction_id,
                disease_type,
                source_filename or None,
                image_sha256(image_bytes),
                sqlite3.Binary(image_bytes),
                json.dumps(preprocessing, separators=(",", ":"), ensure_ascii=False),
                extraction_status,
            ),
        )
    return extraction_id


def load_image_feature_extraction(extraction_id: str, disease_type: str) -> tuple[bytes, dict]:
    """Load a validated image-model input from the local feature store."""
    with get_connection() as connection:
        row = connection.execute(
            """
            SELECT disease_type, image_sha256, image_bytes, preprocessing_json, extraction_status
            FROM image_feature_extractions
            WHERE id = ?
            """,
            (extraction_id,),
        ).fetchone()

    if row is None:
        raise LookupError("Image feature extraction was not found in the local database.")
    if row["disease_type"] != disease_type:
        raise ValueError("Stored image does not belong to the requested disease model.")
    if row["extraction_status"] != "ready_for_inference":
        raise ValueError("Stored image is incomplete or requires clinician review before inference.")

    image_bytes = bytes(row["image_bytes"])
    if not image_bytes or image_sha256(image_bytes) != row["image_sha256"]:
        raise ValueError("Stored image evidence is corrupted.")
    try:
        preprocessing = json.loads(row["preprocessing_json"])
    except json.JSONDecodeError as exc:
        raise ValueError("Stored image preprocessing evidence is corrupted.") from exc
    if not isinstance(preprocessing, dict):
        raise ValueError("Stored image preprocessing evidence has an invalid format.")
    return image_bytes, preprocessing
