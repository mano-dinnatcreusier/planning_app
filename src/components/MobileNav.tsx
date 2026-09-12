import React from 'react';
import { Sun, LineChart, Dumbbell, Target } from 'lucide-react';

export type MainTabType = 'daily' | 'tracking' | 'strong' | 'goals';

interface MobileNavProps {
  activeTab: MainTabType;
  setActiveTab: (tab: MainTabType) => void;
  openSettings?: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  setActiveTab
}) => {
  const tabs = [
    {
      id: 'daily' as MainTabType,
      label: 'Quotidien',
      icon: Sun,
      color: '#f59e0b' // Amber/Warm gold
    },
    {
      id: 'tracking' as MainTabType,
      label: 'Tracking',
      icon: LineChart,
      color: 'var(--accent-secondary)' // Turquoise Cyan
    },
    {
      id: 'strong' as MainTabType,
      label: 'Strong',
      icon: Dumbbell,
      color: 'var(--accent-primary)' // Purple Neon
    },
    {
      id: 'goals' as MainTabType,
      label: 'Objectifs',
      icon: Target,
      color: '#10b981' // Emerald Green
    }
  ];

  return (
    <nav
      className="mobile-nav-bar glass"
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '16px',
        right: '16px',
        height: '68px',
        borderRadius: '34px',
        zIndex: 500,
        display: 'none', // Managed via media query below
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '0 8px',
        border: '1px solid var(--border-color-hover)',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.65)'
      }}
    >
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        const IconComponent = tab.icon;

        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              flex: '1 1 25%',
              height: '100%',
              padding: '6px 0',
              borderRadius: '24px',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              backgroundColor: isActive ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
              color: isActive ? tab.color : 'var(--text-med)'
            }}
          >
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: isActive ? 'scale(1.12)' : 'scale(1)',
                transition: 'transform 0.2s ease'
              }}
            >
              <IconComponent 
                size={22} 
                style={{
                  filter: isActive ? `drop-shadow(0 0 6px ${tab.color})` : 'none',
                  color: isActive ? tab.color : 'var(--text-med)'
                }} 
              />
            </div>
            <span 
              style={{ 
                fontSize: '0.72rem', 
                fontWeight: isActive ? 700 : 500,
                color: isActive ? '#ffffff' : 'var(--text-med)',
                letterSpacing: '-0.01em'
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}

      {/* Responsive media query to display only on mobile & tablet */}
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
