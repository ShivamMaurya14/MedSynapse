# MedSynapse Common Clinical Review Pipeline

```mermaid
flowchart TD
    A[Doctor uploads report or scan] --> B{Input type}

    B -->|PDF or report image| C[OCR: PyMuPDF or Tesseract]
    C --> D[Regex and Gemma feature extraction]
    D --> E[Validate and derive model features]
    E --> F[(Feature evidence store)]
    F --> G[Doctor reviews or corrects extracted features]

    B -->|Diagnostic image| H[Validate and preprocess image]
    G --> I{Select disease module}
    H --> I

    I -->|Diabetes| J[Diabetes classifier]
    I -->|Heart| K[Heart classifier]
    I -->|Breast cancer| L[Breast cancer classifier]
    I -->|Pneumonia X-ray| M[Pneumonia CNN]
    I -->|Eye disease| N[Eye disease CNN]

    J --> O[Prediction and probability]
    K --> O
    L --> O
    M --> O
    N --> O

    J --> P[SHAP feature contributions]
    K --> P
    L --> P
    M --> Q[Grad-CAM attention map]
    N --> Q

    O --> R[Common model-run record]
    P --> R
    Q --> R
    R --> S[Deterministic explanation templates]
    S --> T[Doctor result and explanation screen]
    T --> U{Doctor decision}

    U -->|Reject| V[Store rejection and stop report generation]
    U -->|Approve| W[Create immutable approved JSON package]
    W --> X[One final Groq API call]
    X --> Y[Validate structured JSON response]
    Y --> Z[(Persist final report)]
    Z --> AA[Display, print, or export report]

    classDef user fill:#e8f5e9,stroke:#25854a,color:#111;
    classDef frontend fill:#e3f2fd,stroke:#1976d2,color:#111;
    classDef backend fill:#fff8e1,stroke:#f59e0b,color:#111;
    classDef model fill:#f3e5f5,stroke:#7b1fa2,color:#111;
    classDef storage fill:#fce4ec,stroke:#c2185b,color:#111;
    classDef blocked fill:#ffebee,stroke:#c62828,color:#111;

    class A,G,T,U user;
    class AA frontend;
    class B,C,D,E,H,I,O,R,S,W,Y backend;
    class J,K,L,M,N,P,Q,X model;
    class F,Z storage;
    class V blocked;
```

## Implemented contract

1. Every prediction endpoint creates a `model_runs` row with status
   `awaiting_clinician_review`.
2. SHAP or Grad-CAM evidence is converted to readable sentences with deterministic
   templates. No LLM is called for this step.
3. The doctor can approve or reject the completed model run and attach a comment.
4. Rejected or pending runs cannot call the final-report endpoint.
5. An approved run is serialized with its prediction, exact explanation evidence,
   and clinician decision into one JSON package.
6. The final report-generation call uses Groq with a strict JSON schema. Its JSON
   structure is validated before it is stored in `final_reports`.
7. Once the final report is persisted, the model run is locked from further review.

## Shared API flow

```text
POST /api/predict/{module}
  -> model_run_id + prediction + clinical_report + awaiting_clinician_review

POST /api/model-runs/{model_run_id}/review
  -> approved or rejected clinician decision

POST /api/model-runs/{model_run_id}/final-report
  -> allowed only after approval; performs the Groq report call

GET /api/model-runs/{model_run_id}
  -> complete persisted audit record
```

The prediction routes currently covered are diabetes, heart, breast cancer,
pneumonia X-ray, and eye disease. Database-backed diabetes, breast-cancer, and
X-ray inference routes use the same post-model review pipeline.
