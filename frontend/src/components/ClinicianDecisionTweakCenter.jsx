import React, { useState } from 'react';
import {
  SlidersHorizontal,
  RotateCcw,
  MessageSquare,
  X,
  Plus,
  Trash2,
} from 'lucide-react';

export default function ClinicianDecisionTweakCenter({
  originalDecisions,
  tweaks,
  onUpdateTweak,
  onResetTweak,
  onResetAll,
  onUpdateFeatureRationale,
  isOpen,
  onClose,
  diseaseKey,
  clinicalInputs,
  onNavigateToForm,
}) {
  const [activeTab, setActiveTab] = useState('assessment');
  const [customDiagInput, setCustomDiagInput] = useState('');
  const [newRecInput, setNewRecInput] = useState('');

  if (!isOpen) return null;

  const {
    originalDiagnosis,
    originalRiskTier,
    originalRiskPercent,
    originalDecisionThreshold,
    originalRecommendations = [],
    shapContributions = [],
  } = originalDecisions;

  const activeInputs = clinicalInputs || originalDecisions?.inputs || {};
  const activeDiseaseKey = diseaseKey || originalDecisions?.diseaseKey || 'diabetes';
  const hasInputs = activeInputs && Object.keys(activeInputs).length > 0;

  const diagTweak = tweaks.diagnosis;
  const tierTweak = tweaks.riskTier;
  const probTweak = tweaks.riskProbability;
  const threshTweak = tweaks.decisionThreshold;
  const recsTweak = tweaks.recommendations;
  const featureRationales = tweaks.featureRationales || {};

  const currentRecs = recsTweak.isTweaked ? recsTweak.value : originalRecommendations;

  const handleAddRecommendation = () => {
    if (!newRecInput.trim()) return;
    const updated = [...currentRecs, newRecInput.trim()];
    onUpdateTweak('recommendations', updated, recsTweak.reason || 'Added clinical protocol instruction.');
    setNewRecInput('');
  };

  const handleRemoveRecommendation = (indexToRemove) => {
    const updated = currentRecs.filter((_, idx) => idx !== indexToRemove);
    onUpdateTweak('recommendations', updated, recsTweak.reason || 'Adjusted protocol recommendations.');
  };

  return (
    <div
      className="clinician-tweak-center animate-fade-in"
      style={{
        margin: '18px 0',
        padding: '18px 20px',
        background: '#ffffff',
        border: '2px solid #0d9488',
        borderRadius: '10px',
        boxShadow: '0 8px 30px -4px rgba(13, 148, 136, 0.15)',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1.5px solid #e2e8f0',
          paddingBottom: '12px',
          marginBottom: '14px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: '#f0fdfa',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #99f6e4',
            }}
          >
            <SlidersHorizontal size={18} color="#0d9488" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: '1rem',
                  fontWeight: 800,
                  color: '#0f172a',
                  textTransform: 'uppercase',
                  letterSpacing: '0.4px',
                }}
              >
                Clinician Decision Overrides & Tweak Center
              </h3>
              <span
                className="badge badge-cyan"
                style={{ fontSize: '0.68rem', fontWeight: 700 }}
              >
                Human-In-The-Loop CDSS
              </span>
            </div>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#64748b' }}>
              Override any AI model decision with mandatory medical reasoning. All adjustments are forwarded to the LLM final synthesis.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={onResetAll}
            className="btn-secondary"
            style={{
              padding: '6px 12px',
              fontSize: '0.78rem',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
            title="Revert all decisions back to the model output"
          >
            <RotateCcw size={13} />
            <span>Reset All to Defaults</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            style={{
              padding: '6px 10px',
              fontSize: '0.78rem',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
            aria-label="Close tweak center"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '8px',
          marginBottom: '16px',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTab('assessment')}
          style={{
            padding: '6px 14px',
            fontSize: '0.8rem',
            fontWeight: 700,
            borderRadius: '6px',
            cursor: 'pointer',
            border: activeTab === 'assessment' ? '1.5px solid #0d9488' : '1px solid #e2e8f0',
            background: activeTab === 'assessment' ? '#f0fdfa' : '#f8fafc',
            color: activeTab === 'assessment' ? '#0f766e' : '#475569',
          }}
        >
          1. Diagnosis & Risk Score ({diagTweak.isTweaked || tierTweak.isTweaked || probTweak.isTweaked ? 'Tweaked' : 'Default'})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('drivers')}
          style={{
            padding: '6px 14px',
            fontSize: '0.8rem',
            fontWeight: 700,
            borderRadius: '6px',
            cursor: 'pointer',
            border: activeTab === 'drivers' ? '1.5px solid #0d9488' : '1px solid #e2e8f0',
            background: activeTab === 'drivers' ? '#f0fdfa' : '#f8fafc',
            color: activeTab === 'drivers' ? '#0f766e' : '#475569',
          }}
        >
          2. Biomarker Drivers ({Object.keys(featureRationales).length} Reviewed)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('protocol')}
          style={{
            padding: '6px 14px',
            fontSize: '0.8rem',
            fontWeight: 700,
            borderRadius: '6px',
            cursor: 'pointer',
            border: activeTab === 'protocol' ? '1.5px solid #0d9488' : '1px solid #e2e8f0',
            background: activeTab === 'protocol' ? '#f0fdfa' : '#f8fafc',
            color: activeTab === 'protocol' ? '#0f766e' : '#475569',
          }}
        >
          3. Management Recommendations ({recsTweak.isTweaked ? 'Customized' : 'Default'})
        </button>

        {hasInputs && (
          <button
            type="button"
            onClick={() => setActiveTab('biomarkers')}
            style={{
              padding: '6px 14px',
              fontSize: '0.8rem',
              fontWeight: 700,
              borderRadius: '6px',
              cursor: 'pointer',
              border: activeTab === 'biomarkers' ? '1.5px solid #0d9488' : '1px solid #e2e8f0',
              background: activeTab === 'biomarkers' ? '#f0fdfa' : '#f8fafc',
              color: activeTab === 'biomarkers' ? '#0f766e' : '#475569',
            }}
          >
            4. Input Biomarkers ({Object.keys(activeInputs).length})
          </button>
        )}
      </div>

      {/* ── TAB 1: Diagnosis & Risk Score Tweaks ── */}
      {activeTab === 'assessment' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Decision 1: Primary Diagnosis */}
          <div
            style={{
              padding: '14px',
              borderRadius: '8px',
              background: diagTweak.isTweaked ? '#fffbeb' : '#f8fafc',
              border: diagTweak.isTweaked ? '1.5px solid #f59e0b' : '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  Model Decision #1
                </span>
                <h4 style={{ margin: '2px 0 0 0', fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                  Primary Clinical Diagnosis / Assessment
                </h4>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  Model Output: <strong style={{ color: '#0f172a' }}>{originalDiagnosis}</strong>
                </span>
                {diagTweak.isTweaked && (
                  <button
                    type="button"
                    onClick={() => onResetTweak('diagnosis')}
                    style={{ fontSize: '0.72rem', color: '#b45309', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Revert
                  </button>
                )}
              </div>
            </div>

            {/* Quick preset selector buttons */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {[
                'Baseline Physiological Control / Negative',
                'Borderline / Elevated Clinical Risk',
                'Positive Indication (Flagged)',
                'Pre-Diabetic / Impaired Glycemic State',
                'Benign Tissue Morphology',
                'Malignant / Suspicious Finding',
              ].map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onUpdateTweak('diagnosis', opt, diagTweak.reason || 'Clinician adjusted diagnosis based on overall clinical presentation.')}
                  style={{
                    padding: '4px 10px',
                    fontSize: '0.74rem',
                    fontWeight: 600,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    border: (diagTweak.isTweaked && diagTweak.value === opt) ? '1.5px solid #0d9488' : '1px solid #cbd5e1',
                    background: (diagTweak.isTweaked && diagTweak.value === opt) ? '#ccfbf1' : '#ffffff',
                    color: (diagTweak.isTweaked && diagTweak.value === opt) ? '#0f766e' : '#334155',
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>

            {/* Custom diagnosis text input */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <input
                type="text"
                placeholder="Or enter custom diagnosis classification..."
                value={customDiagInput}
                onChange={(e) => setCustomDiagInput(e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  fontSize: '0.8rem',
                  border: '1px solid #cbd5e1',
                  borderRadius: '4px',
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (customDiagInput.trim()) {
                    onUpdateTweak('diagnosis', customDiagInput.trim(), diagTweak.reason || 'Custom diagnostic assessment entered by physician.');
                    setCustomDiagInput('');
                  }
                }}
                className="btn-secondary"
                style={{ padding: '6px 12px', fontSize: '0.78rem', borderRadius: '4px' }}
              >
                Apply Custom
              </button>
            </div>

            {/* Rationale Message for Diagnosis Tweak */}
            {diagTweak.isTweaked && (
              <div style={{ marginTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', fontWeight: 700, color: '#92400e', marginBottom: '3px' }}>
                  <MessageSquare size={13} />
                  <span>Clinical Rationale / Why did you tweak this diagnosis? *</span>
                </label>
                <textarea
                  rows={2}
                  value={diagTweak.reason}
                  onChange={(e) => onUpdateTweak('diagnosis', diagTweak.value, e.target.value)}
                  placeholder="Explain why you adjusted the AI model's diagnosis (e.g., patient was acute non-fasting; physical exam showed no neuropathy or retinopathy signs)."
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: '0.78rem',
                    border: '1px solid #fcd34d',
                    borderRadius: '4px',
                    background: '#ffffff',
                    color: '#0f172a',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}
          </div>

          {/* Decision 2: Risk Tier */}
          <div
            style={{
              padding: '14px',
              borderRadius: '8px',
              background: tierTweak.isTweaked ? '#fffbeb' : '#f8fafc',
              border: tierTweak.isTweaked ? '1.5px solid #f59e0b' : '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  Model Decision #2
                </span>
                <h4 style={{ margin: '2px 0 0 0', fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                  Risk Stratification Tier
                </h4>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  Model Output: <strong style={{ color: '#0f172a' }}>{originalRiskTier}</strong>
                </span>
                {tierTweak.isTweaked && (
                  <button
                    type="button"
                    onClick={() => onResetTweak('riskTier')}
                    style={{ fontSize: '0.72rem', color: '#b45309', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Revert
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {['Low Risk', 'Moderate Risk', 'High Risk', 'Critical / Urgent'].map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => onUpdateTweak('riskTier', tier, tierTweak.reason || `Adjusted risk tier to ${tier} based on clinical judgment.`)}
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    border: (tierTweak.isTweaked && tierTweak.value === tier) ? '1.5px solid #0d9488' : '1px solid #cbd5e1',
                    background: (tierTweak.isTweaked && tierTweak.value === tier) ? '#ccfbf1' : '#ffffff',
                    color: (tierTweak.isTweaked && tierTweak.value === tier) ? '#0f766e' : '#334155',
                  }}
                >
                  {tier}
                </button>
              ))}
            </div>

            {tierTweak.isTweaked && (
              <div style={{ marginTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', fontWeight: 700, color: '#92400e', marginBottom: '3px' }}>
                  <MessageSquare size={13} />
                  <span>Clinical Rationale for Risk Tier Adjustment *</span>
                </label>
                <textarea
                  rows={2}
                  value={tierTweak.reason}
                  onChange={(e) => onUpdateTweak('riskTier', tierTweak.value, e.target.value)}
                  placeholder="Explain why you adjusted the risk classification tier..."
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: '0.78rem',
                    border: '1px solid #fcd34d',
                    borderRadius: '4px',
                    background: '#ffffff',
                    color: '#0f172a',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}
          </div>

          {/* Decision 3: Probability & Confidence Score */}
          <div
            style={{
              padding: '14px',
              borderRadius: '8px',
              background: probTweak.isTweaked ? '#fffbeb' : '#f8fafc',
              border: probTweak.isTweaked ? '1.5px solid #f59e0b' : '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  Model Decision #3
                </span>
                <h4 style={{ margin: '2px 0 0 0', fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                  Calibrated Risk Probability Score (%)
                </h4>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  Model Output: <strong style={{ color: '#0f172a' }}>{originalRiskPercent}%</strong>
                </span>
                {probTweak.isTweaked && (
                  <button
                    type="button"
                    onClick={() => onResetTweak('riskProbability')}
                    style={{ fontSize: '0.72rem', color: '#b45309', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Revert
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '10px' }}>
              <input
                type="range"
                min="0"
                max="100"
                step="0.5"
                value={probTweak.isTweaked ? probTweak.value : originalRiskPercent}
                onChange={(e) => onUpdateTweak('riskProbability', parseFloat(e.target.value), probTweak.reason || 'Calibrated probability score adjusted by attending physician.')}
                style={{ flex: 1 }}
              />
              <div style={{ minWidth: '70px', textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', fontSize: '1.1rem', color: '#0f172a' }}>
                {probTweak.isTweaked ? `${probTweak.value}%` : `${originalRiskPercent}%`}
              </div>
            </div>

            {probTweak.isTweaked && (
              <div style={{ marginTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', fontWeight: 700, color: '#92400e', marginBottom: '3px' }}>
                  <MessageSquare size={13} />
                  <span>Clinical Rationale for Probability Score Adjustment *</span>
                </label>
                <textarea
                  rows={2}
                  value={probTweak.reason}
                  onChange={(e) => onUpdateTweak('riskProbability', probTweak.value, e.target.value)}
                  placeholder="Explain why you calibrated the probability percentage..."
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: '0.78rem',
                    border: '1px solid #fcd34d',
                    borderRadius: '4px',
                    background: '#ffffff',
                    color: '#0f172a',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}
          </div>

          {/* Decision 4: Decision Cutoff Threshold */}
          <div
            style={{
              padding: '14px',
              borderRadius: '8px',
              background: threshTweak.isTweaked ? '#fffbeb' : '#f8fafc',
              border: threshTweak.isTweaked ? '1.5px solid #f59e0b' : '1px solid #e2e8f0',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div>
                <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
                  Model Decision #4
                </span>
                <h4 style={{ margin: '2px 0 0 0', fontSize: '0.88rem', fontWeight: 800, color: '#0f172a' }}>
                  Diagnostic Threshold Cutoff
                </h4>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  Model Baseline: <strong style={{ color: '#0f172a' }}>{Number(originalDecisionThreshold).toFixed(2)}</strong>
                </span>
                {threshTweak.isTweaked && (
                  <button
                    type="button"
                    onClick={() => onResetTweak('decisionThreshold')}
                    style={{ fontSize: '0.72rem', color: '#b45309', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Revert
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {[0.30, 0.40, 0.50, 0.60, 0.70].map((tVal) => (
                <button
                  key={tVal}
                  type="button"
                  onClick={() => onUpdateTweak('decisionThreshold', tVal, threshTweak.reason || `Adjusted diagnostic cutoff threshold to ${tVal.toFixed(2)} for targeted sensitivity.`)}
                  style={{
                    padding: '6px 14px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    border: (threshTweak.isTweaked && threshTweak.value === tVal) ? '1.5px solid #0d9488' : '1px solid #cbd5e1',
                    background: (threshTweak.isTweaked && threshTweak.value === tVal) ? '#ccfbf1' : '#ffffff',
                    color: (threshTweak.isTweaked && threshTweak.value === tVal) ? '#0f766e' : '#334155',
                  }}
                >
                  {tVal.toFixed(2)}
                </button>
              ))}
            </div>

            {threshTweak.isTweaked && (
              <div style={{ marginTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', fontWeight: 700, color: '#92400e', marginBottom: '3px' }}>
                  <MessageSquare size={13} />
                  <span>Clinical Rationale for Threshold Adjustment *</span>
                </label>
                <textarea
                  rows={2}
                  value={threshTweak.reason}
                  onChange={(e) => onUpdateTweak('decisionThreshold', threshTweak.value, e.target.value)}
                  placeholder="Explain why you adjusted the decision threshold (e.g. high-risk patient requires lower cutoff threshold)..."
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    fontSize: '0.78rem',
                    border: '1px solid #fcd34d',
                    borderRadius: '4px',
                    background: '#ffffff',
                    color: '#0f172a',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: Biomarker Drivers / SHAP Rationales ── */}
      {activeTab === 'drivers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
            Review each biomarker driver identified by the model. You can affirm the driver as valid or discount it (e.g. if known lab artifact or transient confounder) along with an explanation.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {shapContributions.length === 0 && (
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>
                No active SHAP biomarker weights recorded for this module.
              </p>
            )}

            {shapContributions.map((item) => {
              const featKey = item.feature;
              const rationale = featureRationales[featKey] || { status: 'affirmed', reason: '' };
              const shapVal = Number(item.shap_value || 0);
              const isPos = shapVal >= 0;

              return (
                <div
                  key={featKey}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    background: rationale.status === 'discounted' ? '#fef2f2' : '#f8fafc',
                    border: rationale.status === 'discounted' ? '1px solid #fecaca' : '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '0.84rem', color: '#0f172a' }}>{featKey}</strong>
                      <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: isPos ? '#dc2626' : '#15803d', fontWeight: 700 }}>
                        {isPos ? `+${shapVal.toFixed(4)} (Risk Driver)` : `${shapVal.toFixed(4)} (Protective)`}
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => onUpdateFeatureRationale(featKey, 'affirmed', rationale.reason)}
                        style={{
                          padding: '3px 8px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          borderRadius: '4px',
                          cursor: 'pointer',
                          background: rationale.status === 'affirmed' ? '#dcfce7' : '#ffffff',
                          color: rationale.status === 'affirmed' ? '#15803d' : '#64748b',
                          border: rationale.status === 'affirmed' ? '1px solid #86efac' : '1px solid #cbd5e1',
                        }}
                      >
                        Affirm Driver
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdateFeatureRationale(featKey, 'discounted', rationale.reason || 'Discounted due to known external clinical confounder.')}
                        style={{
                          padding: '3px 8px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          borderRadius: '4px',
                          cursor: 'pointer',
                          background: rationale.status === 'discounted' ? '#fee2e2' : '#ffffff',
                          color: rationale.status === 'discounted' ? '#b91c1c' : '#64748b',
                          border: rationale.status === 'discounted' ? '1px solid #fca5a5' : '1px solid #cbd5e1',
                        }}
                      >
                        Discount Driver
                      </button>
                    </div>
                  </div>

                  {rationale.status === 'discounted' && (
                    <input
                      type="text"
                      placeholder="Why is this biomarker driver discounted? (e.g. patient on beta-blockers, lab hemolyzed sample)..."
                      value={rationale.reason}
                      onChange={(e) => onUpdateFeatureRationale(featKey, 'discounted', e.target.value)}
                      style={{
                        width: '100%',
                        padding: '5px 8px',
                        fontSize: '0.76rem',
                        border: '1px solid #fca5a5',
                        borderRadius: '4px',
                        boxSizing: 'border-box',
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 3: Recommendations Protocol Tweaks ── */}
      {activeTab === 'protocol' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
              Add, remove, or revise clinical management instructions:
            </span>
            {recsTweak.isTweaked && (
              <button
                type="button"
                onClick={() => onResetTweak('recommendations')}
                style={{ fontSize: '0.72rem', color: '#b45309', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Reset to Model Recommendations
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {currentRecs.map((rec, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  padding: '7px 10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                }}
              >
                <span>• {rec}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveRecommendation(idx)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '2px',
                  }}
                  title="Remove this recommendation"
                >
                  <Trash2 size={14} className="hover:text-red-500" />
                </button>
              </div>
            ))}
          </div>

          {/* Add custom recommendation */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <input
              type="text"
              placeholder="Add physician customized recommendation or prescription order..."
              value={newRecInput}
              onChange={(e) => setNewRecInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddRecommendation()}
              style={{
                flex: 1,
                padding: '6px 10px',
                fontSize: '0.8rem',
                border: '1px solid #cbd5e1',
                borderRadius: '4px',
              }}
            />
            <button
              type="button"
              onClick={handleAddRecommendation}
              className="btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Plus size={14} /> Add
            </button>
          </div>

          {recsTweak.isTweaked && (
            <div style={{ marginTop: '6px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', fontWeight: 700, color: '#92400e', marginBottom: '3px' }}>
                <MessageSquare size={13} />
                <span>Clinical Rationale for Protocol Adjustment *</span>
              </label>
              <textarea
                rows={2}
                value={recsTweak.reason}
                onChange={(e) => onUpdateTweak('recommendations', currentRecs, e.target.value)}
                placeholder="Explain why you adjusted the clinical recommendations protocol..."
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  fontSize: '0.78rem',
                  border: '1px solid #fcd34d',
                  borderRadius: '4px',
                  background: '#ffffff',
                  color: '#0f172a',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: Patient Biomarkers & Inputs ── */}
      {activeTab === 'biomarkers' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div
            style={{
              padding: '12px 16px',
              background: '#f0fdfa',
              borderRadius: '8px',
              border: '1.5px solid #99f6e4',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div>
              <div style={{ fontWeight: 800, color: '#0f766e', fontSize: '0.86rem' }}>
                Patient Clinical Parameters & Biomarker Inputs
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: '#115e59' }}>
                Review evaluated patient values. To recalculate machine learning risk probabilities with modified biomarkers, return to the form below.
              </p>
            </div>

            {onNavigateToForm && (
              <button
                type="button"
                onClick={() => onNavigateToForm(activeDiseaseKey, activeInputs)}
                className="btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  fontSize: '0.8rem',
                  background: '#0d9488',
                  color: '#ffffff',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                <SlidersHorizontal size={14} />
                <span>Tweak in {activeDiseaseKey.toUpperCase()} Form ↗</span>
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
            {Object.entries(activeInputs).map(([k, v]) => (
              <div
                key={k}
                style={{
                  padding: '9px 12px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                }}
              >
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'capitalize' }}>
                  {k.replace(/_/g, ' ')}
                </span>
                <span style={{ fontSize: '0.94rem', fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>
                  {typeof v === 'number' ? v : String(v)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer Info & Confirmation */}
      <div
        style={{
          marginTop: '16px',
          paddingTop: '12px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <span style={{ fontSize: '0.76rem', color: '#0d9488', fontWeight: 600 }}>
          ✓ Tweaked parameters & reasons are locked into state and forwarded to LLM synthesis.
        </span>
        <button
          type="button"
          onClick={onClose}
          className="btn-primary"
          style={{
            padding: '6px 16px',
            fontSize: '0.8rem',
            background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
            color: '#ffffff',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Confirm & Close Tweak Center
        </button>
      </div>
    </div>
  );
}
