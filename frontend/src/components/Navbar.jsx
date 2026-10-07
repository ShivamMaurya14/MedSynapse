import React from 'react';
import { 
  Activity, 
  RefreshCw, 
  Home, 
  FileText, 
  Droplets, 
  Heart, 
  Scan, 
  Brain, 
  Ribbon, 
  FlaskConical, 
  Layers, 
  AlertTriangle, 
  Eye
} from 'lucide-react';

const NAV_MODULES = [
  { id: 'home', label: 'Dashboard', short: 'Home', icon: Home, color: '#0f172a' },
  { id: 'ocr', label: 'Lab OCR Scanner', short: 'Lab OCR', icon: FileText, color: '#0284c7' },
  { id: 'diabetes', label: 'Diabetes (M1)', short: 'Diabetes', icon: Droplets, color: '#b42318' },
  { id: 'heart', label: 'Heart CAD (M2)', short: 'Heart CAD', icon: Heart, color: '#c81e1e' },
  { id: 'xray', label: 'Chest X-Ray (M3)', short: 'X-Ray', icon: Scan, color: '#0284c7' },
  { id: 'brain-tumor', label: 'Brain MRI (M4)', short: 'Brain MRI', icon: Brain, color: '#7c3aed' },
  { id: 'breast', label: 'Breast FNA (M5)', short: 'Breast FNA', icon: Ribbon, color: '#b83280' },
  { id: 'liver', label: 'Liver LFT (M6)', short: 'Liver LFT', icon: FlaskConical, color: '#d97706' },
  { id: 'kidney-stone', label: 'Kidney CT (M7)', short: 'Kidney CT', icon: Layers, color: '#059669' },
  { id: 'skin-cancer', label: 'Skin Cancer (M8)', short: 'Skin Cancer', icon: AlertTriangle, color: '#dc2626' },
  { id: 'eye', label: 'Eye Ophthalmic (M9)', short: 'Eye Disease', icon: Eye, color: '#6b46c1' },
];

export default function Navbar({ currentTab, setTab, systemStatus, onRefreshStatus }) {
  const isOnline = systemStatus?.status === 'online';

  return (
    <header style={{
      position: 'sticky',
      top: 0,
      zIndex: 50,
      backgroundColor: 'rgba(255, 255, 255, 0.98)',
      backdropFilter: 'blur(16px)',
      borderBottom: '1px solid #cbd5e1',
      boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)'
    }}>
      {/* Tier 1: Brand & Top Status */}
      <div style={{
        padding: '0.65rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #f1f5f9'
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
            borderRadius: '11px',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 3px 10px rgba(16, 185, 129, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            flexShrink: 0
          }}>
            <Activity size={24} color="#10b981" strokeWidth={2.8} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ 
                fontSize: '1.45rem', 
                fontWeight: 900, 
                letterSpacing: '-0.5px', 
                color: '#0f172a',
                lineHeight: 1.15
              }}>
                Med<span style={{ 
                  background: 'linear-gradient(135deg, #15803d 0%, #059669 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  color: '#16a34a'
                }}>Synapse</span>
              </span>
              <span 
                style={{ 
                  fontSize: '0.65rem', 
                  fontWeight: 800, 
                  letterSpacing: '0.5px',
                  padding: '2px 7px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  color: '#15803d',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  textTransform: 'uppercase'
                }}
              >
                9 Direct Modules
              </span>
            </div>
            <p style={{ 
              fontSize: '0.74rem', 
              fontWeight: 500,
              color: '#64748b', 
              letterSpacing: '0.1px',
              margin: '1px 0 0 0'
            }}>
              Clinical AI Multi-Modal Diagnostic & Decision Suite
            </p>
          </div>
        </div>

        {/* Right Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
              border: isOnline ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(244, 63, 94, 0.3)',
              fontSize: '0.74rem',
              fontWeight: 600,
              color: isOnline ? '#15803d' : '#b91c1c',
              cursor: 'pointer'
            }}
          >
            <span style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: isOnline ? '#10b981' : '#f43f5e',
              display: 'inline-block',
              boxShadow: isOnline ? '0 0 6px #10b981' : '0 0 6px #f43f5e'
            }} />
            <span>{isOnline ? '9 Models Online' : 'Connecting…'}</span>
            <RefreshCw size={11} style={{ opacity: 0.75 }} />
          </div>
        </div>
      </div>

      {/* Tier 2: Dedicated Direct Analysis Navigation Strip */}
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 1.25rem',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
        backgroundColor: '#f8fafc',
        borderTop: '1px solid #f1f5f9'
      }}>
        {NAV_MODULES.map((item) => {
          const active = currentTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              type="button"
              className={`nav-tab-btn ${active ? 'active' : ''}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                padding: '6px 13px',
                borderRadius: '8px',
                border: active ? '1.5px solid #047857' : '1px solid #e2e8f0',
                background: active ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : '#ffffff',
                backgroundColor: active ? '#059669' : '#ffffff',
                color: active ? '#ffffff' : '#334155',
                fontSize: '0.79rem',
                fontWeight: active ? 700 : 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: active ? '0 3px 12px rgba(5, 150, 105, 0.35)' : '0 1px 2px rgba(0, 0, 0, 0.04)',
                flexShrink: 0
              }}
            >
              <Icon 
                size={14} 
                color={active ? '#ffffff' : item.color} 
                stroke={active ? '#ffffff' : item.color}
                strokeWidth={active ? 2.5 : 2}
              />
              <span 
                className="nav-tab-text"
                style={{
                  color: active ? '#ffffff' : '#334155',
                  fontWeight: active ? 700 : 600,
                  letterSpacing: '-0.1px'
                }}
              >
                {item.label}
              </span>
              {active && (
                <span 
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#ffffff',
                    boxShadow: '0 0 6px rgba(255, 255, 255, 0.9)',
                    display: 'inline-block',
                    marginLeft: '2px'
                  }} 
                />
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
