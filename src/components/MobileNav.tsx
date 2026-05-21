import React from 'react';
import { LayoutDashboard, CalendarRange, Database } from 'lucide-react';

interface MobileNavProps {
  activeTab: 'dashboard' | 'timeline';
  setActiveTab: (tab: 'dashboard' | 'timeline') => void;
  openSettings: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  setActiveTab,
  openSettings
}) => {
  return (
    <nav
      className="mobile-nav-bar glass"
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '16px',
        right: '16px',
        height: 'var(--mobile-nav-height)',
        borderRadius: '50px',
        zIndex: 500,
        display: 'none', // Managed via media queries (styled below)
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '0 12px',
        border: '1px solid var(--border-color-hover)'
      }}
    >
      <button
        onClick={() => setActiveTab('dashboard')}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: activeTab === 'dashboard' ? 'var(--accent-primary)' : 'var(--text-med)',
          transition: 'var(--transition-fast)',
          width: '60px',
          height: '100%'
        }}
      >
        <LayoutDashboard size={20} style={{
          filter: activeTab === 'dashboard' ? 'drop-shadow(0 0 4px var(--accent-primary-glow))' : 'none'
        }} />
        <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>Dashboard</span>
      </button>

      <button
        onClick={() => setActiveTab('timeline')}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: activeTab === 'timeline' ? 'var(--accent-primary)' : 'var(--text-med)',
          transition: 'var(--transition-fast)',
          width: '60px',
          height: '100%'
        }}
      >
        <CalendarRange size={20} style={{
          filter: activeTab === 'timeline' ? 'drop-shadow(0 0 4px var(--accent-primary-glow))' : 'none'
        }} />
        <span style={{ fontSize: '0.65rem', fontWeight: 600 }}>Timeline</span>
      </button>

      <button
        onClick={openSettings}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-high)',
          transition: 'var(--transition-fast)',
          width: '60px',
          height: '100%'
        }}
      >
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          padding: '6px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Database size={16} />
        </div>
        <span style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--text-med)' }}>Database</span>
      </button>

      {/* Insert styles block to manage displaying the navbar on mobile */}
      <style>{`
        @media (max-width: 1024px) {
          .mobile-nav-bar {
            display: flex !important;
          }
        }
      `}</style>
    </nav>
  );
};
