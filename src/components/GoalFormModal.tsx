import React, { useState, useEffect } from 'react';
import { useGoals } from '../context/GoalContext';
import type { FinalGoal, Milestone } from '../types';
import { Plus, X, AlertCircle } from 'lucide-react';

interface GoalFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'goal' | 'milestone';
  mode: 'create' | 'edit';
  goalToEdit?: FinalGoal | null;
  milestoneToEdit?: Milestone | null;
  parentId?: string | null; // finalGoalId when creating milestone
}

export const GoalFormModal: React.FC<GoalFormModalProps> = ({
  isOpen,
  onClose,
  type,
  mode,
  goalToEdit,
  milestoneToEdit,
  parentId
}) => {
  const { addFinalGoal, updateFinalGoal, addMilestone, updateMilestone } = useGoals();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState(3);
  const [targetDate, setTargetDate] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Prepopulate form if editing
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      if (mode === 'edit') {
        if (type === 'goal' && goalToEdit) {
          setTitle(goalToEdit.title);
          setDescription(goalToEdit.description);
          setDifficulty(goalToEdit.difficulty);
          setTargetDate(goalToEdit.target_date);
        } else if (type === 'milestone' && milestoneToEdit) {
          setTitle(milestoneToEdit.title);
          setDescription(milestoneToEdit.description);
          setDifficulty(milestoneToEdit.difficulty);
          setTargetDate(milestoneToEdit.target_date);
        }
      } else {
        // Create mode resets
        setTitle('');
        setDescription('');
        setDifficulty(3);
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 30); // 30 days from now default
        setTargetDate(defaultDate.toISOString().split('T')[0]);
      }
    }
  }, [isOpen, mode, type, goalToEdit, milestoneToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setErrorMsg('Le titre est requis.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (type === 'goal') {
        if (mode === 'create') {
          await addFinalGoal(trimmedTitle, description, difficulty, targetDate);
        } else if (mode === 'edit' && goalToEdit) {
          await updateFinalGoal(goalToEdit.id, {
            title: trimmedTitle,
            description,
            difficulty,
            target_date: targetDate
          });
        }
      } else if (type === 'milestone') {
        if (mode === 'create' && parentId) {
          await addMilestone(parentId, trimmedTitle, description, difficulty, targetDate);
        } else if (mode === 'edit' && milestoneToEdit) {
          await updateMilestone(milestoneToEdit.id, {
            title: trimmedTitle,
            description,
            difficulty,
            target_date: targetDate
          });
        }
      }
      onClose();
    } catch (err) {
      console.error(err);
      setErrorMsg("Une erreur s'est produite lors de la sauvegarde.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(3, 4, 8, 0.85)',
        backdropFilter: 'blur(12px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      className="animate-fade-in"
    >
      <div
        className="glass"
        style={{
          width: '100%',
          maxWidth: '520px',
          borderRadius: 'var(--border-radius-lg)',
          padding: '30px',
          animation: 'slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          position: 'relative'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
              {mode === 'create' ? 'Créer' : 'Modifier'} {type === 'goal' ? 'un Objectif Final' : 'un Jalon'}
            </h2>
            <p style={{ color: 'var(--text-med)', fontSize: '0.82rem', marginTop: '2px' }}>
              {type === 'goal'
                ? "Définissez la cible principale de votre projet"
                : "Planifiez une étape clé de votre progression"}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-med)',
              transition: 'var(--transition-fast)'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Title */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-med)', marginBottom: '6px' }}>
              Titre de {type === 'goal' ? "l'objectif" : "la milestone"}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={type === 'goal' ? "ex: Courir un Marathon..." : "ex: Trouver le plan d'entraînement..."}
              maxLength={70}
              required
              style={{
                width: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius-md)',
                padding: '12px 16px',
                fontSize: '0.9rem',
                outline: 'none',
                transition: 'var(--transition-fast)'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-med)', marginBottom: '6px' }}>
              Description / Détails
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez les critères de succès ou le contexte de cet élément..."
              rows={3}
              maxLength={200}
              style={{
                width: '100%',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius-md)',
                padding: '12px 16px',
                fontSize: '0.9rem',
                outline: 'none',
                resize: 'none',
                transition: 'var(--transition-fast)'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
            />
          </div>

          {/* Target Date & Difficulty Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            
            {/* Target Date */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-med)', marginBottom: '6px' }}>
                Date Cible
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--border-radius-md)',
                    padding: '12px 16px',
                    fontSize: '0.9rem',
                    outline: 'none',
                    colorScheme: 'dark' // standard dark calendar browser UI
                  }}
                />
              </div>
            </div>

            {/* Interactive Difficulty segment clicker */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-med)', marginBottom: '6px' }}>
                Niveau de Difficulté
              </label>
              <div style={{
                display: 'flex',
                height: '46px',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 12px',
                backgroundColor: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius-md)'
              }}>
                {[1, 2, 3, 4, 5].map((level) => {
                  const isActive = level <= difficulty;
                  let color = 'rgba(255,255,255,0.1)';
                  
                  if (isActive) {
                    if (difficulty === 1) color = 'var(--accent-success)';
                    else if (difficulty === 2) color = 'var(--accent-secondary)';
                    else if (difficulty === 3) color = 'var(--accent-warning)';
                    else if (difficulty === 4) color = 'var(--accent-primary)';
                    else color = 'var(--accent-danger)';
                  }

                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setDifficulty(level)}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: color,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        color: isActive ? '#ffffff' : 'var(--text-low)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        boxShadow: isActive ? `0 0 10px ${color}` : 'none'
                      }}
                      onMouseOver={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)';
                      }}
                      onMouseOut={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.02)';
                      }}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {errorMsg && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.8rem',
              color: 'var(--accent-danger)',
              padding: '6px'
            }}>
              <AlertCircle size={14} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                backgroundColor: 'transparent',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--border-radius-md)',
                padding: '12px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                color: 'var(--text-high)',
                transition: 'var(--transition-fast)'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                flex: 2,
                backgroundColor: 'var(--accent-primary)',
                border: 'none',
                borderRadius: 'var(--border-radius-md)',
                padding: '12px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'var(--transition-fast)',
                boxShadow: 'var(--shadow-neon-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
              onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.15)'}
              onMouseOut={(e) => e.currentTarget.style.filter = 'none'}
            >
              {isSubmitting ? (
                <div style={{
                  width: '16px',
                  height: '16px',
                  border: '2px solid rgba(255,255,255,0.2)',
                  borderTopColor: '#ffffff',
                  borderRadius: '50%',
                  animation: 'spin-slow 0.6s linear infinite'
                }} />
              ) : (
                <Plus size={16} />
              )}
              <span>Sauvegarder</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
