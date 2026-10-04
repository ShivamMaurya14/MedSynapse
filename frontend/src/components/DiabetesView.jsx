import React, { useState, useEffect } from 'react';
import { Droplets, Sparkles, AlertCircle, FileText, Play, RefreshCw, Activity, ArrowRight } from 'lucide-react';
import { predictDiabetes } from '../services/api';
import DiagnosticResultCard from './DiagnosticResultCard';
import DiabetesPipelineProgressModal from './DiabetesPipelineProgressModal';
import useDiabetesPipelineProgress from '../hooks/useDiabetesPipelineProgress';

export default function DiabetesView({ initialData, extractedHighlights, setTab }) {
  const [formData, setFormData] = useState({
    pregnancies: 1,
    glucose: 120,
    blood_pressure: 70,
    skin_thickness: 20,
    insulin: 80,
    bmi: 25.0,
    dpf: 0.5,
    age: 35
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const pipelineProgress = useDiabetesPipelineProgress();

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
      const res = await predictDiabetes(preset);
      setResult(res);
    } catch (err) {
      setError(err.message || 'Diabetes prediction failed');
    } finally {
      setLoading(false);
    }
  };

  const handlePredict = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    pipelineProgress.start();
    try {
      const res = await predictDiabetes(formData);
      setResult(res);
      pipelineProgress.transition('awaiting_review');
    } catch (err) {
      const message = err.message || 'Prediction failed';
      setError(message);
      pipelineProgress.fail(message, 'prediction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <DiabetesPipelineProgressModal
        isOpen={pipelineProgress.isOpen}
        stage={pipelineProgress.stage}
        error={pipelineProgress.error}
        failedAt={pipelineProgress.failedAt}
        onClose={pipelineProgress.close}
      />
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-danger">Metabolic Diagnostics</span>
            <span className="badge badge-cyan">Voting Classifier Ensemble</span>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', marginTop: '6px' }}>
            Diabetes Mellitus Risk Analyzer
          </h1>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Multi-model soft-voting ensemble combining Random Forest, Gradient Boosting, and Logistic Regression with categorized BMI.
          </p>
        </div>

        <button 
          onClick={() => setTab('ocr')} 
          className="btn-secondary"
          style={{ padding: '8px 14px', fontSize: '0.85rem' }}
        >
          <FileText size={15} color="#38bdf8" />
          <span>Upload Lab Report to Auto-Fill</span>
        </button>
      </div>

      {/* Presets Strip */}
      <div className="glass-panel" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          Clinical Presets:
        </span>
        <button
          type="button"
          onClick={() => handleApplyPreset({ pregnancies: 0, glucose: 88, blood_pressure: 68, skin_thickness: 18, insulin: 45, bmi: 21.5, dpf: 0.25, age: 28 })}
          className="btn-secondary"
          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
        >
          🟢 Optimal Baseline
        </button>
        <button
          type="button"
          onClick={() => handleApplyPreset({ pregnancies: 2, glucose: 118, blood_pressure: 78, skin_thickness: 25, insulin: 95, bmi: 27.8, dpf: 0.52, age: 44 })}
          className="btn-secondary"
          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
        >
          🟡 Prediabetic / Borderline
        </button>
        <button
          type="button"
          onClick={() => handleApplyPreset({ pregnancies: 3, glucose: 168, blood_pressure: 88, skin_thickness: 34, insulin: 195, bmi: 34.2, dpf: 0.88, age: 52 })}
          className="btn-secondary"
          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
        >
          🔴 High Diabetic Risk
        </button>
      </div>

      {/* Input Form */}
      <form onSubmit={handlePredict} className="glass-panel" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
          {/* Fasting Glucose */}
          <div className="form-group">
            <label className="form-label">
              <span>Fasting Glucose</span>
              <span className="unit-badge">mg/dL</span>
            </label>
            <input
              type="number"
              min="0"
              max="400"
              value={formData.glucose}
              onChange={(e) => handleChange('glucose', e.target.value)}
              className="form-input"
              required
            />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Normal: 70 - 99 mg/dL</span>
          </div>

          {/* Blood Pressure */}
          <div className="form-group">
            <label className="form-label">
              <span>Diastolic Blood Pressure</span>
              <span className="unit-badge">mm Hg</span>
            </label>
            <input
              type="number"
              min="0"
              max="200"
              value={formData.blood_pressure}
              onChange={(e) => handleChange('blood_pressure', e.target.value)}
              className="form-input"
              required
            />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Normal: &lt; 80 mm Hg</span>
          </div>

          {/* BMI */}
          <div className="form-group">
            <label className="form-label">
              <span>Body Mass Index (BMI)</span>
              <span className="unit-badge">kg/m²</span>
            </label>
            <input
              type="number"
              step="0.1"
              min="10"
              max="70"
              value={formData.bmi}
              onChange={(e) => handleChange('bmi', e.target.value)}
              className="form-input"
              required
            />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Normal: 18.5 - 24.9</span>
          </div>

          {/* Serum Insulin */}
          <div className="form-group">
            <label className="form-label">
              <span>Serum Insulin</span>
              <span className="unit-badge">μU/mL</span>
            </label>
            <input
              type="number"
              min="0"
              max="900"
              value={formData.insulin}
              onChange={(e) => handleChange('insulin', e.target.value)}
              className="form-input"
              required
            />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Normal: 2.6 - 24.9 μU/mL</span>
          </div>

          {/* Skin Thickness */}
          <div className="form-group">
            <label className="form-label">
              <span>Triceps Skin Thickness</span>
              <span className="unit-badge">mm</span>
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={formData.skin_thickness}
              onChange={(e) => handleChange('skin_thickness', e.target.value)}
              className="form-input"
              required
            />
          </div>

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

          {/* Pregnancies */}
          <div className="form-group">
            <label className="form-label">
              <span>Pregnancies</span>
              <span className="unit-badge">Count</span>
            </label>
            <input
              type="number"
              min="0"
              max="20"
              value={formData.pregnancies}
              onChange={(e) => handleChange('pregnancies', e.target.value)}
              className="form-input"
              required
            />
          </div>

          {/* Pedigree Function */}
          <div className="form-group">
            <label className="form-label">
              <span>Diabetes Pedigree Function</span>
              <span className="unit-badge">Score</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.0"
              max="3.0"
              value={formData.dpf}
              onChange={(e) => handleChange('dpf', e.target.value)}
              className="form-input"
              required
            />
          </div>
        </div>

        <div style={{ marginTop: '1.75rem', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
            style={{ padding: '12px 28px', fontSize: '1rem', background: 'linear-gradient(135deg, #e11d48, #f43f5e)' }}
          >
            {loading ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                <span>Running ML Ensemble Inference...</span>
              </>
            ) : (
              <>
                <Play size={18} />
                <span>Calculate Diabetes Risk</span>
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
          title="Diabetes Mellitus Risk Evaluation"
          onWorkflowStageChange={pipelineProgress.handleWorkflowStageChange}
          onReset={() => { setResult(null); pipelineProgress.reset(); }}
        />
      )}
    </div>
  );
}
