import React from 'react';
import { useGoals } from '../context/GoalContext';
import type { FinalGoal } from '../types';
import { DifficultyIndicator } from './DifficultyIndicator';
import { Trophy, Calendar, CheckSquare, Plus, ArrowRight, Edit3, Trash2, Zap } from 'lucide-react';

interface DashboardProps {
  setActiveTab: (tab: 'dashboard' | 'timeline') => void;
  setSelectedGoalId: (id: string | null) => void;
  openCreateModal: (type: 'goal' | 'milestone', parentId?: string) => void;
  openEditModal: (goal: FinalGoal) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  setActiveTab,
  setSelectedGoalId,
  openCreateModal,
  openEditModal
}) => {
  const { finalGoals, milestones, subtasks, deleteFinalGoal, loading, loadDemoData } = useGoals();

  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortBy, setSortBy] = React.useState<'date_asc' | 'date_desc' | 'points_abs' | 'points_rel' | 'progress' | 'priority'>('date_asc');

  const handleFocusGoal = (goalId: string) => {
    setSelectedGoalId(goalId);
    setActiveTab('timeline');
  };

  // Stats computations
  const totalGoals = finalGoals.length;
  const completedGoals = finalGoals.filter(g => g.status === 'completed' || g.progress === 100).length;
  const totalMilestones = milestones.length;
  const completedSubtasks = subtasks.filter(s => s.is_completed).length;
  const totalSubtasks = subtasks.length;

  const subtaskRatio = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  // XP Gamification scoring sums
  let totalXpAbsPotential = 0;
  let totalXpRelPotential = 0;
  let totalXpAbsEarned = 0;
  let totalXpRelEarned = 0;

  finalGoals.forEach(g => {
    const abs = g.points_absolute || 0;
    const rel = g.points_relative || 0;
    totalXpAbsPotential += abs;
    totalXpRelPotential += rel;
    if (g.status === 'completed' || g.progress === 100) {
      totalXpAbsEarned += abs;
      totalXpRelEarned += rel;
    }
  });

  milestones.forEach(m => {
    const abs = m.points_absolute || 0;
    const rel = m.points_relative || 0;
    totalXpAbsPotential += abs;
    totalXpRelPotential += rel;
    if (m.status === 'completed') {
      totalXpAbsEarned += abs;
      totalXpRelEarned += rel;
    }
  });

  // Filter & Sort list computation
  const filteredAndSortedGoals = React.useMemo(() => {
    let result = [...finalGoals];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(g =>
        g.title.toLowerCase().includes(q) ||
        (g.description || '').toLowerCase().includes(q)
      );
    }

    // Sort order application
    result.sort((a, b) => {
      if (sortBy === 'date_asc') {
        return new Date(a.target_date || '').getTime() - new Date(b.target_date || '').getTime();
      }
      if (sortBy === 'date_desc') {
        return new Date(b.target_date || '').getTime() - new Date(a.target_date || '').getTime();
      }
      if (sortBy === 'points_abs') {
        return (b.points_absolute || 0) - (a.points_absolute || 0);
      }
      if (sortBy === 'points_rel') {
        return (b.points_relative || 0) - (a.points_relative || 0);
      }
      if (sortBy === 'progress') {
        return (b.progress || 0) - (a.progress || 0);
      }
      if (sortBy === 'priority') {
        const rank = (p?: string) => {
          if (p === 'high') return 3;
          if (p === 'low') return 1;
          return 2;
        };
        return rank(b.priority) - rank(a.priority);
      }
      return 0;
    });

    return result;
  }, [finalGoals, searchQuery, sortBy]);

  // Date countdown helper
  const getDaysRemaining = (dateStr: string) => {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);

    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return { text: `En retard (${Math.abs(diffDays)} j)`, isOverdue: true };
    if (diffDays === 0) return { text: "Aujourd'hui !", isOverdue: false, isUrgent: true };
    return { text: `${diffDays} jours restants`, isOverdue: false };
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '16px' }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(168, 85, 247, 0.1)',
          borderTopColor: 'var(--accent-primary)',
          borderRadius: '50%',
          animation: 'spin-slow 0.8s linear infinite'
        }} />
        <span style={{ fontSize: '0.9rem', color: 'var(--text-med)', fontWeight: 500 }}>Chargement de vos objectifs...</span>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Welcome Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '4px' }}>
            Tableau de Bord
          </h1>
          <p style={{ color: 'var(--text-med)', fontSize: '0.95rem' }}>
            Suivez et accomplissez vos objectifs à votre rythme.
          </p>
        </div>

        <button
          onClick={() => openCreateModal('goal')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'var(--accent-primary)',
            border: 'none',
            borderRadius: 'var(--border-radius-md)',
            padding: '10px 18px',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'var(--transition-fast)',
            boxShadow: 'var(--shadow-neon-primary)'
          }}
          onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.15)'}
          onMouseOut={(e) => e.currentTarget.style.filter = 'none'}
        >
          <Plus size={16} />
          Nouvel Objectif
        </button>
      </div>

      {/* Gamified Trophy Wall / XP Panel */}
      <div className="glass" style={{
        padding: '24px',
        borderRadius: 'var(--border-radius-lg)',
        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.05) 0%, rgba(99, 102, 241, 0.05) 50%, rgba(6, 182, 212, 0.05) 100%)',
        border: '1px solid rgba(168, 85, 247, 0.15)',
        boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              backgroundColor: 'rgba(168, 85, 247, 0.15)',
              padding: '12px',
              borderRadius: '50%',
              color: 'var(--accent-primary)',
              animation: 'pulse-glow 2.5s infinite',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Trophy size={26} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '-0.02em', margin: 0 }}>Mur des Trophées & Progression XP</h2>
              <p style={{ color: 'var(--text-med)', fontSize: '0.8rem', marginTop: '2px', margin: 0 }}>
                Accumulez de l'XP en complétant vos jalons et objectifs.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '20px' }}>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-low)', textTransform: 'uppercase', fontWeight: 600 }}>XP Absolu Réalisé</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--accent-primary)', marginTop: '2px' }}>
                {totalXpAbsEarned} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-med)' }}>/ {totalXpAbsPotential} XP</span>
              </div>
            </div>
            <div style={{ width: '1px', backgroundColor: 'rgba(255,255,255,0.05)' }} />
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-low)', textTransform: 'uppercase', fontWeight: 600 }}>XP Relatif Réalisé</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--accent-secondary)', marginTop: '2px' }}>
                {totalXpRelEarned} <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-med)' }}>/ {totalXpRelPotential} XP</span>
              </div>
            </div>
          </div>
        </div>

        {/* Global XP Level Progress Bar */}
        {totalXpAbsPotential > 0 ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-med)', marginBottom: '8px' }}>
              <span>Niveau de Complétion XP (Absolu)</span>
              <span>{Math.round((totalXpAbsEarned / totalXpAbsPotential) * 100)}% complété</span>
            </div>
            <div style={{ height: '8px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.02)' }}>
              <div style={{
                width: `${(totalXpAbsEarned / totalXpAbsPotential) * 100}%`,
                height: '100%',
                background: 'linear-gradient(90deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
                boxShadow: '0 0 12px var(--accent-primary)',
                transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)'
              }} />
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-low)', textAlign: 'center', padding: '4px' }}>
            Aucun point XP disponible. Créez un objectif pour initialiser votre jauge de progression.
          </div>
        )}
      </div>

      {/* Stats Counter Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '20px'
      }}>
        {/* Stat item 1 */}
        <div className="glass" style={{ padding: '24px', borderRadius: 'var(--border-radius-lg)', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            backgroundColor: 'rgba(168, 85, 247, 0.1)',
            padding: '14px',
            borderRadius: 'var(--border-radius-md)',
            color: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Trophy size={26} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-med)', letterSpacing: '0.05em' }}>Objectifs Finaux</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
              <span style={{ fontSize: '1.8rem', fontWeight: 800 }}>{totalGoals}</span>
              {totalGoals > 0 && (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-med)' }}>({completedGoals} complétés)</span>
              )}
            </div>
          </div>
        </div>

        {/* Stat item 2 */}
        <div className="glass" style={{ padding: '24px', borderRadius: 'var(--border-radius-lg)', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            backgroundColor: 'rgba(6, 182, 212, 0.1)',
            padding: '14px',
            borderRadius: 'var(--border-radius-md)',
            color: 'var(--accent-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Calendar size={26} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-med)', letterSpacing: '0.05em' }}>Jalons / Milestones</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
              <span style={{ fontSize: '1.8rem', fontWeight: 800 }}>{totalMilestones}</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-med)' }}>sécurisés</span>
            </div>
          </div>
        </div>

        {/* Stat item 3 */}
        <div className="glass" style={{ padding: '24px', borderRadius: 'var(--border-radius-lg)', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            padding: '14px',
            borderRadius: 'var(--border-radius-md)',
            color: 'var(--accent-success)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <CheckSquare size={26} />
          </div>
          <div style={{ flexGrow: 1 }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-med)', letterSpacing: '0.05em' }}>Sous-Tâches</span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px', marginBottom: '8px' }}>
              <span style={{ fontSize: '1.8rem', fontWeight: 800 }}>{completedSubtasks}</span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-low)' }}>/ {totalSubtasks}</span>
            </div>
            {/* Small stats progress bar */}
            <div style={{ height: '4px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ width: `${subtaskRatio}%`, height: '100%', backgroundColor: 'var(--accent-success)', boxShadow: '0 0 8px rgba(16, 185, 129, 0.4)', transition: 'width 0.4s ease' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Focus banner - Show if has goals but not finished */}
      {totalGoals > 0 && finalGoals.some(g => g.progress && g.progress < 100) && (
        <div
          className="glass animate-float"
          style={{
            padding: '20px 24px',
            borderRadius: 'var(--border-radius-lg)',
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(6, 182, 212, 0.04) 100%)',
            border: '1px solid rgba(168, 85, 247, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              color: 'var(--accent-primary)',
              animation: 'pulse-glow 2s infinite',
              backgroundColor: 'rgba(168, 85, 247, 0.15)',
              padding: '10px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Zap size={20} />
            </div>
            <div>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Concentrez vos efforts !</h4>
              <p style={{ color: 'var(--text-med)', fontSize: '0.82rem', marginTop: '2px' }}>
                Votre objectif le plus urgent est : <strong>{finalGoals.find(g => g.progress && g.progress < 100)?.title}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={() => handleFocusGoal(finalGoals.find(g => g.progress && g.progress < 100)!.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--accent-primary)',
              fontSize: '0.85rem',
              fontWeight: 600,
              transition: 'var(--transition-fast)'
            }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'translateX(4px)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'none'}
          >
            Voir la Ligne de Vie <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* Grid Goals section */}
      <div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px'
        }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
            <span>Vos Objectifs principaux</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-low)', fontWeight: 500 }}>({filteredAndSortedGoals.length})</span>
          </h3>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* Search Input */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher un objectif..."
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius-md)',
                padding: '8px 14px',
                fontSize: '0.85rem',
                color: '#ffffff',
                outline: 'none',
                width: '180px',
                transition: 'all 0.2s ease'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
            />

            {/* Sort Selector */}
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius-md)',
                padding: '8px 14px',
                fontSize: '0.85rem',
                color: '#ffffff',
                outline: 'none',
                cursor: 'pointer',
                colorScheme: 'dark'
              }}
            >
              <option value="date_asc">📅 Date Cible (Proche)</option>
              <option value="date_desc">📅 Date Cible (Lointaine)</option>
              <option value="points_abs">🏆 Points Absolus (XP Max)</option>
              <option value="points_rel">👤 Points Relatifs (XP Max)</option>
              <option value="progress">📈 Progression (Max)</option>
              <option value="priority">🔥 Priorité (Haute à Basse)</option>
            </select>
          </div>
        </div>

        {totalGoals === 0 ? (
          /* Empty State Dashboard */
          <div
            className="glass"
            style={{
              padding: '60px 20px',
              borderRadius: 'var(--border-radius-lg)',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
              borderStyle: 'dashed',
              borderWidth: '2px',
              borderColor: 'var(--border-color-hover)'
            }}
          >
            <div style={{
              backgroundColor: 'rgba(255,255,255,0.03)',
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-med)',
              marginBottom: '8px'
            }}>
              <Trophy size={32} />
            </div>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Aucun objectif pour le moment</h4>
            <p style={{ color: 'var(--text-med)', fontSize: '0.85rem', maxWidth: '380px', lineHeight: 1.5 }}>
              Créez votre premier objectif final pour commencer à le diviser en jalons chronologiques et en sous-tâches.
            </p>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button
                onClick={() => openCreateModal('goal')}
                style={{
                  backgroundColor: 'var(--accent-primary)',
                  border: 'none',
                  borderRadius: 'var(--border-radius-md)',
                  padding: '10px 20px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-neon-primary)'
                }}
              >
                Créer mon premier objectif
              </button>
              <button
                onClick={loadDemoData}
                style={{
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  border: '1px solid var(--border-color-hover)',
                  borderRadius: 'var(--border-radius-md)',
                  padding: '10px 20px',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  color: 'var(--text-high)'
                }}
              >
                🔌 Charger des Démo Goals
              </button>
            </div>
          </div>
        ) : (
          /* Grid list items */
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '24px'
          }}>
            {filteredAndSortedGoals.map(goal => {
              const progress = goal.progress || 0;
              const daysInfo = getDaysRemaining(goal.target_date);
              
              // SVG ring calculations
              const radius = 36;
              const circumference = 2 * Math.PI * radius;
              const strokeDashoffset = circumference - (progress / 100) * circumference;

              // Color choices depending on completion
              let accentColor = 'var(--accent-primary)';
              let glowColor = 'var(--shadow-neon-primary)';
              if (progress === 100) {
                accentColor = 'var(--accent-success)';
                glowColor = '0 0 15px rgba(16, 185, 129, 0.4)';
              } else if (progress > 30) {
                accentColor = 'var(--accent-secondary)';
                glowColor = 'var(--shadow-neon-secondary)';
              }

              return (
                <div
                  key={goal.id}
                  className="glass-interactive"
                  style={{
                    borderRadius: 'var(--border-radius-lg)',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: '230px',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                  onClick={() => handleFocusGoal(goal.id)}
                >
                  {/* Top: title, difficulty and dates */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <DifficultyIndicator level={goal.difficulty} showLabel={false} />
                        
                        {goal.points_absolute !== undefined && (
                          <span style={{
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            backgroundColor: 'rgba(168, 85, 247, 0.1)',
                            color: 'var(--accent-primary)',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            border: '1px solid rgba(168, 85, 247, 0.15)'
                          }} title="Points XP Absolus (Difficulté globale)">
                            {goal.points_absolute} XP Abs.
                          </span>
                        )}

                        {goal.points_relative !== undefined && (
                          <span style={{
                            fontSize: '0.62rem',
                            fontWeight: 700,
                            backgroundColor: 'rgba(6, 182, 212, 0.1)',
                            color: 'var(--accent-secondary)',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            border: '1px solid rgba(6, 182, 212, 0.15)'
                          }} title="Points XP Relatifs (Ajustés à votre situation)">
                            {goal.points_relative} XP Rel.
                          </span>
                        )}

                        {goal.priority && (
                          <span style={{
                            fontSize: '0.62rem',
                            fontWeight: 800,
                            backgroundColor: 
                              goal.priority === 'high' ? 'rgba(244, 63, 94, 0.12)' : 
                              goal.priority === 'low' ? 'rgba(56, 189, 248, 0.12)' : 
                              'rgba(234, 179, 8, 0.12)',
                            color: 
                              goal.priority === 'high' ? '#f43f5e' : 
                              goal.priority === 'low' ? '#38bdf8' : 
                              'var(--accent-warning)',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            border: '1px solid ' + (
                              goal.priority === 'high' ? 'rgba(244, 63, 94, 0.2)' : 
                              goal.priority === 'low' ? 'rgba(56, 189, 248, 0.2)' : 
                              'rgba(234, 179, 8, 0.2)'
                            )
                          }}>
                            {goal.priority === 'high' ? '🔥 Haute' : goal.priority === 'low' ? '❄️ Basse' : '⚡ Moyenne'}
                          </span>
                        )}
                      </div>
                      
                      {daysInfo && (
                        <span
                          className={`badge ${
                            daysInfo.isOverdue ? 'badge-rose' : progress === 100 ? 'badge-emerald' : 'badge-purple'
                          }`}
                          style={{ fontSize: '0.65rem' }}
                        >
                          {progress === 100 ? 'Terminé 🎉' : daysInfo.text}
                        </span>
                      )}
                    </div>

                    <h4 style={{
                      fontSize: '1.15rem',
                      fontWeight: 700,
                      lineHeight: 1.3,
                      marginBottom: '8px',
                      color: 'var(--text-high)',
                      letterSpacing: '-0.015em'
                    }}>
                      {goal.title}
                    </h4>

                    <p style={{
                      fontSize: '0.82rem',
                      color: 'var(--text-med)',
                      lineHeight: 1.4,
                      marginBottom: '16px',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {goal.description || "Aucune description fournie pour cet objectif."}
                    </p>
                  </div>

                  {/* Bottom: Progress Circular ring and actions */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid rgba(255,255,255,0.03)',
                    paddingTop: '16px',
                    marginTop: 'auto'
                  }}>
                    {/* SVG progress ring */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ position: 'relative', width: '84px', height: '84px', display: 'flex', alignItems: 'center', justifyItems: 'center' }}>
                        <svg width="84" height="84" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                          {/* Background ring */}
                          <circle
                            cx="42" cy="42" r={radius}
                            fill="transparent"
                            stroke="rgba(255,255,255,0.03)"
                            strokeWidth="6"
                          />
                          {/* Colored dynamic ring */}
                          <circle
                            cx="42" cy="42" r={radius}
                            fill="transparent"
                            stroke={accentColor}
                            strokeWidth="6"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            style={{
                              transition: 'stroke-dashoffset 0.5s ease',
                              filter: `drop-shadow(${glowColor})`
                            }}
                          />
                        </svg>
                        <div style={{
                          position: 'absolute',
                          top: 0, left: 0, right: 0, bottom: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexDirection: 'column'
                        }}>
                          <span style={{ fontSize: '1.05rem', fontWeight: 800 }}>{progress}%</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Progression</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-low)' }}>
                          {milestones.filter(m => m.final_goal_id === goal.id).length} jalons définis
                        </span>
                      </div>
                    </div>

                    {/* Quick actions (Edit / Delete) */}
                    <div
                      style={{ display: 'flex', gap: '8px' }}
                      onClick={(e) => e.stopPropagation()} // Avoid triggering card click
                    >
                      <button
                        onClick={() => openEditModal(goal)}
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid var(--border-color)',
                          cursor: 'pointer',
                          padding: '8px',
                          borderRadius: '8px',
                          display: 'flex',
                          color: 'var(--text-med)',
                          transition: 'var(--transition-fast)'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.color = 'var(--accent-primary)';
                          e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.2)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.color = 'var(--text-med)';
                          e.currentTarget.style.borderColor = 'var(--border-color)';
                        }}
                      >
                        <Edit3 size={14} />
                      </button>

                      <button
                        onClick={() => {
                          if (window.confirm('Voulez-vous vraiment supprimer cet objectif final ? Tous ses jalons et sous-tâches seront également perdus.')) {
                            deleteFinalGoal(goal.id);
                          }
                        }}
                        style={{
                          background: 'rgba(244, 63, 94, 0.03)',
                          border: '1px solid rgba(244, 63, 94, 0.1)',
                          cursor: 'pointer',
                          padding: '8px',
                          borderRadius: '8px',
                          display: 'flex',
                          color: 'var(--accent-danger)',
                          transition: 'var(--transition-fast)'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(244, 63, 94, 0.1)';
                          e.currentTarget.style.borderColor = 'rgba(244, 63, 94, 0.3)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(244, 63, 94, 0.03)';
                          e.currentTarget.style.borderColor = 'rgba(244, 63, 94, 0.1)';
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Dotted "+" Card to Add Goal */}
            <div
              className="glass"
              style={{
                borderRadius: 'var(--border-radius-lg)',
                borderStyle: 'dashed',
                borderWidth: '2px',
                borderColor: 'var(--border-color-hover)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '230px',
                gap: '12px',
                transition: 'all 0.3s ease'
              }}
              onClick={() => openCreateModal('goal')}
              onMouseOver={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-primary)';
                e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.02)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color-hover)';
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-med)',
                transition: 'all 0.3s ease'
              }}>
                <Plus size={24} />
              </div>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-med)' }}>Ajouter un nouvel objectif</span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
