import React from 'react';
import { useGoals } from '../context/GoalContext';
import { 
  Sun, 
  LineChart, 
  Dumbbell, 
  Target, 
  Sparkles, 
  LayoutDashboard, 
  CalendarRange, 
  CalendarDays, 
  Database, 
  Trophy, 
  LogOut, 
  LogIn 
} from 'lucide-react';
import type { MainTabType } from './MobileNav';

interface SidebarProps {
  activeTab: MainTabType;
  setActiveTab: (tab: MainTabType) => void;
  goalsSubTab: 'dashboard' | 'timeline' | 'calendar';
  setGoalsSubTab: (tab: 'dashboard' | 'timeline' | 'calendar') => void;
  selectedGoalId: string | null;
  setSelectedGoalId: (id: string | null) => void;
  openSettings: () => void;
  openLogin: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  goalsSubTab,
  setGoalsSubTab,
  selectedGoalId,
  setSelectedGoalId,
  openSettings,
  openLogin
}) => {
  const { finalGoals, isSupabaseConnected, user, logout } = useGoals();

  const handleGoalClick = (goalId: string) => {
    setSelectedGoalId(goalId);
    setActiveTab('goals');
    setGoalsSubTab('timeline');
  };

  const navItems = [
    {
      id: 'daily' as MainTabType,
      label: 'Quotidien & Routines',
      icon: Sun,
      color: '#f59e0b'
    },
    {
      id: 'tracking' as MainTabType,
      label: 'Suivi & Mesures',
      icon: LineChart,
      color: 'var(--accent-secondary)'
    },
    {
      id: 'strong' as MainTabType,
      label: 'Musculation Strong',
      icon: Dumbbell,
      color: 'var(--accent-primary)'
    },
    {
      id: 'goals' as MainTabType,
      label: 'Objectifs & Projets',
      icon: Target,
      color: '#10b981'
    }
  ];

  return (
    <aside
      className="sidebar glass"
      style={{
        width: 'var(--sidebar-width)',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--border-color)',
        padding: '24px 16px',
        overflowY: 'auto'
      }}
    >
      {/* Brand Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px', padding: '0 8px' }}>
        <div style={{
          background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          boxShadow: 'var(--shadow-neon-primary)'
        }}>
          <Sparkles size={16} />
        </div>
        <span style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.03em', background: 'linear-gradient(to right, #ffffff, var(--text-med))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Antigravity Plan
        </span>
      </div>

      {/* Main Tabs Navigation (The 4 Pillars) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '24px' }}>
        {navItems.map(item => {
          const isActive = activeTab === item.id;
          const IconComponent = item.icon;

          return (
            <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <button
                onClick={() => {
                  setActiveTab(item.id);
                  if (item.id !== 'goals') {
                    setSelectedGoalId(null);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: 'var(--border-radius-md)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: isActive ? 700 : 500,
                  transition: 'var(--transition-fast)',
                  textAlign: 'left',
                  width: '100%',
                  backgroundColor: isActive ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-med)',
                  borderLeft: isActive ? `3px solid ${item.color}` : '3px solid transparent'
                }}
                onMouseOver={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                    e.currentTarget.style.color = 'var(--text-high)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-med)';
                  }
                }}
              >
                <IconComponent size={18} style={{ color: isActive ? item.color : 'var(--text-med)' }} />
                <span>{item.label}</span>
              </button>

              {/* Sub-items for Goals Hub */}
              {item.id === 'goals' && isActive && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '32px', margin: '4px 0 8px 0' }}>
                  <button
                    onClick={() => {
                      setActiveTab('goals');
                      setGoalsSubTab('dashboard');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 8px',
                      fontSize: '0.8rem',
                      fontWeight: goalsSubTab === 'dashboard' ? 600 : 400,
                      color: goalsSubTab === 'dashboard' ? 'var(--accent-primary)' : 'var(--text-med)',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      textAlign: 'left'
                    }}
                  >
                    <LayoutDashboard size={14} />
                    <span>Vue d'ensemble</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('goals');
                      setGoalsSubTab('timeline');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 8px',
                      fontSize: '0.8rem',
                      fontWeight: goalsSubTab === 'timeline' ? 600 : 400,
                      color: goalsSubTab === 'timeline' ? 'var(--accent-primary)' : 'var(--text-med)',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      textAlign: 'left'
                    }}
                  >
                    <CalendarRange size={14} />
                    <span>Chronologie (Timeline)</span>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('goals');
                      setGoalsSubTab('calendar');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 8px',
                      fontSize: '0.8rem',
                      fontWeight: goalsSubTab === 'calendar' ? 600 : 400,
                      color: goalsSubTab === 'calendar' ? 'var(--accent-primary)' : 'var(--text-med)',
                      cursor: 'pointer',
                      borderRadius: '4px',
                      textAlign: 'left'
                    }}
                  >
                    <CalendarDays size={14} />
                    <span>Calendrier</span>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick Jump Final Goals list */}
      {finalGoals.length > 0 && (
        <div style={{ flexGrow: 1, overflowY: 'auto', marginBottom: '24px' }}>
          <span style={{
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-low)',
            fontWeight: 700,
            padding: '0 8px',
            marginBottom: '8px',
            display: 'block'
          }}>
            Mes Projets Actifs ({finalGoals.length})
          </span>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {finalGoals.map(goal => {
              const isSelected = selectedGoalId === goal.id && activeTab === 'goals' && goalsSubTab === 'timeline';
              return (
                <button
                  key={goal.id}
                  onClick={() => handleGoalClick(goal.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: 'var(--border-radius-sm)',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.82rem',
                    textAlign: 'left',
                    width: '100%',
                    backgroundColor: isSelected ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
                    color: isSelected ? 'var(--accent-secondary)' : 'var(--text-med)',
                    transition: 'var(--transition-fast)'
                  }}
                  onMouseOver={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
                      e.currentTarget.style.color = 'var(--text-high)';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.color = 'var(--text-med)';
                    }
                  }}
                >
                  <Trophy size={13} style={{ flexShrink: 0, opacity: isSelected ? 1 : 0.6 }} />
                  <span style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontWeight: isSelected ? 600 : 400
                  }}>
                    {goal.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer / Account / Settings */}
      <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          onClick={openSettings}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            borderRadius: 'var(--border-radius-sm)',
            border: '1px solid var(--border-color)',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            color: 'var(--text-high)',
            cursor: 'pointer',
            fontSize: '0.82rem',
            fontWeight: 500,
            transition: 'var(--transition-fast)'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)'}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={15} style={{ color: isSupabaseConnected ? 'var(--accent-success)' : 'var(--accent-warning)' }} />
            <span>Paramètres & Cloud</span>
          </div>
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isSupabaseConnected ? 'var(--accent-success)' : 'var(--accent-warning)'
          }} />
        </button>

        {user ? (
          <button
            onClick={logout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 12px',
              borderRadius: 'var(--border-radius-sm)',
              border: 'none',
              backgroundColor: 'transparent',
              color: 'var(--accent-danger)',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 500,
              transition: 'var(--transition-fast)'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(244, 63, 94, 0.08)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <LogOut size={15} />
            <span>Se déconnecter</span>
          </button>
        ) : (
          <button
            onClick={openLogin}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 12px',
              borderRadius: 'var(--border-radius-sm)',
              border: 'none',
              backgroundColor: 'rgba(168, 85, 247, 0.1)',
              color: 'var(--accent-primary)',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 600,
              transition: 'var(--transition-fast)'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.18)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.1)'}
          >
            <LogIn size={15} />
            <span>Se connecter</span>
          </button>
        )}
      </div>

      {/* Responsive media query to hide sidebar on mobile */}
      <style>{`
        @media (max-width: 1024px) {
          .sidebar {
            display: none !important;
          }
        }
      `}</style>
    </aside>
  );
};
