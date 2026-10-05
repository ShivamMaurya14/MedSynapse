import React, { useRef, useState } from 'react';
import { Brain, Upload, RefreshCw, FileText, CheckCircle2, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';
import { predictBrainTumor } from '../services/api';
import DiagnosticResultCard from './DiagnosticResultCard';

const DEMO_CASES = [
  {
    id: 'glioma',
    title: 'Glioma MRI (Intra-Axial)',
    type: 'Glioma',
    image: '/test_samples/brain_glioma.jpg',
    description: 'Verified Nickparvar dataset: Left frontal lobe infiltrative hyperintense mass.',
    color: '#8b5cf6'
  },
  {
    id: 'meningioma',
    title: 'Meningioma MRI (Dural Tail)',
    type: 'Meningioma',
    image: '/test_samples/brain_meningioma.jpg',
    description: 'Verified Nickparvar dataset: Extra-axial parasagittal dural-based enhancing mass.',
    color: '#ec4899'
  },
  {
    id: 'pituitary',
    title: 'Pituitary Adenoma MRI',
    type: 'Pituitary Adenoma',
    image: '/test_samples/brain_pituitary.jpg',
    description: 'Verified Nickparvar dataset: Sellar/suprasellar mass lesion.',
    color: '#f59e0b'
  },
  {
    id: 'healthy',
    title: 'Normal Cranial MRI (Control)',
    type: 'No Tumor',
    image: '/test_samples/brain_notumor.jpg',
    description: 'Verified Nickparvar dataset: Unremarkable cerebral parenchyma without focal mass lesion.',
    color: '#10b981'
  }
];

export default function BrainTumorView({ setTab }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [selectedDemo, setSelectedDemo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setSelectedDemo(null);
    setResult(null);
    setError(null);
  };

  const handleSelectDemo = async (demo) => {
    setSelectedDemo(demo);
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch(demo.image);
      if (!res.ok) throw new Error(`HTTP ${res.status} loading ${demo.image}`);
      const blob = await res.blob();
      const sampleFile = new File([blob], `${demo.id}_dataset_mri.jpg`, { type: 'image/jpeg' });
      setPreview(demo.image);
      setFile(sampleFile);
      
      const analysisRes = await predictBrainTumor(sampleFile);
      setResult(analysisRes);
    } catch (err) {
      setError('Brain tumor analysis failed: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    if (!file) {
      setError('Please upload a cranial MRI scan or select a clinical preset first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await predictBrainTumor(file);
      setResult(res);
    } catch (err) {
      setError(err.message || 'Brain tumor analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span className="badge badge-purple" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <Brain size={13} /> Module M4 • Neuro-Oncology
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Xception Deep CNN • 95.25% Test Accuracy
          </span>
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#1b1b1b', margin: 0 }}>
          Cranial Brain Tumor Classification
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '850px', fontSize: '0.92rem' }}>
          High-resolution 4-class intracranial neoplasm classifier distinguishing <strong>Glioma</strong>, <strong>Meningioma</strong>, <strong>Pituitary Adenoma</strong>, and <strong>Healthy Brain Tissue</strong> from axial/sagittal/coronal MRI slices.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.2fr) minmax(300px, 0.8fr)', gap: '1.5rem' }}>
        
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
              Upload Cranial MRI Scan
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 14px 0' }}>
              Supports DICOM, JPEG, and PNG images. Standard input shape is automatically standardized to 299×299 RGB float32 tensors.
            </p>

            <div 
              onClick={() => inputRef.current?.click()}
              style={{
                border: '2px dashed #cbd5e1',
                borderRadius: '8px',
                padding: '2rem 1rem',
                textAlign: 'center',
                backgroundColor: '#f8fafc',
                cursor: 'pointer',
                transition: 'border-color 0.2s ease'
              }}
            >
              <input 
                ref={inputRef}
                type="file" 
                accept="image/*,.dcm" 
                onChange={handleFileChange} 
                style={{ display: 'none' }} 
              />
              <Upload size={32} color="#64748b" style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>
                Click to browse or drop cranial MRI scan here
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                Axial, Coronal, or Sagittal T1-CE / T2 / FLAIR sequences
              </div>
            </div>

            {preview && (
              <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', background: '#f1f5f9', borderRadius: '6px' }}>
                <img src={preview} alt="MRI Scan Preview" style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '4px', background: '#000' }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {file?.name || 'Selected Cranial MRI Scan'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                    Status: Ready for Xception CNN inference
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div style={{ marginTop: '12px', padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button 
              className="btn-primary" 
              onClick={runAnalysis} 
              disabled={loading}
              style={{ padding: '10px 20px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px', background: '#0f172a' }}
            >
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <Brain size={16} />}
              <span>{loading ? 'Evaluating Cranial MRI…' : 'Run 4-Class Brain Tumor Screening'}</span>
            </button>
            {result && (
              <button 
                className="btn-secondary" 
                onClick={() => { setResult(null); setFile(null); setPreview(null); setSelectedDemo(null); }}
                style={{ padding: '10px 14px', fontSize: '0.85rem' }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Sparkles size={16} color="#8b5cf6" />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
              Instant Clinical Preset Cases
            </h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '0 0 12px 0' }}>
            Select verified reference MRI cases for immediate 1-click evaluation:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {DEMO_CASES.map((demo) => {
              const isSelected = selectedDemo?.id === demo.id;
              return (
                <div
                  key={demo.id}
                  onClick={() => handleSelectDemo(demo)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    background: isSelected ? '#f8fafc' : '#ffffff',
                    border: isSelected ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a' }}>
                      {demo.title}
                    </span>
                    <span style={{
                      fontSize: '0.68rem',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: demo.type === 'No Tumor' ? '#f0fdf4' : '#fef2f2',
                      color: demo.type === 'No Tumor' ? '#15803d' : '#b91c1c'
                    }}>
                      {demo.type}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                    {demo.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {result && (
        <DiagnosticResultCard 
          result={result} 
          title="Cranial MRI Brain Tumor Assessment"
          onReset={() => { setResult(null); setFile(null); setPreview(null); setSelectedDemo(null); }}
        />
      )}

    </div>
  );
}
