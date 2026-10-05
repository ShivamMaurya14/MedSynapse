import React, { useRef, useState } from 'react';
import { Activity, Upload, RefreshCw, FileText, CheckCircle2, ShieldCheck, AlertCircle, Sparkles } from 'lucide-react';
import { predictKidneyStone } from '../services/api';
import DiagnosticResultCard from './DiagnosticResultCard';

const KIDNEY_DEMOS = [
  {
    id: 'stone',
    title: 'Renal Calculi (Kidney Stone)',
    type: 'Stone',
    image: '/test_samples/kidney_stone.jpg',
    desc: 'Verified CT-Kidney dataset: Calcified calculus within the renal collecting system.',
    color: '#e11d48'
  },
  {
    id: 'cyst',
    title: 'Cortical Renal Cyst',
    type: 'Cyst',
    image: '/test_samples/kidney_cyst.jpg',
    desc: 'Verified CT-Kidney dataset: Hypoattenuating fluid-filled cortical cyst.',
    color: '#0284c7'
  },
  {
    id: 'tumor',
    title: 'Renal Cell Neoplasm (Tumor)',
    type: 'Tumor',
    image: '/test_samples/kidney_tumor.jpg',
    desc: 'Verified CT-Kidney dataset: Heterogeneous solid renal parenchymal mass.',
    color: '#7c3aed'
  },
  {
    id: 'normal',
    title: 'Healthy Renal Parenchyma (Control)',
    type: 'Normal',
    image: '/test_samples/kidney_normal.jpg',
    desc: 'Verified CT-Kidney dataset: Normal bilateral renal parenchyma without lesions.',
    color: '#16a34a'
  }
];

export default function KidneyStoneView({ setTab }) {
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
      const sampleFile = new File([blob], `${demo.id}_dataset_ct.jpg`, { type: 'image/jpeg' });
      setPreview(demo.image);
      setFile(sampleFile);

      const analysisRes = await predictKidneyStone(sampleFile);
      setResult(analysisRes);
    } catch (err) {
      setError('Failed to analyze renal CT scan: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async () => {
    if (!file) {
      setError('Please upload a renal CT scan or select a clinical preset first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await predictKidneyStone(file);
      setResult(res);
    } catch (err) {
      setError(err.message || 'Renal CT analysis failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Header Banner */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span className="badge badge-cyan" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <Activity size={13} /> Module M7 • Nephrology & Urology
          </span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            U-Net CT Backbone • 99.25% Benchmark Accuracy
          </span>
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#1b1b1b', margin: 0 }}>
          Kidney Stone & Renal Pathology Detection
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px', maxWidth: '850px', fontSize: '0.92rem' }}>
          Deep U-Net radiological classifier for automated 4-class differential screening of <strong>Nephrolithiasis (Stones)</strong>, <strong>Renal Cysts</strong>, <strong>Renal Neoplasms (Tumors)</strong>, and <strong>Healthy Renal Parenchyma</strong> from non-contrast/contrast CT slices.
        </p>
      </div>

      {/* Upload and Presets Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.2fr) minmax(300px, 0.8fr)', gap: '1.5rem' }}>
        
        {/* Upload Panel */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
              Upload Abdominal CT Slice
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 14px 0' }}>
              Accepts CT KUB, axial, and coronal slices. Standardizes image tensors to 150×150 RGB.
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
                accept="image/*,.dcm" 
                onChange={handleFileChange} 
                style={{ display: 'none' }} 
              />
              <Upload size={32} color="#64748b" style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>
                Click to browse or drop renal CT scan here
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                DICOM, PNG, or JPEG format
              </div>
            </div>

            {preview && (
              <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', background: '#f1f5f9', borderRadius: '6px' }}>
                <img src={preview} alt="Kidney CT Preview" style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '4px', background: '#000' }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {file?.name || 'Selected Renal CT Scan'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                    Status: Standardized for U-Net CNN
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
              {loading ? <RefreshCw size={16} className="animate-spin" /> : <Activity size={16} />}
              <span>{loading ? 'Evaluating Renal CT…' : 'Run 4-Class Kidney CT Screening'}</span>
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
            <Sparkles size={16} color="#0284c7" />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
              Instant Reference CT Cases
            </h3>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', margin: '0 0 12px 0' }}>
            Select verified reference CT slices for immediate 1-click classification:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {KIDNEY_DEMOS.map((demo) => {
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
                      background: demo.type.includes('Normal') ? '#f0fdf4' : '#fef2f2',
                      color: demo.type.includes('Normal') ? '#15803d' : '#b91c1c'
                    }}>
                      {demo.type.split(' ')[0]}
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
          title="Renal CT Pathology & Stone Assessment"
          onReset={() => { setResult(null); setFile(null); setPreview(null); setSelectedDemo(null); }}
        />
      )}

    </div>
  );
}
