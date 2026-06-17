import React from 'react';
import { useGoals } from '../context/GoalContext';
import { LayoutDashboard, CalendarRange, Database, Trophy, Sparkles, CalendarDays, Activity, LineChart, Dumbbell } from 'lucide-react';

interface SidebarProps {
  activeTab: 'dashboard' | 'timeline' | 'calendar' | 'habits' | 'tracking' | 'strong';
  setActiveTab: (tab: 'dashboard' | 'timeline' | 'calendar' | 'habits' | 'tracking' | 'strong') => void;
  selectedGoalId: string | null;
  setSelectedGoalId: (id: string | null) => void;
  openSettings: () => void;
  openLogin: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  selectedGoalId,
  setSelectedGoalId,
  openSettings,
  openLogin
}) => {
  const { finalGoals, isSupabaseConnected, user, logout } = useGoals();

  const handleGoalClick = (goalId: string) => {
    setSelectedGoalId(goalId);
    setActiveTab('timeline');
  };

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '40px', padding: '0 8px' }}>
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

      {/* Main Tabs Navigation */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '32px' }}>
        <button
          onClick={() => {
            setActiveTab('dashboard');
            setSelectedGoalId(null);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: 'var(--border-radius-md)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500,
            transition: 'var(--transition-fast)',
            textAlign: 'left',
            width: '100%',
            backgroundColor: activeTab === 'dashboard' ? 'rgba(168, 85, 247, 0.08)' : 'transparent',
            color: activeTab === 'dashboard' ? 'var(--accent-primary)' : 'var(--text-med)',
            borderLeft: activeTab === 'dashboard' ? '3px solid var(--accent-primary)' : '3px solid transparent'
          }}
          onMouseOver={(e) => {
            if (activeTab !== 'dashboard') {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
              e.currentTarget.style.color = 'var(--text-high)';
            }
          }}
          onMouseOut={(e) => {
            if (activeTab !== 'dashboard') {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-med)';
            }
          }}
        >
          <LayoutDashboard size={18} />
          Tableau de Bord
        </button>

        <button
          onClick={() => {
            setActiveTab('timeline');
            if (finalGoals.length > 0 && !selectedGoalId) {
              setSelectedGoalId(finalGoals[0].id);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: 'var(--border-radius-md)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500,
            transition: 'var(--transition-fast)',
            textAlign: 'left',
            width: '100%',
            backgroundColor: activeTab === 'timeline' ? 'rgba(168, 85, 247, 0.08)' : 'transparent',
            color: activeTab === 'timeline' ? 'var(--accent-primary)' : 'var(--text-med)',
            borderLeft: activeTab === 'timeline' ? '3px solid var(--accent-primary)' : '3px solid transparent'
          }}
          onMouseOver={(e) => {
            if (activeTab !== 'timeline') {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
              e.currentTarget.style.color = 'var(--text-high)';
            }
          }}
          onMouseOut={(e) => {
            if (activeTab !== 'timeline') {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-med)';
            }
          }}
        >
          <CalendarRange size={18} />
          Vue Chronologique
        </button>

        <button
          onClick={() => {
            setActiveTab('calendar');
            setSelectedGoalId(null);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: 'var(--border-radius-md)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500,
            transition: 'var(--transition-fast)',
            textAlign: 'left',
            width: '100%',
            backgroundColor: activeTab === 'calendar' ? 'rgba(168, 85, 247, 0.08)' : 'transparent',
            color: activeTab === 'calendar' ? 'var(--accent-primary)' : 'var(--text-med)',
            borderLeft: activeTab === 'calendar' ? '3px solid var(--accent-primary)' : '3px solid transparent'
          }}
          onMouseOver={(e) => {
            if (activeTab !== 'calendar') {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
              e.currentTarget.style.color = 'var(--text-high)';
            }
          }}
          onMouseOut={(e) => {
            if (activeTab !== 'calendar') {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-med)';
            }
          }}
        >
          <CalendarDays size={18} />
          Calendrier Planif
        </button>

        <button
          onClick={() => {
            setActiveTab('habits');
            setSelectedGoalId(null);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: 'var(--border-radius-md)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500,
            transition: 'var(--transition-fast)',
            textAlign: 'left',
            width: '100%',
            backgroundColor: activeTab === 'habits' ? 'rgba(168, 85, 247, 0.08)' : 'transparent',
            color: activeTab === 'habits' ? 'var(--accent-primary)' : 'var(--text-med)',
            borderLeft: activeTab === 'habits' ? '3px solid var(--accent-primary)' : '3px solid transparent'
          }}
          onMouseOver={(e) => {
            if (activeTab !== 'habits') {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
              e.currentTarget.style.color = 'var(--text-high)';
            }
          }}
          onMouseOut={(e) => {
            if (activeTab !== 'habits') {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-med)';
            }
          }}
        >
          <Activity size={18} />
          Habitudes & Routines
        </button>
        
        <button
          onClick={() => {
            setActiveTab('tracking');
            setSelectedGoalId(null);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: 'var(--border-radius-md)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500,
            transition: 'var(--transition-fast)',
            textAlign: 'left',
            width: '100%',
            backgroundColor: activeTab === 'tracking' ? 'rgba(168, 85, 247, 0.08)' : 'transparent',
            color: activeTab === 'tracking' ? 'var(--accent-primary)' : 'var(--text-med)',
            borderLeft: activeTab === 'tracking' ? '3px solid var(--accent-primary)' : '3px solid transparent'
          }}
          onMouseOver={(e) => {
            if (activeTab !== 'tracking') {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
              e.currentTarget.style.color = 'var(--text-high)';
            }
          }}
          onMouseOut={(e) => {
            if (activeTab !== 'tracking') {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-med)';
            }
          }}
        >
          <LineChart size={18} />
          Suivi & Tracking
        </button>

        <button
          onClick={() => {
            setActiveTab('strong');
            setSelectedGoalId(null);
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: 'var(--border-radius-md)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500,
            transition: 'var(--transition-fast)',
            textAlign: 'left',
            width: '100%',
            backgroundColor: activeTab === 'strong' ? 'rgba(168, 85, 247, 0.08)' : 'transparent',
            color: activeTab === 'strong' ? 'var(--accent-primary)' : 'var(--text-med)',
            borderLeft: activeTab === 'strong' ? '3px solid var(--accent-primary)' : '3px solid transparent'
          }}
          onMouseOver={(e) => {
            if (activeTab !== 'strong') {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
              e.currentTarget.style.color = 'var(--text-high)';
            }
          }}
          onMouseOut={(e) => {
            if (activeTab !== 'strong') {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-med)';
            }
          }}
        >
          <Dumbbell size={18} />
          Musculation (Strong)
        </button>
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
            display: 'block',
            padding: '0 16px 8px 16px',
            borderBottom: '1px solid var(--border-color)',
            marginBottom: '12px'
          }}>
            Objectifs Actifs
          </span>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {finalGoals.map(goal => {
              const isSelected = selectedGoalId === goal.id && activeTab === 'timeline';
              return (
                <li key={goal.id}>
                  <button
                    onClick={() => handleGoalClick(goal.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--border-radius-sm)',
                      background: isSelected ? 'rgba(255,255,255,0.03)' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: isSelected ? 'var(--text-high)' : 'var(--text-med)',
                      transition: 'var(--transition-fast)'
                    }}
                    onMouseOver={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.01)';
                        e.currentTarget.style.color = 'var(--text-high)';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--text-med)';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', marginRight: '6px' }}>
                      <Trophy size={14} style={{ flexShrink: 0, color: isSelected ? 'var(--accent-secondary)' : 'var(--text-low)' }} />
                      <span style={{
                        fontSize: '0.82rem',
                        fontWeight: isSelected ? 600 : 400,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {goal.title.replace(/[^\w\s\dÀ-ÿ🚀🌿🎯💻💰🏃‍♂️🏁]/gi, '').trim()}
                      </span>
                    </div>
                    <span
                      className="badge badge-purple"
                      style={{
                        fontSize: '0.65rem',
                        padding: '1px 5px',
                        flexShrink: 0,
                        background: isSelected ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.03)'
                      }}
                    >
                      {goal.progress}%
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Bottom section: Supabase Status, User Profile & Settings */}
      <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* User Account / Login State */}
        {user ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--border-radius-md)',
            padding: '12px 14px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.85rem',
                fontWeight: 700,
                textTransform: 'capitalize'
              }}>
                {user.email ? user.email.split('@')[0][0] : 'U'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                  {user.email ? user.email.split('@')[0] : 'Utilisateur'}
                </span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-low)' }}>
                  Compte Cloud actif
                </span>
              </div>
            </div>
            <button
              onClick={logout}
              style={{
                background: 'none',
                border: 'none',
                color: '#fb7185',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'left',
                padding: '4px 0',
                transition: 'var(--transition-fast)'
              }}
              onMouseOver={(e) => { e.currentTarget.style.color = '#fb516c'; }}
              onMouseOut={(e) => { e.currentTarget.style.color = '#fb7185'; }}
            >
              Se déconnecter
            </button>
          </div>
        ) : (
          <button
            onClick={openLogin}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '10px 14px',
              borderRadius: 'var(--border-radius-md)',
              border: '1px solid rgba(168, 85, 247, 0.4)',
              backgroundColor: 'rgba(168, 85, 247, 0.05)',
              color: '#ffffff',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'var(--transition-fast)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.15)';
              e.currentTarget.style.boxShadow = 'var(--shadow-neon-primary)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.05)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <Sparkles size={14} style={{ color: 'var(--accent-secondary)' }} />
            Se Connecter / S'inscrire
          </button>
        )}

        {/* Supabase status indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 8px' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isSupabaseConnected ? 'var(--accent-success)' : 'var(--accent-warning)',
            boxShadow: `0 0 10px ${isSupabaseConnected ? 'var(--accent-success)' : 'var(--accent-warning)'}`,
            animation: 'pulse-glow 2s infinite'
          }} />
          <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-med)' }}>
            {isSupabaseConnected ? 'Base Cloud Connectée' : 'Mode Démo Local'}
          </span>
        </div>

        {/* Settings button */}
        <button
          onClick={openSettings}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 16px',
            borderRadius: 'var(--border-radius-md)',
            border: '1px solid var(--border-color)',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: 500,
            transition: 'var(--transition-fast)',
            color: 'var(--text-high)',
            width: '100%',
            justifyContent: 'center'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-primary)';
            e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.05)';
            e.currentTarget.style.boxShadow = 'var(--shadow-neon-primary)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.borderColor = 'var(--border-color)';
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <Database size={16} />
          Configuration DB
        </button>
      </div>
    </aside>
  );
};
