import React, { useRef, useState } from 'react';
import { Eye, Upload, RefreshCw, FileText, CheckCircle2, ShieldCheck, AlertCircle, Sparkles, AlertTriangle } from 'lucide-react';
import { predictSkinCancer } from '../services/api';
import DiagnosticResultCard from './DiagnosticResultCard';

const SKIN_DEMOS = [
  {
    id: 'mel',
    title: 'Cutaneous Malignant Melanoma',
    type: 'Melanoma',
    tier: 'High Risk',
    malignant: true,
    image: '/test_samples/skin_melanoma.jpg',
    desc: 'Verified HAM10000 dataset: Pigmented macule with irregular notched borders.',
    color: '#b91c1c'
  },
  {
    id: 'bcc',
    title: 'Basal Cell Carcinoma (BCC)',
    type: 'Basal Cell Carcinoma',
    tier: 'High Risk',
    malignant: true,
    image: '/test_samples/skin_basal_cell_carcinoma.jpg',
    desc: 'Verified HAM10000 dataset: Translucent papule with arborizing telangiectasias.',
    color: '#c2410c'
  },
  {
    id: 'akiec',
    title: 'Actinic Keratoses / Bowen Disease',
    type: 'Actinic Keratoses',
    tier: 'Moderate Risk',
    malignant: false,
    image: '/test_samples/skin_actinic_keratosis.jpg',
    desc: 'Verified HAM10000 dataset: Erythematous scaly plaque with follicular plugging.',
    color: '#d97706'
  },
  {
    id: 'nv',
    title: 'Benign Melanocytic Nevus',
    type: 'Melanocytic Nevus',
    tier: 'Low Risk',
    malignant: false,
    image: '/test_samples/skin_nevus.jpg',
    desc: 'Verified HAM10000 dataset: Symmetric homogeneous reticular pigment network.',
    color: '#15803d'
  }
];

export default function SkinCancerView({ setTab }) {
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
      const sampleFile = new File([blob], `${demo.id}_dataset_dermoscopy.jpg`, { type: 'image/jpeg' });
      setPreview(demo.image);
      setFile(sampleFile);

      const analysisRes = await predictSkinCancer(sampleFile);
      setResult(analysisRes);
    } catch (err) {
      setError('Dermoscopic evaluation failed: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    if (!file) {
      setError('Please upload a dermoscopic photograph or choose a reference clinical case.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await predictSkinCancer(file);
      setResult(res);
    } catch (err) {
      setError(err.message || 'Dermoscopic lesion evaluation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header Banner */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <AlertTriangle size={13} /> Module M8 • Dermatology & Cutaneous Oncology
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Deep 4-Block Hierarchical CNN • 97.98% Test Accuracy (HAM10000)
          </span>
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#1b1b1b', margin: 0 }}>
          Skin Cancer & Cutaneous Lesion Classifier
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '850px', fontSize: '0.92rem' }}>
          Automated multi-class dermoscopic screening system across 7 clinical entities including <strong>Melanoma</strong>, <strong>Basal Cell Carcinoma</strong>, <strong>Actinic Keratoses</strong>, and benign lesions.
        </p>
      </div>

      {/* Upload & Preset Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.2fr) minmax(300px, 0.8fr)', gap: '1.5rem' }}>
        
        {/* Upload Panel */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
              Upload Dermoscopic Lesion Photograph
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 14px 0' }}>
              Accepts high-resolution close-up epiluminescence and standard dermoscopic images.
            </p>

            <div 
              onClick={() => inputRef.current?.click()}
              style={{
                border: '2px dashed #cbd5e1',
                borderRadius: '8px',
                padding: '2rem 1rem',
                textAlign: 'center',
                backgroundColor: '#f8fafc',
                cursor: 'pointer'
              }}
            >
              <input 
                ref={inputRef}
                type="file" 
                accept="image/*" 
                onChange={handleFileChange} 
                style={{ display: 'none' }} 
              />
              <Upload size={32} color="#64748b" style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>
                Click to browse or drop skin lesion image here
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                JPEG or PNG dermoscopic photograph
              </div>
            </div>

            {preview && (
              <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', background: '#f1f5f9', borderRadius: '6px' }}>
                <img src={preview} alt="Lesion Preview" style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '4px' }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {file?.name || 'Selected Dermoscopic Photograph'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                    Status: Standardized for HAM10000 4-Block CNN
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

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '10px' }}>
            <button 
              className="btn-primary" 
              onClick={runAnalysis} 
              disabled={loading}
              style={{ padding: '10px 20px', background: '#0f172a' }}
            >
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <Eye size={16} />}
              <span>{loading ? 'Evaluating Cutaneous Lesion…' : 'Run 7-Class Skin Cancer Screening'}</span>
            </button>
            {result && (
              <button 
                className="btn-secondary" 
                onClick={() => { setResult(null); setFile(null); setPreview(null); setSelectedDemo(null); }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Clinical Presets */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Sparkles size={16} color="#e11d48" />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
              Instant Reference Dermoscopic Cases
            </h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '0 0 12px 0' }}>
            Select verified reference dermoscopic lesions for immediate 1-click evaluation:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {SKIN_DEMOS.map((demo) => {
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
                    cursor: 'pointer'
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
                      background: demo.malignant ? '#fef2f2' : '#f0fdf4',
                      color: demo.malignant ? '#b91c1c' : '#15803d'
                    }}>
                      {demo.tier}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.74rem', color: '#64748b', margin: '4px 0 0 0', lineHeight: 1.4 }}>
                    {demo.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Result Card */}
      {result && (
        <DiagnosticResultCard 
          result={result} 
          title="Dermoscopic Skin Cancer Assessment (HAM10000)"
          onReset={() => { setResult(null); setFile(null); setPreview(null); setSelectedDemo(null); }}
        />
      )}

    </div>
  );
}
