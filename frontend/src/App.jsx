import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import DashboardHome from './components/DashboardHome';
import OCRScannerView from './components/OCRScannerView';
import DiabetesView from './components/DiabetesView';
import HeartView from './components/HeartView';
import XRayView from './components/XRayView';
import BrainTumorView from './components/BrainTumorView';
import BreastCancerView from './components/BreastCancerView';
import LiverDiseaseView from './components/LiverDiseaseView';
import KidneyStoneView from './components/KidneyStoneView';
import SkinCancerView from './components/SkinCancerView';
import EyeDiseaseView from './components/EyeDiseaseView';
import LLMReportView from './components/LLMReportView';
import DiagnosticReportView from './components/DiagnosticReportView';
import { checkHealth } from './services/api';
import { Activity } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState('home');
  const [systemStatus, setSystemStatus] = useState(null);
  const [appliedDiabetesData, setAppliedDiabetesData] = useState(null);
  const [appliedHeartData, setAppliedHeartData] = useState(null);
  const [appliedBreastData, setAppliedBreastData] = useState(null);
  const [appliedLiverData, setAppliedLiverData] = useState(null);
  const [extractedHighlights, setExtractedHighlights] = useState(null);
  const [activeReportData, setActiveReportData] = useState(null);
  const [activeDiagnosticReport, setActiveDiagnosticReport] = useState(null);

  const fetchHealth = async () => {
    const status = await checkHealth();
    setSystemStatus(status);
  };

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleApplyOCRParams = (targetDisease, params, rawExtracted) => {
    if (targetDisease === 'diabetes') {
      setAppliedDiabetesData(params);
    } else if (targetDisease === 'heart') {
      setAppliedHeartData(params);
    } else if (targetDisease === 'breast') {
      setAppliedBreastData(params);
    } else if (targetDisease === 'liver') {
      setAppliedLiverData(params);
    }
    setExtractedHighlights(rawExtracted);
  };

  const handleNavigateToLLMReport = (reportData) => {
    setActiveReportData(reportData);
    setCurrentTab('llm-report');
  };

  const handleNavigateToDiagnosticReport = (reportPackage) => {
    setActiveDiagnosticReport(reportPackage);
    setCurrentTab('diagnostic-report');
  };

  const handleNavigateToForm = (diseaseKey, inputs) => {
    let normalizedKey = (diseaseKey || '').toLowerCase();
    if (normalizedKey === 'pneumonia') normalizedKey = 'xray';
    if (normalizedKey.includes('heart') || normalizedKey.includes('cardiac')) normalizedKey = 'heart';
    if (normalizedKey.includes('diabetes')) normalizedKey = 'diabetes';
    if (normalizedKey.includes('breast')) normalizedKey = 'breast';
    if (normalizedKey.includes('liver') || normalizedKey.includes('hepatic')) normalizedKey = 'liver';
    if (normalizedKey.includes('brain')) normalizedKey = 'brain-tumor';
    if (normalizedKey.includes('kidney')) normalizedKey = 'kidney-stone';
    if (normalizedKey.includes('skin')) normalizedKey = 'skin-cancer';
    if (normalizedKey.includes('eye')) normalizedKey = 'eye';

    if (normalizedKey === 'diabetes' && inputs) {
      setAppliedDiabetesData(inputs);
    } else if (normalizedKey === 'heart' && inputs) {
      setAppliedHeartData(inputs);
    } else if (normalizedKey === 'breast' && inputs) {
      setAppliedBreastData(inputs);
    } else if (normalizedKey === 'liver' && inputs) {
      setAppliedLiverData(inputs);
    }
    const safeKey = ['home', 'ocr', 'diabetes', 'heart', 'xray', 'brain-tumor', 'breast', 'liver', 'kidney-stone', 'skin-cancer', 'eye'].includes(normalizedKey)
      ? normalizedKey
      : 'diabetes';
    setCurrentTab(safeKey);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#fcfdfd' }}>
      {/* Top Navbar with all modules */}
      <Navbar 
        currentTab={currentTab} 
        setTab={setCurrentTab} 
        systemStatus={systemStatus} 
        onRefreshStatus={fetchHealth} 
      />

      {/* Main Content Viewport */}
      <main style={{ flex: 1, maxWidth: '1240px', width: '100%', margin: '0 auto', padding: '1.75rem 1.25rem' }}>
        {currentTab === 'home' && (
          <DashboardHome setTab={setCurrentTab} />
        )}

        {currentTab === 'ocr' && (
          <OCRScannerView onApplyParams={handleApplyOCRParams} setTab={setCurrentTab} />
        )}

        {/* Dedicated Route for ML Diagnostic Assessment Report */}
        {currentTab === 'diagnostic-report' && (
          <DiagnosticReportView 
            reportData={activeDiagnosticReport} 
            setTab={setCurrentTab}
            onNavigateToLLMReport={handleNavigateToLLMReport}
            onNavigateToForm={handleNavigateToForm}
          />
        )}

        {/* Dedicated Route for LLM Synthesized Final Report */}
        {currentTab === 'llm-report' && (
          <LLMReportView 
            reportData={activeReportData} 
            setTab={setCurrentTab} 
            onNavigateToForm={handleNavigateToForm}
          />
        )}

        {/* M1: Diabetes Mellitus */}
        {currentTab === 'diabetes' && (
          <DiabetesView 
            initialData={appliedDiabetesData} 
            extractedHighlights={extractedHighlights} 
            setTab={setCurrentTab} 
            onNavigateToLLMReport={handleNavigateToLLMReport}
            onNavigateToDiagnosticReport={handleNavigateToDiagnosticReport}
          />
        )}

        {/* M2: Coronary Heart Disease */}
        {currentTab === 'heart' && (
          <HeartView 
            initialData={appliedHeartData} 
            setTab={setCurrentTab} 
            onNavigateToLLMReport={handleNavigateToLLMReport}
            onNavigateToDiagnosticReport={handleNavigateToDiagnosticReport}
          />
        )}

        {/* M3: Pneumonia (Chest X-Ray) */}
        {currentTab === 'xray' && (
          <XRayView 
            setTab={setCurrentTab}
            onNavigateToLLMReport={handleNavigateToLLMReport} 
            onNavigateToDiagnosticReport={handleNavigateToDiagnosticReport}
          />
        )}

        {/* M4: Cranial Brain Tumor (MRI) */}
        {currentTab === 'brain-tumor' && (
          <BrainTumorView 
            setTab={setCurrentTab} 
            onNavigateToLLMReport={handleNavigateToLLMReport} 
            onNavigateToDiagnosticReport={handleNavigateToDiagnosticReport}
          />
        )}

        {/* M5: Breast Cancer (WDBC FNA) */}
        {currentTab === 'breast' && (
          <BreastCancerView 
            setTab={setCurrentTab} 
            initialData={appliedBreastData} 
            onNavigateToLLMReport={handleNavigateToLLMReport} 
            onNavigateToDiagnosticReport={handleNavigateToDiagnosticReport}
          />
        )}

        {/* M6: Liver Disease (ILPD LFT) */}
        {currentTab === 'liver' && (
          <LiverDiseaseView 
            setTab={setCurrentTab} 
            initialData={appliedLiverData} 
            onNavigateToLLMReport={handleNavigateToLLMReport} 
            onNavigateToDiagnosticReport={handleNavigateToDiagnosticReport}
          />
        )}

        {/* M7: Kidney Pathology & Stones (CT) */}
        {currentTab === 'kidney-stone' && (
          <KidneyStoneView 
            setTab={setCurrentTab} 
            onNavigateToLLMReport={handleNavigateToLLMReport} 
            onNavigateToDiagnosticReport={handleNavigateToDiagnosticReport}
          />
        )}

        {/* M8: Skin Cancer (HAM10000 Dermoscopy) */}
        {currentTab === 'skin-cancer' && (
          <SkinCancerView 
            setTab={setCurrentTab} 
            onNavigateToLLMReport={handleNavigateToLLMReport} 
            onNavigateToDiagnosticReport={handleNavigateToDiagnosticReport}
          />
        )}

        {/* M9: Eye Diseases (Retinal Fundus) */}
        {currentTab === 'eye' && (
          <EyeDiseaseView 
            setTab={setCurrentTab} 
            onNavigateToLLMReport={handleNavigateToLLMReport} 
            onNavigateToDiagnosticReport={handleNavigateToDiagnosticReport}
          />
        )}

        {/* Fallback to prevent blank screen if currentTab is unrecognized */}
        {!['home', 'ocr', 'diagnostic-report', 'llm-report', 'diabetes', 'heart', 'xray', 'brain-tumor', 'breast', 'liver', 'kidney-stone', 'skin-cancer', 'eye'].includes(currentTab) && (
          <div className="animate-fade-in" style={{ padding: '3rem 1rem', textAlign: 'center' }}>
            <div className="glass-panel" style={{ maxWidth: '520px', margin: '0 auto', padding: '2rem' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>
                Redirecting to Clinical Module
              </h2>
              <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                Navigating to {currentTab || 'home'}... Choose a diagnostic module below:
              </p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={() => setCurrentTab('diabetes')} className="btn-primary" style={{ fontSize: '0.82rem', padding: '6px 14px' }}>
                  Diabetes (M1)
                </button>
                <button onClick={() => setCurrentTab('heart')} className="btn-secondary" style={{ fontSize: '0.82rem', padding: '6px 14px' }}>
                  Heart CAD (M2)
                </button>
                <button onClick={() => setCurrentTab('ocr')} className="btn-secondary" style={{ fontSize: '0.82rem', padding: '6px 14px' }}>
                  Lab OCR Scanner
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        marginTop: 'auto',
        borderTop: '1px solid #cbd5e1',
        backgroundColor: '#ffffff',
        padding: '1.5rem 1.25rem',
        color: '#64748b',
        fontSize: '0.82rem'
      }}>
        <div style={{
          maxWidth: '1240px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={16} color="#0f172a" />
            <span style={{ fontWeight: 700, color: '#0f172a' }}>MedSynapse Clinical AI Diagnostic Platform</span>
            <span>• 9 Unified Diagnostic Modules</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span>Tesseract OCR • PyTorch • Keras 3 • Scikit-Learn</span>
            <span className="badge badge-cyan" style={{ fontSize: '0.68rem' }}>ISO/IEEE CDSS Standard</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
