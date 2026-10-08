const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`);
    return await res.json();
  } catch (err) {
    return { status: 'offline', error: err.message };
  }
}

export async function getSampleReports() {
  const res = await fetch(`${API_BASE_URL}/api/sample-reports`);
  if (!res.ok) throw new Error('Failed to load sample reports');
  return await res.json();
}

export async function parseReportOCR({ file, rawText, diseaseType = 'all' }) {
  const formData = new FormData();
  if (file) {
    formData.append('file', file);
  }
  if (rawText) {
    formData.append('raw_text', rawText);
  }
  formData.append('disease_type', diseaseType);

  const res = await fetch(`${API_BASE_URL}/api/ocr/parse-report`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'OCR processing failed');
  }
  return await res.json();
}

export async function predictDiabetes(params) {
  const res = await fetch(`${API_BASE_URL}/api/predict/diabetes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Diabetes prediction failed');
  }
  return await res.json();
}

export async function predictHeart(params) {
  const res = await fetch(`${API_BASE_URL}/api/predict/heart`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Heart prediction failed');
  }
  return await res.json();
}

export async function predictXRay(file) {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE_URL}/api/predict/xray`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'X-Ray analysis failed');
  }
  return await res.json();
}

export async function predictXRayFromFeatureStore(featureExtractionId) {
  const res = await fetch(
    `${API_BASE_URL}/api/predict/xray/from-feature-store/${encodeURIComponent(featureExtractionId)}`,
    { method: 'POST' },
  );
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Stored X-Ray analysis failed');
  }
  return await res.json();
}

async function predictImageModel(path, file, label) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', body: formData });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || `${label} failed`);
  }
  return await res.json();
}

export function predictEye(file) {
  return predictImageModel('/api/predict/eye', file, 'Eye disease analysis');
}

export async function predictBreastCancer(features) {
  const res = await fetch(`${API_BASE_URL}/api/predict/breast-cancer`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ features }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Breast cancer analysis failed');
  }
  return res.json();
}

export async function generateClinicalNarrative(clinicalReport) {
  const res = await fetch(`${API_BASE_URL}/api/reports/generate-narrative`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ report: clinicalReport }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Clinical narrative generation failed');
  }
  return res.json();
}

export async function getModelRun(modelRunId) {
  const res = await fetch(`${API_BASE_URL}/api/model-runs/${encodeURIComponent(modelRunId)}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to load model-run review data');
  }
  return res.json();
}

export async function reviewModelRun(modelRunId, decision, reviewedBy, comment = '') {
  const res = await fetch(
    `${API_BASE_URL}/api/model-runs/${encodeURIComponent(modelRunId)}/review`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, reviewed_by: reviewedBy, comment }),
    },
  );
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Clinician review failed');
  }
  return res.json();
}

export async function generateFinalReport(modelRunId) {
  const res = await fetch(
    `${API_BASE_URL}/api/model-runs/${encodeURIComponent(modelRunId)}/final-report`,
    { method: 'POST' },
  );
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Final report generation failed');
  }
  return res.json();
}
