import React from 'react';
import { Activity, FileText, Heart, Droplets, Scan, Eye, Ribbon, RefreshCw } from 'lucide-react';

export default function Navbar({ currentTab, setTab, systemStatus, onRefreshStatus }) {
  const tabs = [
    { id: 'home', label: 'Dashboard Hub', icon: Activity, color: '#25854a' },
    { id: 'ocr', label: 'Smart Report OCR', icon: FileText, highlight: true, color: '#25854a' },
    { id: 'diabetes', label: 'Diabetes Engine', icon: Droplets, color: '#b42318' },
    { id: 'heart', label: 'Cardiac Health', icon: Heart, color: '#c81e1e' },
    { id: 'xray', label: 'Pneumonia X-Ray', icon: Scan, color: '#287a89' },
    { id: 'eye', label: 'Eye Disease', icon: Eye, color: '#6b46c1' },
    { id: 'breast', label: 'Breast Cancer', icon: Ribbon, color: '#b83280' },
  ];

  const isOnline = systemStatus?.status === 'online';

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      backgroundColor: 'rgba(255, 255, 255, 0.96)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid #d7e7db',
      padding: '0.75rem 1.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '1rem',
      flexWrap: 'wrap'
    }}>
      {/* Brand Logo */}
      <div 
        onClick={() => setTab('home')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '12px',
          background: '#25854a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(37, 133, 74, 0.18)'
        }}>
          <Activity size={24} color="#ffffff" strokeWidth={2.5} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
              Med<span style={{ color: '#25854a' }}>Synapse</span>
            </span>
            <span className="badge badge-cyan" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>v2.0 AI</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Multi-Disease Diagnostics & OCR</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = currentTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 14px',
                borderRadius: '10px',
                fontSize: '0.875rem',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#1e6f3d' : 'var(--text-secondary)',
                backgroundColor: isActive ? '#e6f4e9' : 'transparent',
                border: isActive ? '1px solid #a7cfb0' : '1px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isActive ? '0 2px 8px rgba(37, 133, 74, 0.10)' : 'none'
              }}
            >
              <Icon size={16} color={t.color || 'var(--text-muted)'} />
              {t.label}
              {t.highlight && (
                <span style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: '#25854a',
                  boxShadow: '0 0 6px rgba(37, 133, 74, 0.35)'
                }} />
              )}
            </button>
          );
        })}
      </nav>

      {/* System Status Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div 
          onClick={onRefreshStatus}
          title="Click to refresh system status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '9999px',
            backgroundColor: isOnline ? 'rgba(16, 185, 129, 0.1)' : 'rgba(244, 63, 94, 0.1)',
            border: `1px solid ${isOnline ? 'rgba(16, 185, 129, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`,
            fontSize: '0.75rem',
            fontWeight: 600,
            color: isOnline ? '#34d399' : '#fda4af',
            cursor: 'pointer'
          }}
        >
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isOnline ? '#10b981' : '#f43f5e',
            boxShadow: isOnline ? '0 0 8px #10b981' : '0 0 8px #f43f5e',
            display: 'inline-block'
          }} />
          <span>{isOnline ? 'AI Models Active' : 'Connecting to API...'}</span>
          <RefreshCw size={12} style={{ marginLeft: '4px', opacity: 0.7 }} />
        </div>
      </div>
    </header>
  );
}
