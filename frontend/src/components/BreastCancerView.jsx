import React, { useEffect, useState } from 'react';
import { FileText, Ribbon, Sparkles } from 'lucide-react';
import { predictBreastCancer } from '../services/api';
import DiagnosticResultCard from './DiagnosticResultCard';
import DiabetesPipelineProgressModal from './DiabetesPipelineProgressModal';
import useDiabetesPipelineProgress from '../hooks/useDiabetesPipelineProgress';

const BASE = ['radius', 'texture', 'perimeter', 'area', 'smoothness', 'compactness', 'concavity', 'concave_points', 'symmetry', 'fractal_dimension'];
const FEATURES = ['mean', 'se', 'worst'].flatMap(metric => BASE.map(name => `${name}_${metric}`));
const label = name => name.replace('_', ' ').replace(/\b\w/g, char => char.toUpperCase());

const MALIGNANT_SAMPLE = {
  radius_mean: 17.99, texture_mean: 10.38, perimeter_mean: 122.8, area_mean: 1001.0, smoothness_mean: 0.1184,
  compactness_mean: 0.2776, concavity_mean: 0.3001, concave_points_mean: 0.1471, symmetry_mean: 0.2419, fractal_dimension_mean: 0.07871,
  radius_se: 1.095, texture_se: 0.9053, perimeter_se: 8.589, area_se: 153.4, smoothness_se: 0.006399,
  compactness_se: 0.04904, concavity_se: 0.05373, concave_points_se: 0.01587, symmetry_se: 0.03003, fractal_dimension_se: 0.006193,
  radius_worst: 25.38, texture_worst: 17.33, perimeter_worst: 184.6, area_worst: 2019.0, smoothness_worst: 0.1622,
  compactness_worst: 0.6656, concavity_worst: 0.7119, concave_points_worst: 0.2654, symmetry_worst: 0.4601, fractal_dimension_worst: 0.1189
};

const BENIGN_SAMPLE = {
  radius_mean: 13.54, texture_mean: 14.36, perimeter_mean: 87.46, area_mean: 566.3, smoothness_mean: 0.09779,
  compactness_mean: 0.08129, concavity_mean: 0.06664, concave_points_mean: 0.04781, symmetry_mean: 0.1885, fractal_dimension_mean: 0.05766,
  radius_se: 0.2699, texture_se: 0.7886, perimeter_se: 2.058, area_se: 23.56, smoothness_se: 0.008462,
  compactness_se: 0.0146, concavity_se: 0.02387, concave_points_se: 0.01315, symmetry_se: 0.0198, fractal_dimension_se: 0.0023,
  radius_worst: 15.11, texture_worst: 19.26, perimeter_worst: 99.7, area_worst: 711.2, smoothness_worst: 0.144,
  compactness_worst: 0.1773, concavity_worst: 0.239, concave_points_worst: 0.1288, symmetry_worst: 0.2977, fractal_dimension_worst: 0.07259
};

export default function BreastCancerView({ setTab, initialData }) {
  const [features, setFeatures] = useState(() => Object.fromEntries(FEATURES.map(name => [name, ''])));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const pipelineProgress = useDiabetesPipelineProgress();

  useEffect(() => {
    if (initialData) setFeatures(Object.fromEntries(FEATURES.map(name => [name, initialData[name] ?? ''])));
  }, [initialData]);

  const loadPreset = async (presetData) => {
    setFeatures(Object.fromEntries(FEATURES.map(name => [name, presetData[name] ?? ''])));
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const response = await predictBreastCancer(Object.fromEntries(FEATURES.map(name => [name, Number(presetData[name])])));
      setResult(response);
    } catch (err) {
      setError(err.message || 'Breast-cancer prediction failed');
    } finally {
      setLoading(false);
    }
  };

  const submit = async event => {
    event.preventDefault();
    const missing = FEATURES.filter(name => features[name] === '');
    if (missing.length) return setError(`Enter all 30 WDBC FNA features. Missing: ${label(missing[0])}.`);
    setLoading(true); setError(null); setResult(null);
    pipelineProgress.start();
    try {
      const response = await predictBreastCancer(Object.fromEntries(FEATURES.map(name => [name, Number(features[name])])));
      setResult(response);
      pipelineProgress.transition('awaiting_review');
    } catch (err) {
      const message = err.message || 'Breast-cancer prediction failed';
      setError(message);
      pipelineProgress.fail(message, 'prediction');
    }
    finally { setLoading(false); }
  };

  return <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
    <DiabetesPipelineProgressModal
      isOpen={pipelineProgress.isOpen}
      stage={pipelineProgress.stage}
      error={pipelineProgress.error}
      failedAt={pipelineProgress.failedAt}
      onClose={pipelineProgress.close}
    />
    <div>
      <span className="badge badge-purple"><Ribbon size={13} /> Module M5 • Oncology</span>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '6px' }}>Breast Cancer FNA Morphology Analyzer</h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>PCA + Logistic Regression ensemble (96.49% Test Accuracy) evaluating 30 fine-needle aspirate (FNA) cell nuclei features.</p>
      
      <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
        <button type="button" className="btn-secondary" onClick={() => loadPreset(MALIGNANT_SAMPLE)}>
          <Sparkles size={14} color="#b91c1c" /> Load Malignant FNA Profile
        </button>
        <button type="button" className="btn-secondary" onClick={() => loadPreset(BENIGN_SAMPLE)}>
          <Sparkles size={14} color="#15803d" /> Load Benign FNA Profile
        </button>
        <button type="button" className="btn-secondary" onClick={() => setTab('ocr')}>
          <FileText size={14} /> Upload Pathology Report via OCR
        </button>
      </div>
    </div>

    <form className="glass-panel" onSubmit={submit} style={{ padding: '1.5rem' }}>
      {['mean', 'se', 'worst'].map(metric => <section key={metric} style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem', color: '#0f172a' }}>
          {metric === 'se' ? 'Standard Error Measurements' : `${metric[0].toUpperCase()}${metric.slice(1)} Measurements`}
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.9rem' }}>
          {BASE.map(base => { 
            const name = `${base}_${metric}`; 
            return <label className="form-group" key={name}>
              <span className="form-label">{label(name)}</span>
              <input 
                className="form-input" 
                type="number" 
                step="any" 
                value={features[name]} 
                onChange={event => setFeatures(previous => ({ ...previous, [name]: event.target.value }))} 
                required 
              />
            </label>; 
          })}
        </div>
      </section>)}
      {error && <p style={{ color: '#b42318', marginBottom: '1rem' }}>{error}</p>}
      <button className="btn-primary" disabled={loading} type="submit" style={{ padding: '10px 22px', background: '#0f172a' }}>
        {loading ? 'Running Breast Cancer Model…' : 'Run 30-Feature Breast Cancer Screening'}
      </button>
    </form>
    
    {result && (
      <DiagnosticResultCard
        result={result}
        title="Breast Cancer WDBC FNA Assessment"
        onWorkflowStageChange={pipelineProgress.handleWorkflowStageChange}
        onReset={() => { setResult(null); pipelineProgress.reset(); }}
      />
    )}
  </div>;
}
