import React, { useState, useEffect, useRef } from 'react';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Play,
  RefreshCw,
  FileCode,
  Check,
  Database,
  ShieldCheck,
  Cpu,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Heart,
  Scan,
  Brain,
  Ribbon,
  Activity,
  Layers,
  AlertTriangle,
  Eye
} from 'lucide-react';
import { parseReportOCR, getSampleReports } from '../services/api';
import OCRProgressModal from './OCRProgressModal';

const REPORT_MODULES = [
  { 
    id: 'all', 
    title: 'All Report Modules', 
    description: 'Universal multi-biomarker extraction across all compatible panels.', 
    tag: 'Full Multi-Disease Suite',
    icon: Sparkles,
    color: '#0284c7'
  },
  { 
    id: 'diabetes', 
    title: 'Diabetes Mellitus', 
    description: 'Glucose, Insulin, BMI, Blood Pressure, Skin Thickness, Age.', 
    tag: 'Metabolic / ML',
    icon: Droplets,
    color: '#b42318',
    tabId: 'diabetes'
  },
  { 
    id: 'heart', 
    title: 'Cardiac Health', 
    description: 'Resting BP, Serum Chol, Max HR, ST depression, Vessels.', 
    tag: 'Cardiology / ML',
    icon: Heart,
    color: '#c81e1e',
    tabId: 'heart'
  },
  { 
    id: 'xray', 
    title: 'Pneumonia (X-Ray)', 
    description: 'Pulmonary infiltration, consolidation & radiograph patterns.', 
    tag: 'Pulmonology / Vision',
    icon: Scan,
    color: '#287a89',
    tabId: 'xray',
    isVision: true
  },
  { 
    id: 'brain-tumor', 
    title: 'Brain Tumor (MRI)', 
    description: 'Cranial MRI 4-class neoplasm tissue classification.', 
    tag: 'Neuro-Oncology / Vision',
    icon: Brain,
    color: '#7c3aed',
    tabId: 'brain-tumor',
    isVision: true
  },
  { 
    id: 'breast', 
    title: 'Breast Cancer (FNA)', 
    description: '30 labelled WDBC fine-needle aspirate cytology features.', 
    tag: 'Oncology / ML',
    icon: Ribbon,
    color: '#b83280',
    tabId: 'breast'
  },
  { 
    id: 'liver', 
    title: 'Liver Disease (LFT)', 
    description: 'Bilirubin, SGOT/AST, SGPT/ALT, AlkPhos, Albumin/Globulin.', 
    tag: 'Hepatology / ML',
    icon: Activity,
    color: '#d97706',
    tabId: 'liver'
  },
  { 
    id: 'kidney-stone', 
    title: 'Kidney Pathology (CT)', 
    description: 'Renal calculi, cyst, tumor & normal tomography slices.', 
    tag: 'Nephrology / Vision',
    icon: Layers,
    color: '#0284c7',
    tabId: 'kidney-stone',
    isVision: true
  },
  { 
    id: 'skin-cancer', 
    title: 'Skin Cancer (HAM10000)', 
    description: '7-class dermoscopy pigmented lesion classification.', 
    tag: 'Dermatology / Vision',
    icon: AlertTriangle,
    color: '#dc2626',
    tabId: 'skin-cancer',
    isVision: true
  },
  { 
    id: 'eye', 
    title: 'Eye Diseases (Fundus)', 
    description: 'Fundus photography for DR, Glaucoma & Cataract.', 
    tag: 'Ophthalmology / Vision',
    icon: Eye,
    color: '#6b46c1',
    tabId: 'eye',
    isVision: true
  },
];

export default function OCRScannerView({ onApplyParams, setTab }) {
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [ocrResult, setOcrResult] = useState(null);
  const [sampleReports, setSampleReports] = useState([]);
  const [selectedSampleId, setSelectedSampleId] = useState('');
  const [selectedModule, setSelectedModule] = useState('all');

  // OCR Modal progress states
  const [ocrModalOpen, setOcrModalOpen] = useState(false);
  const [ocrStage, setOcrStage] = useState('upload_reading');
  const [ocrModalError, setOcrModalError] = useState(null);
  const timeoutsRef = useRef([]);
  const modulesScrollRef = useRef(null);

  const scrollModules = (direction) => {
    if (modulesScrollRef.current) {
      modulesScrollRef.current.scrollBy({
        left: direction === 'left' ? -280 : 280,
        behavior: 'smooth'
      });
    }
  };

  const clearProgressTimeouts = () => {
    timeoutsRef.current.forEach(t => clearTimeout(t));
    timeoutsRef.current = [];
  };

  useEffect(() => {
    return () => clearProgressTimeouts();
  }, []);

  // Load sample clinical reports on mount
  useEffect(() => {
    getSampleReports()
      .then(data => setSampleReports(data))
      .catch(err => console.error('Could not load samples', err));
  }, []);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setSelectedSampleId('');
      if (selectedFile.type.startsWith('image/')) {
        setFilePreview(URL.createObjectURL(selectedFile));
      } else {
        setFilePreview(null);
      }
    }
  };

  const handleLoadSample = (sample) => {
    setSelectedSampleId(sample.id);
    setFile(null);
    setFilePreview(null);
    setRawText(sample.sample_text);
    handleProcessOCR(null, sample.sample_text);
  };

  const handleProcessOCR = async (uploadFile = file, textInput = rawText) => {
    if (!uploadFile && !textInput.trim()) {
      setError('Please choose a file or select a sample report.');
      return;
    }

    setLoading(true);
    setError(null);
    setOcrModalError(null);
    setOcrStage('upload_reading');
    setOcrModalOpen(true);
    clearProgressTimeouts();

    // Stage 1 -> 2 transition at ~1.5s
    const t1 = setTimeout(() => {
      setOcrStage('ocr_extraction');
    }, 1500);

    // Stage 2 -> 3 (Gemma) transition at ~4.5s
    const t2 = setTimeout(() => {
      setOcrStage('gemma_extraction');
    }, 4500);

    timeoutsRef.current = [t1, t2];

    try {
      const res = await parseReportOCR({
        file: uploadFile,
        rawText: uploadFile ? '' : textInput,
        diseaseType: selectedModule,
      });
      clearProgressTimeouts();
      setOcrStage('feature_store_saving');

      setTimeout(() => {
        setOcrResult(res);
        setOcrStage('complete');
      }, 500);
    } catch (err) {
      clearProgressTimeouts();
      const message = err.message || 'Failed to process document OCR';
      setError(message);
      setOcrModalError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleTransferToPredictor = (targetDisease) => {
    if (targetDisease === 'breast') {
      const breastFeatures = ocrResult?.gemma_breast_cancer?.model_features;
      if (breastFeatures) {
        onApplyParams('breast', breastFeatures, ocrResult.parameters);
        setTab('breast');
      }
      return;
    }
    if (!ocrResult?.ready_inputs) return;
    const params = ocrResult.ready_inputs[targetDisease];
    if (params) {
      onApplyParams(targetDisease, params, ocrResult.parameters);
      setTab(targetDisease);
    }
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <OCRProgressModal
        isOpen={ocrModalOpen}
        stage={ocrStage}
        error={ocrModalError}
        onClose={() => setOcrModalOpen(false)}
        diseaseType={selectedModule}
        filename={file?.name || (selectedSampleId ? `Sample: ${selectedSampleId}` : 'Clinical Text Input')}
      />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-cyan">Universal Feature Extraction Hub</span>
            <span className="badge badge-success">Tesseract 5.0 + Gemma 3:4B + SQLite</span>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#ffffff', marginTop: '6px' }}>
            Clinical Feature Extraction & Database Store
          </h1>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Upload clinical reports (PDF or Images) or input lab text. MedSynapse extracts all clinical biomarkers, performs Gemma 3:4B neural extraction, and persists validated feature records into the local SQLite feature store.
          </p>
        </div>
      </div>

      {/* Preset Sample Reports Banner for Instant Testing */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
          <Sparkles size={16} color="#38bdf8" />
          <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#ffffff' }}>
            Quick Start: Load Pre-Built Clinical Lab Panels
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
          {sampleReports.map((s) => (
            <button
              key={s.id}
              onClick={() => handleLoadSample(s)}
              className="btn-secondary"
              style={{
                justifyContent: 'flex-start',
                textAlign: 'left',
                padding: '10px 14px',
                border: selectedSampleId === s.id ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                backgroundColor: selectedSampleId === s.id ? '#e6f4e9' : '#ffffff'
              }}
            >
              <FileText size={16} color="#38bdf8" style={{ flexShrink: 0 }} />
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {s.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {s.patient}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Feature-extraction target selector */}
      <section className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1rem', fontWeight: 700 }}>Select Report-Analysis Module</h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              Select one specialized module, or run all report-compatible models from the same document.
            </p>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge badge-cyan" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>10 Modules • Horizontal Scroll</span>
            <button
              type="button"
              onClick={() => scrollModules('left')}
              title="Scroll left"
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <ChevronLeft size={16} color="#334155" />
            </button>
            <button
              type="button"
              onClick={() => scrollModules('right')}
              title="Scroll right"
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              <ChevronRight size={16} color="#334155" />
            </button>
          </div>
        </div>

        {/* Scrollable Modules Track */}
        <div 
          ref={modulesScrollRef}
          style={{ 
            display: 'flex', 
            gap: '0.85rem', 
            overflowX: 'auto',
            paddingBottom: '0.85rem',
            paddingTop: '0.2rem',
            scrollSnapType: 'x mandatory',
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'thin',
            scrollbarColor: '#94a3b8 #f1f5f9'
          }}
        >
          {REPORT_MODULES.map(module => {
            const selected = selectedModule === module.id;
            const Icon = module.icon || Sparkles;
            return (
              <div
                key={module.id}
                onClick={() => {
                  setSelectedModule(module.id);
                  setOcrResult(null);
                  setError(null);
                }}
                style={{
                  flex: '0 0 250px',
                  scrollSnapAlign: 'start',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '118px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: selected ? '2px solid #0284c7' : '1px solid #e2e8f0',
                  backgroundColor: selected ? '#f0f9ff' : '#ffffff',
                  boxShadow: selected ? '0 4px 12px rgba(2, 132, 199, 0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  userSelect: 'none'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '6px',
                        backgroundColor: selected ? '#0284c7' : '#f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Icon size={14} color={selected ? '#ffffff' : (module.color || '#475569')} />
                      </div>
                      <span style={{ fontSize: '0.64rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: module.color || '#64748b' }}>
                        {module.tag}
                      </span>
                    </div>
                    {selected && (
                      <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#0284c7', backgroundColor: '#e0f2fe', padding: '1px 5px', borderRadius: '4px' }}>
                        SELECTED
                      </span>
                    )}
                  </div>

                  <strong style={{ display: 'block', color: '#0f172a', fontSize: '0.86rem', fontWeight: 700, marginBottom: '4px' }}>
                    {module.title}
                  </strong>
                  <span style={{ display: 'block', color: '#64748b', fontSize: '0.74rem', lineHeight: '1.35' }}>
                    {module.description}
                  </span>
                </div>

                {module.tabId && (
                  <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.68rem', color: '#64748b' }}>{module.isVision ? 'Vision Imaging' : 'Direct Analysis'}</span>
                    {setTab && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTab(module.tabId);
                        }}
                        style={{
                          fontSize: '0.72rem',
                          color: '#0f172a',
                          fontWeight: 700,
                          backgroundColor: '#f1f5f9',
                          border: '1px solid #cbd5e1',
                          borderRadius: '5px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '3px 7px'
                        }}
                      >
                        <span>⚡ Direct Analysis & Presets</span>
                        <ArrowRight size={11} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p style={{ margin: '0.9rem 0 0', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          Pneumonia, cranial brain MRI, renal CT, skin dermoscopy, and retinal fundus models require high-resolution scans; use their dedicated upload modules or click <strong>Direct Scan →</strong> above for dedicated imaging inference.
        </p>
      </section>

      {/* Upload Zone & Manual Text Entry */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.5rem'
      }}>
        {/* Upload Card */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Upload size={18} color="#38bdf8" /> Upload Document (PDF / JPG / PNG)
          </h3>

          <label 
            style={{
              border: '2px dashed rgba(56, 189, 248, 0.4)',
              borderRadius: '12px',
              padding: '2rem 1.5rem',
              textAlign: 'center',
              backgroundColor: 'rgba(14, 165, 233, 0.04)',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.75rem',
              transition: 'all 0.2s ease'
            }}
          >
            <input 
              type="file" 
              accept=".pdf,.png,.jpg,.jpeg,.webp" 
              onChange={handleFileChange} 
              style={{ display: 'none' }} 
            />
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: 'rgba(14, 165, 233, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Upload size={22} color="#38bdf8" />
            </div>
            <div>
              <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#ffffff' }}>
                {file ? file.name : 'Click to Browse or Drag & Drop'}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Supports lab blood panels, metabolic tests, ECG readouts (Max 25MB)
              </p>
            </div>
          </label>

          {filePreview && (
            <div style={{ marginTop: '0.5rem', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.1)', maxHeight: '200px' }}>
              <img src={filePreview} alt="Report Preview" style={{ width: '100%', objectFit: 'contain', maxHeight: '200px' }} />
            </div>
          )}

          <button 
            onClick={() => handleProcessOCR(file, rawText)} 
            disabled={loading || (!file && !rawText.trim())}
            className="btn-primary"
            style={{ width: '100%', marginTop: 'auto' }}
          >
            {loading ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Running Universal Feature Extraction...</span>
              </>
            ) : (
              <>
                <Play size={16} />
                <span>Extract Features & Save to Database</span>
              </>
            )}
          </button>
        </div>

        {/* Text Input / Raw Text Editor */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileCode size={18} color="#a855f7" /> Document Text / OCR Output
            </h3>
            {rawText && (
              <button 
                onClick={() => setRawText('')} 
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer' }}
              >
                Clear
              </button>
            )}
          </div>

          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste clinical text, doctor notes, or lab printout here to parse parameters directly..."
            rows={9}
            className="form-input"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              lineHeight: 1.5,
              resize: 'vertical',
              flex: 1
            }}
          />

          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            💡 <em>Tip: The parser automatically identifies Glucose, Blood Pressure, BMI, Insulin, Cholesterol, Heart Rate, ECG, and Age across all diagnostic modalities.</em>
          </div>
        </div>
      </div>

      {/* Error Display */}
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

      {/* Extracted Parameters Results Section */}
      {ocrResult && (
        <div className="glass-panel glass-panel-glow animate-fade-in" style={{ padding: '1.75rem' }}>
          
          {/* Database Persistence & Feature Store Status Banner */}
          <div style={{
            marginBottom: '1.5rem',
            padding: '1.1rem 1.25rem',
            borderRadius: '12px',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={18} color="#16a34a" />
                <strong style={{ color: '#166534', fontSize: '0.92rem' }}>
                  Features Persisted to SQLite Feature Store (`data/medsynapse.db`)
                </strong>
              </div>
              <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                <ShieldCheck size={12} /> Immutable Audit Ledger
              </span>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.78rem', color: '#1e3a2b', marginTop: '2px' }}>
              {ocrResult.feature_extraction_id && (
                <div>
                  <strong>Diabetes Feature Extraction ID:</strong>{' '}
                  <code style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>
                    {ocrResult.feature_extraction_id}
                  </code>
                </div>
              )}
              {ocrResult.heart_feature_extraction_id && (
                <div>
                  <strong>Heart Feature Extraction ID:</strong>{' '}
                  <code style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>
                    {ocrResult.heart_feature_extraction_id}
                  </code>
                </div>
              )}
              {ocrResult.breast_feature_extraction_id && (
                <div>
                  <strong>Breast Feature Extraction ID:</strong>{' '}
                  <code style={{ background: '#dcfce7', padding: '2px 6px', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>
                    {ocrResult.breast_feature_extraction_id}
                  </code>
                </div>
              )}
            </div>
          </div>

          {/* JEV Evidence Suitability Scoring */}
          {Array.isArray(ocrResult.jev_scoring) && (
            <div style={{ marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border-card)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.35rem' }}>
                <span className="badge badge-purple">JEV Evidence Suitability</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Routing signal based on extracted biomarker completeness</span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '0.9rem' }}>
                Scores indicate completeness and clinical suitability of extracted features for each downstream prediction model:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                {ocrResult.jev_scoring.map(score => (
                  <div key={score.disease} style={{ padding: '0.9rem', border: '1px solid var(--border-card)', borderRadius: '10px', background: '#f5faf6' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                      <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{score.disease}</strong>
                      <span className={`badge ${score.status === 'ready_for_routing' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.62rem' }}>
                        {score.confidence_percentage}%
                      </span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                      {score.status === 'ready_for_routing' ? 'Evidence complete for routing' : `Missing: ${score.missing_features.join(', ')}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extracted Parameters Header & Transfer Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge badge-success">
                  <CheckCircle2 size={13} /> {ocrResult.extracted_count} Biomarkers Identified
                </span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Scanned {ocrResult.line_count} document lines
                </span>
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', marginTop: '4px' }}>
                Extracted Clinical Parameters
              </h2>
            </div>

            {/* Quick Actions to Send to Models */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button 
                onClick={() => handleTransferToPredictor('diabetes')}
                className="btn-accent"
                style={{ background: 'linear-gradient(135deg, #e11d48, #f43f5e)', padding: '10px 18px' }}
              >
                <span>Apply to Diabetes Predictor</span>
                <ArrowRight size={16} />
              </button>

              <button 
                onClick={() => handleTransferToPredictor('heart')}
                className="btn-primary"
                style={{ padding: '10px 18px' }}
              >
                <span>Apply to Cardiac Predictor</span>
                <ArrowRight size={16} />
              </button>

              <button
                onClick={() => handleTransferToPredictor('breast')}
                disabled={ocrResult.gemma_breast_cancer?.status !== 'ready_for_inference'}
                className="btn-primary"
                style={{ padding: '10px 18px' }}
                title={ocrResult.gemma_breast_cancer?.status !== 'ready_for_inference' ? 'All 30 explicitly labelled WDBC FNA features are required before screening.' : ''}
              >
                <span>Apply to Breast Predictor</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>

          {/* Grid of Extracted Parameter Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            marginTop: '1.5rem'
          }}>
            {Object.entries(ocrResult.parameters || {}).map(([key, item]) => (
              <div
                key={key}
                style={{
                  padding: '14px',
                  backgroundColor: '#f5faf6',
                  borderRadius: '12px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    {key.replace('_', ' ')}
                  </span>
                  <span className="badge badge-cyan" style={{ fontSize: '0.65rem' }}>
                    {(item.confidence * 100).toFixed(0)}% Conf
                  </span>
                </div>

                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff', fontFamily: 'var(--font-mono)' }}>
                  {item.display || item.value} <span style={{ fontSize: '0.85rem', color: '#38bdf8', fontWeight: 500 }}>{item.unit || ''}</span>
                </div>

                {item.normal_range && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Standard Ref: <strong style={{ color: 'var(--text-secondary)' }}>{item.normal_range}</strong>
                  </div>
                )}

                {(item.clinical_status || item.status) && (
                  <div>
                    <span className={`badge ${(item.clinical_status || item.status).includes('Normal') || (item.clinical_status || item.status).includes('Desirable') ? 'badge-success' : 'badge-danger'}`} style={{ fontSize: '0.65rem' }}>
                      {item.clinical_status || item.status}
                    </span>
                  </div>
                )}

                {item.matched_text && (
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', backgroundColor: '#eef7f0', padding: '4px 6px', borderRadius: '4px', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Match: "{item.matched_text}"
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
