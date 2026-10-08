import React, { useEffect, useState } from 'react';
import { FileText, Ribbon } from 'lucide-react';
import { predictBreastCancer } from '../services/api';
import DiagnosticResultCard from './DiagnosticResultCard';

const BASE = ['radius', 'texture', 'perimeter', 'area', 'smoothness', 'compactness', 'concavity', 'concave_points', 'symmetry', 'fractal_dimension'];
const FEATURES = ['mean', 'se', 'worst'].flatMap(metric => BASE.map(name => `${name}_${metric}`));
const label = name => name.replace('_', ' ').replace(/\b\w/g, char => char.toUpperCase());

export default function BreastCancerView({ setTab, initialData }) {
  const [features, setFeatures] = useState(() => Object.fromEntries(FEATURES.map(name => [name, ''])));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (initialData) setFeatures(Object.fromEntries(FEATURES.map(name => [name, initialData[name] ?? ''])));
  }, [initialData]);

  const submit = async event => {
    event.preventDefault();
    const missing = FEATURES.filter(name => features[name] === '');
    if (missing.length) return setError(`Enter all 30 WDBC FNA features. Missing: ${label(missing[0])}.`);
    setLoading(true); setError(null);
    try {
      const response = await predictBreastCancer(Object.fromEntries(FEATURES.map(name => [name, Number(features[name])])));
      setResult(response);
    } catch (err) { setError(err.message || 'Breast-cancer prediction failed'); }
    finally { setLoading(false); }
  };

  return <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
    <div>
      <span className="badge badge-purple"><Ribbon size={13} /> WDBC FNA Tabular Model</span>
      <h1 style={{ fontSize: '2rem', fontWeight: 800, marginTop: '6px' }}>Breast Cancer Analyzer</h1>
      <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>Enter the 30 WDBC fine-needle-aspirate morphology measurements, or upload a pathology report through OCR for structured extraction.</p>
      <button className="btn-secondary" style={{ marginTop: '12px' }} onClick={() => setTab('ocr')}><FileText size={16} /> Upload Pathology Report</button>
    </div>
    <form className="glass-panel" onSubmit={submit} style={{ padding: '1.5rem' }}>
      {['mean', 'se', 'worst'].map(metric => <section key={metric} style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '0.75rem' }}>{metric === 'se' ? 'Standard Error Measurements' : `${metric[0].toUpperCase()}${metric.slice(1)} Measurements`}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.9rem' }}>
          {BASE.map(base => { const name = `${base}_${metric}`; return <label className="form-group" key={name}><span className="form-label">{label(name)}</span><input className="form-input" type="number" step="any" value={features[name]} onChange={event => setFeatures(previous => ({ ...previous, [name]: event.target.value }))} required /></label>; })}
        </div>
      </section>)}
      {error && <p style={{ color: '#b42318', marginBottom: '1rem' }}>{error}</p>}
      <button className="btn-primary" disabled={loading} type="submit">{loading ? 'Running Breast Cancer Model…' : 'Run Breast Cancer Screening'}</button>
    </form>
    {result && <DiagnosticResultCard result={result} title="Breast Cancer WDBC FNA Assessment" onReset={() => setResult(null)} />}
  </div>;
}
