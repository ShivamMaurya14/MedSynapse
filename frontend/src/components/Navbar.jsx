import React from 'react';
import { 
  Activity, 
  RefreshCw, 
  Home
} from 'lucide-react';

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
      {/* Brand & Top Status Bar */}
      <div style={{
        padding: '0.75rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Brand Logo */}
        <div 
          onClick={() => {
            setTab('home');
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
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

        {/* Right Status & Navigation Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {currentTab !== 'home' && (
            <button
              onClick={() => {
                setTab('home');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f1f5f9';
                e.currentTarget.style.borderColor = '#94a3b8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#ffffff';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }}
            >
              <Home size={14} color="#0f172a" />
              <span>Dashboard</span>
            </button>
          )}

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
    </header>
  );
}
