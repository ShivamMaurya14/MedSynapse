import React, { useState, useEffect } from 'react';
import { Heart, Sparkles, AlertCircle, FileText, Play, RefreshCw, Activity } from 'lucide-react';
import { predictHeart } from '../services/api';
import DiagnosticResultCard from './DiagnosticResultCard';

export default function HeartView({ initialData, setTab }) {
  const [formData, setFormData] = useState({
    age: 52,
    sex: 1,
    cp: 0,
    trestbps: 125,
    chol: 210,
    fbs: 0,
    restecg: 0,
    thalach: 150,
    exang: 0,
    oldpeak: 0.8,
    slope: 1,
    ca: 0,
    thal: 2
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({ ...prev, ...initialData }));
    }
  }, [initialData]);

  const handleChange = (field, val) => {
    setFormData(prev => ({ ...prev, [field]: parseFloat(val) || 0 }));
  };

  const handleApplyPreset = async (preset) => {
    setFormData(preset);
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await predictHeart(preset);
      setResult(res);
    } catch (err) {
      setError(err.message || 'Heart disease prediction failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePredict = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await predictHeart(formData);
      setResult(res);
    } catch (err) {
      setError(err.message || 'Heart disease prediction failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-warning">Cardiovascular Diagnostics</span>
            <span className="badge badge-cyan">Logistic Regression + Standard Scaler</span>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', marginTop: '6px' }}>
            Coronary Heart Disease Analyzer
          </h1>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Clinical multi-factor risk assessment across 13 cardiac indicators, exercise ECG markers, and lipid metrics.
          </p>
        </div>

        <button 
          onClick={() => setTab('ocr')} 
          className="btn-secondary"
          style={{ padding: '8px 14px', fontSize: '0.85rem' }}
        >
          <FileText size={15} color="#38bdf8" />
          <span>Upload ECG / Lipid Report to Auto-Fill</span>
        </button>
      </div>

      {/* Presets Strip */}
      <div className="glass-panel" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          Clinical Presets:
        </span>
        <button
          type="button"
          onClick={() => handleApplyPreset({ age: 38, sex: 0, cp: 1, trestbps: 115, chol: 175, fbs: 0, restecg: 0, thalach: 165, exang: 0, oldpeak: 0.2, slope: 2, ca: 0, thal: 1 })}
          className="btn-secondary"
          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
        >
          🟢 Healthy Cardiovascular Baseline
        </button>
        <button
          type="button"
          onClick={() => handleApplyPreset({ age: 58, sex: 1, cp: 0, trestbps: 148, chol: 265, fbs: 1, restecg: 1, thalach: 128, exang: 1, oldpeak: 2.4, slope: 1, ca: 2, thal: 3 })}
          className="btn-secondary"
          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
        >
          🔴 High Cardiac Risk (Angina + Stenosis)
        </button>
      </div>

      {/* Form Grid */}
      <form onSubmit={handlePredict} className="glass-panel" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
          {/* Age */}
          <div className="form-group">
            <label className="form-label">
              <span>Patient Age</span>
              <span className="unit-badge">Years</span>
            </label>
            <input
              type="number"
              min="1"
              max="120"
              value={formData.age}
              onChange={(e) => handleChange('age', e.target.value)}
              className="form-input"
              required
            />
          </div>

          {/* Sex */}
          <div className="form-group">
            <label className="form-label">
              <span>Biological Sex</span>
            </label>
            <select
              value={formData.sex}
              onChange={(e) => handleChange('sex', e.target.value)}
              className="form-select"
            >
              <option value={1}>Male</option>
              <option value={0}>Female</option>
            </select>
          </div>

          {/* Chest Pain Type */}
          <div className="form-group">
            <label className="form-label">
              <span>Chest Pain Presentation</span>
            </label>
            <select
              value={formData.cp}
              onChange={(e) => handleChange('cp', e.target.value)}
              className="form-select"
            >
              <option value={0}>Typical Angina (Type 0)</option>
              <option value={1}>Atypical Angina (Type 1)</option>
              <option value={2}>Non-anginal Pain (Type 2)</option>
              <option value={3}>Asymptomatic (Type 3)</option>
            </select>
          </div>

          {/* Resting Blood Pressure */}
          <div className="form-group">
            <label className="form-label">
              <span>Resting Blood Pressure</span>
              <span className="unit-badge">mm Hg</span>
            </label>
            <input
              type="number"
              min="50"
              max="250"
              value={formData.trestbps}
              onChange={(e) => handleChange('trestbps', e.target.value)}
              className="form-input"
              required
            />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Normal: 90 - 120 mm Hg</span>
          </div>

          {/* Serum Cholesterol */}
          <div className="form-group">
            <label className="form-label">
              <span>Serum Cholesterol</span>
              <span className="unit-badge">mg/dL</span>
            </label>
            <input
              type="number"
              min="100"
              max="600"
              value={formData.chol}
              onChange={(e) => handleChange('chol', e.target.value)}
              className="form-input"
              required
            />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Normal: &lt; 200 mg/dL</span>
          </div>

          {/* Fasting Blood Sugar > 120 */}
          <div className="form-group">
            <label className="form-label">
              <span>Fasting Blood Sugar &gt; 120 mg/dL</span>
            </label>
            <select
              value={formData.fbs}
              onChange={(e) => handleChange('fbs', e.target.value)}
              className="form-select"
            >
              <option value={0}>False (&le; 120 mg/dL)</option>
              <option value={1}>True (&gt; 120 mg/dL)</option>
            </select>
          </div>

          {/* Resting ECG */}
          <div className="form-group">
            <label className="form-label">
              <span>Resting Electrocardiogram (ECG)</span>
            </label>
            <select
              value={formData.restecg}
              onChange={(e) => handleChange('restecg', e.target.value)}
              className="form-select"
            >
              <option value={0}>Normal Sinus Rhythm</option>
              <option value={1}>ST-T Wave Abnormality</option>
              <option value={2}>Left Ventricular Hypertrophy (LVH)</option>
            </select>
          </div>

          {/* Max Heart Rate */}
          <div className="form-group">
            <label className="form-label">
              <span>Max Heart Rate Achieved</span>
              <span className="unit-badge">bpm</span>
            </label>
            <input
              type="number"
              min="50"
              max="250"
              value={formData.thalach}
              onChange={(e) => handleChange('thalach', e.target.value)}
              className="form-input"
              required
            />
          </div>

          {/* Exercise Induced Angina */}
          <div className="form-group">
            <label className="form-label">
              <span>Exercise Induced Angina</span>
            </label>
            <select
              value={formData.exang}
              onChange={(e) => handleChange('exang', e.target.value)}
              className="form-select"
            >
              <option value={0}>No (Negative)</option>
              <option value={1}>Yes (Positive)</option>
            </select>
          </div>

          {/* ST Depression */}
          <div className="form-group">
            <label className="form-label">
              <span>ST Depression (Oldpeak)</span>
              <span className="unit-badge">mm</span>
            </label>
            <input
              type="number"
              step="0.1"
              min="0.0"
              max="10.0"
              value={formData.oldpeak}
              onChange={(e) => handleChange('oldpeak', e.target.value)}
              className="form-input"
              required
            />
          </div>

          {/* Slope */}
          <div className="form-group">
            <label className="form-label">
              <span>Slope of Peak ST Segment</span>
            </label>
            <select
              value={formData.slope}
              onChange={(e) => handleChange('slope', e.target.value)}
              className="form-select"
            >
              <option value={0}>Upsloping (Type 0)</option>
              <option value={1}>Flat (Type 1)</option>
              <option value={2}>Downsloping (Type 2)</option>
            </select>
          </div>

          {/* Major Vessels */}
          <div className="form-group">
            <label className="form-label">
              <span>Major Vessels Colored (Fluoroscopy)</span>
            </label>
            <select
              value={formData.ca}
              onChange={(e) => handleChange('ca', e.target.value)}
              className="form-select"
            >
              <option value={0}>0 Vessels</option>
              <option value={1}>1 Vessel</option>
              <option value={2}>2 Vessels</option>
              <option value={3}>3 Vessels</option>
            </select>
          </div>

          {/* Thalassemia */}
          <div className="form-group">
            <label className="form-label">
              <span>Thalassemia Scan Status</span>
            </label>
            <select
              value={formData.thal}
              onChange={(e) => handleChange('thal', e.target.value)}
              className="form-select"
            >
              <option value={1}>Normal (1)</option>
              <option value={2}>Fixed Defect (2)</option>
              <option value={3}>Reversible Defect (3)</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: '1.75rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ padding: '12px 28px', fontSize: '1rem', background: 'linear-gradient(135deg, #dc2626, #ef4444)' }}
          >
            {loading ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                <span>Evaluating Cardiac Risk Profile...</span>
              </>
            ) : (
              <>
                <Play size={18} />
                <span>Evaluate Coronary Heart Risk</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Error Output */}
      {error && (
        <div style={{
          padding: '1rem',
          backgroundColor: 'rgba(244, 63, 94, 0.1)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          borderRadius: '10px',
          color: '#fda4af',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Results Card */}
      {result && (
        <DiagnosticResultCard
          result={result}
          title="Coronary Cardiovascular Risk Report"
          onReset={() => setResult(null)}
        />
      )}
    </div>
  );
}
