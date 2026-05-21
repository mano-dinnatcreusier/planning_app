import React, { useState } from 'react';
import { useGoals } from '../context/GoalContext';
import type { Milestone } from '../types';
import { DifficultyIndicator } from './DifficultyIndicator';
import { Calendar, Trash2, Edit3, Plus, ChevronDown, ChevronUp, Square, CheckSquare, ArrowUp, ArrowDown } from 'lucide-react';

interface GoalTimelineProps {
  selectedGoalId: string | null;
  setSelectedGoalId: (id: string | null) => void;
  openCreateModal: (type: 'goal' | 'milestone', parentId?: string) => void;
  openEditMilestoneModal: (milestone: Milestone) => void;
}

export const GoalTimeline: React.FC<GoalTimelineProps> = ({
  selectedGoalId,
  setSelectedGoalId,
  openCreateModal,
  openEditMilestoneModal
}) => {
  const {
    finalGoals,
    milestones,
    subtasks,
    deleteMilestone,
    reorderMilestones,
    addSubtask,
    toggleSubtask,
    deleteSubtask
  } = useGoals();

  const [expandedMilestoneId, setExpandedMilestoneId] = useState<string | null>(null);
  const [newSubtaskTitles, setNewSubtaskTitles] = useState<{ [milestoneId: string]: string }>({});

  const activeGoal = finalGoals.find(g => g.id === selectedGoalId) || finalGoals[0];

  if (finalGoals.length === 0) {
    return (
      <div className="glass" style={{ padding: '40px', borderRadius: 'var(--border-radius-lg)', textAlign: 'center' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>Aucun objectif actif</h3>
        <p style={{ color: 'var(--text-med)', fontSize: '0.85rem' }}>
          Créez d'abord un objectif final depuis le tableau de bord pour configurer sa ligne temporelle.
        </p>
      </div>
    );
  }

  // Filter milestones for active goal
  const goalMilestones = milestones
    .filter(m => m.final_goal_id === activeGoal.id)
    .sort((a, b) => a.order_index - b.order_index);

  const toggleExpandMilestone = (id: string) => {
    setExpandedMilestoneId(expandedMilestoneId === id ? null : id);
  };

  const handleAddSubtask = async (e: React.FormEvent, milestoneId: string) => {
    e.preventDefault();
    const title = newSubtaskTitles[milestoneId]?.trim();
    if (!title) return;

    await addSubtask(milestoneId, title);
    setNewSubtaskTitles(prev => ({ ...prev, [milestoneId]: '' }));
  };

  const handleMoveMilestone = async (currentIndex: number, direction: 'prev' | 'next') => {
    const targetIndex = direction === 'prev' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= goalMilestones.length) return;

    const reorderedIds = [...goalMilestones.map(m => m.id)];
    // Swap
    const temp = reorderedIds[currentIndex];
    reorderedIds[currentIndex] = reorderedIds[targetIndex];
    reorderedIds[targetIndex] = temp;

    await reorderMilestones(activeGoal.id, reorderedIds);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Header Selector */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '4px' }}>
            Ligne de Vie
          </h1>
          <p style={{ color: 'var(--text-med)', fontSize: '0.95rem' }}>
            Chronologie de vos étapes clés.
          </p>
        </div>

        {/* Dynamic Goal Dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-low)', fontWeight: 600 }}>Objectif :</span>
          <select
            value={activeGoal.id}
            onChange={(e) => setSelectedGoalId(e.target.value)}
            className="glass"
            style={{
              padding: '10px 16px',
              borderRadius: 'var(--border-radius-md)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-high)',
              fontSize: '0.9rem',
              fontWeight: 600,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {finalGoals.map(g => (
              <option key={g.id} value={g.id} style={{ backgroundColor: 'var(--bg-main)', color: '#ffffff' }}>
                {g.title} ({g.progress}%)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Goal Summary Header Card */}
      <div className="glass" style={{ padding: '24px', borderRadius: 'var(--border-radius-lg)', position: 'relative', overflow: 'hidden' }}>
        {/* Glow backdrop based on progress */}
        <div style={{
          position: 'absolute',
          top: 0, right: 0, bottom: 0, width: '40%',
          background: `radial-gradient(circle at 80% 50%, ${activeGoal.progress === 100 ? 'rgba(16,185,129,0.06)' : 'rgba(168,85,247,0.06)'}, transparent 70%)`,
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <DifficultyIndicator level={activeGoal.difficulty} />
              <span className={`badge ${activeGoal.progress === 100 ? 'badge-emerald' : 'badge-purple'}`}>
                {activeGoal.progress === 100 ? 'Complété' : 'En cours'}
              </span>
              {activeGoal.points_absolute !== undefined && (
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  backgroundColor: 'rgba(168, 85, 247, 0.1)',
                  color: 'var(--accent-primary)',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  border: '1px solid rgba(168, 85, 247, 0.15)'
                }} title="Points XP Absolus">
                  {activeGoal.points_absolute} XP Abs.
                </span>
              )}
              {activeGoal.points_relative !== undefined && (
                <span style={{
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  backgroundColor: 'rgba(6, 182, 212, 0.1)',
                  color: 'var(--accent-secondary)',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  border: '1px solid rgba(6, 182, 212, 0.15)'
                }} title="Points XP Relatifs">
                  {activeGoal.points_relative} XP Rel.
                </span>
              )}
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>{activeGoal.title}</h2>
            <p style={{ color: 'var(--text-med)', fontSize: '0.88rem', marginTop: '6px', maxWidth: '800px', lineHeight: 1.4 }}>
              {activeGoal.description || "Aucune description fournie pour cet objectif final."}
            </p>
          </div>

          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: activeGoal.progress === 100 ? 'var(--accent-success)' : 'var(--accent-primary)' }}>
              {activeGoal.progress}%
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-low)', fontWeight: 600 }}>COMPLÉTION GLOBALE</span>
          </div>
        </div>

        {/* Dynamic Global Horizontal progress meter */}
        <div style={{ height: '8px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{
            width: `${activeGoal.progress}%`,
            height: '100%',
            backgroundColor: activeGoal.progress === 100 ? 'var(--accent-success)' : 'var(--accent-primary)',
            boxShadow: `0 0 10px ${activeGoal.progress === 100 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(168, 85, 247, 0.4)'}`,
            transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
          }} />
        </div>
      </div>

      {/* Timeline view block */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
            Séquence chronologique des jalons
          </h3>
          <button
            onClick={() => openCreateModal('milestone', activeGoal.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'transparent',
              border: '1px dashed var(--border-color-hover)',
              borderRadius: 'var(--border-radius-md)',
              padding: '6px 14px',
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--text-med)',
              cursor: 'pointer',
              transition: 'var(--transition-fast)'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-primary)';
              e.currentTarget.style.color = 'var(--accent-primary)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color-hover)';
              e.currentTarget.style.color = 'var(--text-med)';
            }}
          >
            <Plus size={14} />
            Ajouter un jalon
          </button>
        </div>

        {goalMilestones.length === 0 ? (
          /* Empty state milestones */
          <div
            className="glass"
            style={{
              padding: '40px 20px',
              borderRadius: 'var(--border-radius-lg)',
              textAlign: 'center',
              borderStyle: 'dashed',
              borderWidth: '2px',
              borderColor: 'var(--border-color-hover)'
            }}
          >
            <Calendar size={24} style={{ color: 'var(--text-low)', marginBottom: '8px' }} />
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '4px' }}>Aucun jalon défini</h4>
            <p style={{ color: 'var(--text-med)', fontSize: '0.8rem', maxWidth: '300px', margin: '0 auto 12px auto' }}>
              Divisez votre objectif final en jalons chronologiques pour mesurer vos avancées.
            </p>
            <button
              onClick={() => openCreateModal('milestone', activeGoal.id)}
              style={{
                backgroundColor: 'rgba(255,255,255,0.03)',
                border: '1px solid var(--border-color-hover)',
                borderRadius: 'var(--border-radius-md)',
                padding: '8px 16px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Ajouter mon premier jalon
            </button>
          </div>
        ) : (
          /* Sequenced Interactive List representing Timeline (Vertical & responsive) */
          <div className="timeline-container" style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* The vertical connector track (placed in background CSS) */}
            <div className="timeline-connector-line" style={{
              position: 'absolute',
              top: '20px',
              bottom: '20px',
              left: '23px',
              width: '2px',
              backgroundColor: 'rgba(255,255,255,0.04)',
              zIndex: 1
            }} />

            {goalMilestones.map((ms, idx) => {
              const msProgress = ms.progress || 0;
              const isExpanded = expandedMilestoneId === ms.id;
              const msSubtasks = subtasks.filter(s => s.milestone_id === ms.id);
              
              // Dynamic color based on status
              let activeNodeGlow = 'none';

              if (msProgress === 100 || ms.status === 'completed') {
                activeNodeGlow = '0 0 10px rgba(16, 185, 129, 0.4)';
              } else if (msProgress > 0 || ms.status === 'in_progress') {
                activeNodeGlow = '0 0 10px rgba(6, 182, 212, 0.4)';
              }

              return (
                <div
                  key={ms.id}
                  style={{
                    display: 'flex',
                    gap: '20px',
                    position: 'relative',
                    zIndex: 2,
                    animationDelay: `${idx * 0.05}s`
                  }}
                  className="animate-slide-in"
                >
                  {/* Left: Glowing Sequence Node */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      backgroundColor: msProgress === 100 ? 'rgba(16, 185, 129, 0.1)' : msProgress > 0 ? 'rgba(6, 182, 212, 0.1)' : 'rgba(255,255,255,0.02)',
                      border: `1.5px solid ${msProgress === 100 ? 'var(--accent-success)' : msProgress > 0 ? 'var(--accent-secondary)' : 'var(--border-color)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '0.95rem',
                      color: msProgress === 100 ? 'var(--accent-success)' : msProgress > 0 ? 'var(--accent-secondary)' : 'var(--text-med)',
                      boxShadow: activeNodeGlow,
                      flexShrink: 0
                    }}>
                      {idx + 1}
                    </div>
                  </div>

                  {/* Right: Milestone Card Details */}
                  <div
                    className="glass"
                    style={{
                      flexGrow: 1,
                      borderRadius: 'var(--border-radius-md)',
                      border: isExpanded ? '1px solid rgba(168, 85, 247, 0.15)' : '1px solid var(--border-color)',
                      transition: 'all 0.3s ease'
                    }}
                  >
                    {/* Header bar clicked to toggle checklist accordion */}
                    <div
                      onClick={() => toggleExpandMilestone(ms.id)}
                      style={{
                        padding: '18px 20px',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxWidth: '75%' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-high)', margin: 0 }}>{ms.title}</h4>
                          <DifficultyIndicator level={ms.difficulty} showLabel={false} />
                          {ms.points_absolute !== undefined && (
                            <span style={{
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              backgroundColor: 'rgba(168, 85, 247, 0.1)',
                              color: 'var(--accent-primary)',
                              padding: '1px 6px',
                              borderRadius: '8px',
                              border: '1px solid rgba(168, 85, 247, 0.12)'
                            }} title="Points XP Absolus pour ce jalon">
                              {ms.points_absolute} XP Abs.
                            </span>
                          )}
                          {ms.points_relative !== undefined && (
                            <span style={{
                              fontSize: '0.62rem',
                              fontWeight: 700,
                              backgroundColor: 'rgba(6, 182, 212, 0.1)',
                              color: 'var(--accent-secondary)',
                              padding: '1px 6px',
                              borderRadius: '8px',
                              border: '1px solid rgba(6, 182, 212, 0.12)'
                            }} title="Points XP Relatifs (Ajustés à votre profil)">
                              {ms.points_relative} XP Rel.
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-med)', lineHeight: 1.4 }}>
                          {ms.description}
                        </p>
                      </div>

                      {/* Right stats, dates & reordering controls */}
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '16px' }}
                        onClick={(e) => e.stopPropagation()} // Avoid accordion trigger
                      >
                        {/* Target Date */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-low)' }}>
                          <Calendar size={12} />
                          <span>{ms.target_date}</span>
                        </div>

                        {/* Progress ring/percentage */}
                        <span
                          className={`badge ${
                            msProgress === 100 ? 'badge-emerald' : msProgress > 0 ? 'badge-cyan' : 'badge-purple'
                          }`}
                          style={{ fontSize: '0.7rem' }}
                        >
                          {msProgress}%
                        </span>

                        {/* Chronological sequencing arrows */}
                        <div style={{ display: 'flex', gap: '2px' }}>
                          <button
                            onClick={() => handleMoveMilestone(idx, 'prev')}
                            disabled={idx === 0}
                            style={{
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid var(--border-color)',
                              padding: '4px 6px',
                              borderRadius: '4px',
                              color: idx === 0 ? 'var(--text-low)' : 'var(--text-med)',
                              cursor: idx === 0 ? 'default' : 'pointer',
                              display: 'flex'
                            }}
                          >
                            <ArrowUp size={12} />
                          </button>
                          <button
                            onClick={() => handleMoveMilestone(idx, 'next')}
                            disabled={idx === goalMilestones.length - 1}
                            style={{
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid var(--border-color)',
                              padding: '4px 6px',
                              borderRadius: '4px',
                              color: idx === goalMilestones.length - 1 ? 'var(--text-low)' : 'var(--text-med)',
                              cursor: idx === goalMilestones.length - 1 ? 'default' : 'pointer',
                              display: 'flex'
                            }}
                          >
                            <ArrowDown size={12} />
                          </button>
                        </div>

                        {/* Edit / Delete icons */}
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            onClick={() => openEditMilestoneModal(ms)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '4px',
                              color: 'var(--text-med)'
                            }}
                          >
                            <Edit3 size={12} />
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm('Voulez-vous supprimer ce jalon ? Ses sous-tâches seront également perdues.')) {
                                deleteMilestone(ms.id);
                              }
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '4px',
                              color: 'var(--accent-danger)'
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>

                        {/* Accordion Expand indicator */}
                        <div
                          style={{ color: 'var(--text-med)', display: 'flex', cursor: 'pointer' }}
                          onClick={() => toggleExpandMilestone(ms.id)}
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>
                    </div>

                    {/* Accordion Checklist Panel */}
                    {isExpanded && (
                      <div style={{
                        padding: '0 20px 20px 20px',
                        borderTop: '1px solid rgba(255,255,255,0.03)',
                        backgroundColor: 'rgba(255,255,255,0.01)',
                        borderBottomLeftRadius: 'var(--border-radius-md)',
                        borderBottomRightRadius: 'var(--border-radius-md)'
                      }} className="animate-fade-in">
                        
                        <h5 style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-low)', letterSpacing: '0.06em', padding: '16px 0 8px 0', fontWeight: 700 }}>
                          Checklist des sous-tâches ({msSubtasks.filter(s => s.is_completed).length} / {msSubtasks.length})
                        </h5>

                        {msSubtasks.length === 0 ? (
                          <p style={{ fontSize: '0.78rem', color: 'var(--text-low)', fontStyle: 'italic', margin: '8px 0 16px 0' }}>
                            Aucune sous-tâche pour ce jalon. Ajoutez-en une ci-dessous pour démarrer.
                          </p>
                        ) : (
                          <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                            {msSubtasks.map(st => (
                              <li
                                key={st.id}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '8px 12px',
                                  borderRadius: 'var(--border-radius-sm)',
                                  backgroundColor: 'rgba(255,255,255,0.02)',
                                  border: '1px solid rgba(255,255,255,0.02)',
                                  transition: 'var(--transition-fast)'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}
                                onMouseOut={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.02)'}
                              >
                                <div
                                  onClick={() => toggleSubtask(st.id, !st.is_completed)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    cursor: 'pointer',
                                    color: st.is_completed ? 'var(--text-low)' : 'var(--text-high)',
                                    flexGrow: 1
                                  }}
                                >
                                  {st.is_completed ? (
                                    <CheckSquare size={16} style={{ color: 'var(--accent-success)' }} />
                                  ) : (
                                    <Square size={16} style={{ color: 'var(--text-low)' }} />
                                  )}
                                  <span style={{
                                    fontSize: '0.82rem',
                                    textDecoration: st.is_completed ? 'line-through' : 'none',
                                    transition: 'var(--transition-fast)'
                                  }}>
                                    {st.title}
                                  </span>
                                </div>
                                <button
                                  onClick={() => deleteSubtask(st.id)}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: '4px',
                                    color: 'var(--text-low)'
                                  }}
                                  onMouseOver={(e) => e.currentTarget.style.color = 'var(--accent-danger)'}
                                  onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-low)'}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}

                        {/* Inline Create Subtask Input form */}
                        <form onSubmit={(e) => handleAddSubtask(e, ms.id)} style={{ display: 'flex', gap: '8px' }}>
                          <input
                            type="text"
                            value={newSubtaskTitles[ms.id] || ''}
                            onChange={(e) => setNewSubtaskTitles(prev => ({ ...prev, [ms.id]: e.target.value }))}
                            placeholder="ex: Réserver le nom de domaine..."
                            style={{
                              flexGrow: 1,
                              backgroundColor: 'rgba(0,0,0,0.2)',
                              border: '1px solid var(--border-color)',
                              borderRadius: 'var(--border-radius-sm)',
                              padding: '8px 12px',
                              fontSize: '0.8rem',
                              color: '#ffffff',
                              outline: 'none',
                              transition: 'var(--transition-fast)'
                            }}
                            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                            onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                          />
                          <button
                            type="submit"
                            style={{
                              backgroundColor: 'var(--accent-primary)',
                              border: 'none',
                              borderRadius: 'var(--border-radius-sm)',
                              padding: '0 12px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: 'var(--shadow-neon-primary)'
                            }}
                          >
                            <Plus size={14} />
                          </button>
                        </form>

                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
