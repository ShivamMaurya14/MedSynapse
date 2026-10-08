import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import DashboardHome from './components/DashboardHome';
import OCRScannerView from './components/OCRScannerView';
import DiabetesView from './components/DiabetesView';
import HeartView from './components/HeartView';
import XRayView from './components/XRayView';
import ImageModelView from './components/ImageModelView';
import BreastCancerView from './components/BreastCancerView';
import { checkHealth, predictEye } from './services/api';
import { Activity } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState('home');
  const [systemStatus, setSystemStatus] = useState(null);
  const [appliedDiabetesData, setAppliedDiabetesData] = useState(null);
  const [appliedHeartData, setAppliedHeartData] = useState(null);
  const [appliedBreastData, setAppliedBreastData] = useState(null);
  const [extractedHighlights, setExtractedHighlights] = useState(null);

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
    }
    setExtractedHighlights(rawExtracted);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <Navbar 
        currentTab={currentTab} 
        setTab={setCurrentTab} 
        systemStatus={systemStatus} 
        onRefreshStatus={fetchHealth} 
      />

      {/* Main Content Viewport */}
      <main style={{ flex: 1, maxWidth: '1240px', width: '100%', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {currentTab === 'home' && (
          <DashboardHome setTab={setCurrentTab} />
        )}

        {currentTab === 'ocr' && (
          <OCRScannerView onApplyParams={handleApplyOCRParams} setTab={setCurrentTab} />
        )}

        {currentTab === 'diabetes' && (
          <DiabetesView 
            initialData={appliedDiabetesData} 
            extractedHighlights={extractedHighlights} 
            setTab={setCurrentTab} 
          />
        )}

        {currentTab === 'heart' && (
          <HeartView 
            initialData={appliedHeartData} 
            setTab={setCurrentTab} 
          />
        )}

        {currentTab === 'xray' && (
          <XRayView />
        )}

        {currentTab === 'eye' && <ImageModelView kind="eye" onPredict={predictEye} />}

        {currentTab === 'breast' && <BreastCancerView setTab={setCurrentTab} initialData={appliedBreastData} />}
      </main>

      {/* Footer */}
      <footer style={{
        marginTop: 'auto',
        borderTop: '1px solid #d7e7db',
        backgroundColor: '#ffffff',
        padding: '2rem 1.5rem',
        color: 'var(--text-muted)',
        fontSize: '0.85rem'
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
            <Activity size={18} color="#25854a" />
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>MedSynapse Clinical Diagnostic System</span>
            <span>• Developed by Team MedSynapse (Shivam Maurya)</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span>Tesseract OCR + Keras 3 + Scikit-Learn</span>
            <span className="badge badge-cyan" style={{ fontSize: '0.7rem' }}>AI Diagnostics Suite</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
