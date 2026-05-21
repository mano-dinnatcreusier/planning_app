import React, { useState, useEffect } from 'react';
import { useGoals } from '../context/GoalContext';
import type { FinalGoal, Milestone } from '../types';
import { Plus, X, AlertCircle, Sparkles, Trash2, HelpCircle } from 'lucide-react';
import { evaluateGoalViaAi, suggestSubtasksViaAi } from '../utils/aiClient';

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
  const { addFinalGoal, updateFinalGoal, addMilestone, updateMilestone, aiConfig, addSubtask } = useGoals();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState(3);
  const [targetDate, setTargetDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Points & AI scoring states
  const [estHours, setEstHours] = useState(type === 'goal' ? 10 : 2);
  const [perceivedDifficulty, setPerceivedDifficulty] = useState(3);
  const [coeffPublic, setCoeffPublic] = useState(1.5);
  const [coeffPersonal, setCoeffPersonal] = useState(1.0);
  const [userStartContext, setUserStartContext] = useState('');
  const [aiExplanation, setAiExplanation] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [generatedSubtaskTitles, setGeneratedSubtaskTitles] = useState<string[]>([]);
  const [tempSubtaskInput, setTempSubtaskInput] = useState('');

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
          setPriority(goalToEdit.priority ?? 'medium');
          setEstHours(goalToEdit.est_hours ?? 10);
          setPerceivedDifficulty(goalToEdit.perceived_difficulty ?? goalToEdit.difficulty);
          setCoeffPublic(goalToEdit.coeff_public ?? 1.5);
          setCoeffPersonal(goalToEdit.coeff_personal ?? 1.0);
          setUserStartContext(goalToEdit.user_start_context ?? '');
          setAiExplanation(goalToEdit.ai_explanation ?? '');
          setGeneratedSubtaskTitles([]);
        } else if (type === 'milestone' && milestoneToEdit) {
          setTitle(milestoneToEdit.title);
          setDescription(milestoneToEdit.description);
          setDifficulty(milestoneToEdit.difficulty);
          setTargetDate(milestoneToEdit.target_date);
          setPriority(milestoneToEdit.priority ?? 'medium');
          setEstHours(milestoneToEdit.est_hours ?? 2);
          setPerceivedDifficulty(milestoneToEdit.perceived_difficulty ?? milestoneToEdit.difficulty);
          setGeneratedSubtaskTitles([]);
        }
      } else {
        // Create mode resets
        setTitle('');
        setDescription('');
        setDifficulty(3);
        const defaultDate = new Date();
        defaultDate.setDate(defaultDate.getDate() + 30); // 30 days from now default
        setTargetDate(defaultDate.toISOString().split('T')[0]);
        setPriority('medium');
        setEstHours(type === 'goal' ? 10 : 2);
        setPerceivedDifficulty(3);
        setCoeffPublic(1.5);
        setCoeffPersonal(1.0);
        setUserStartContext('');
        setAiExplanation('');
        setGeneratedSubtaskTitles([]);
        setTempSubtaskInput('');
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
          await addFinalGoal(trimmedTitle, description, difficulty, targetDate, {
            est_hours: estHours,
            perceived_difficulty: perceivedDifficulty,
            coeff_public: coeffPublic,
            coeff_personal: coeffPersonal,
            user_start_context: userStartContext,
            ai_explanation: aiExplanation,
            priority
          });
        } else if (mode === 'edit' && goalToEdit) {
          await updateFinalGoal(goalToEdit.id, {
            title: trimmedTitle,
            description,
            difficulty,
            target_date: targetDate,
            est_hours: estHours,
            perceived_difficulty: perceivedDifficulty,
            coeff_public: coeffPublic,
            coeff_personal: coeffPersonal,
            user_start_context: userStartContext,
            ai_explanation: aiExplanation,
            priority
          });
        }
      } else if (type === 'milestone') {
        if (mode === 'create' && parentId) {
          const msId = await addMilestone(parentId, trimmedTitle, description, difficulty, targetDate, {
            est_hours: estHours,
            perceived_difficulty: perceivedDifficulty,
            priority
          });
          // Auto create suggested subtasks
          if (generatedSubtaskTitles.length > 0) {
            for (const subtaskTitle of generatedSubtaskTitles) {
              await addSubtask(msId, subtaskTitle);
            }
          }
        } else if (mode === 'edit' && milestoneToEdit) {
          await updateMilestone(milestoneToEdit.id, {
            title: trimmedTitle,
            description,
            difficulty,
            target_date: targetDate,
            est_hours: estHours,
            perceived_difficulty: perceivedDifficulty,
            priority
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
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '40px 20px',
        overflowY: 'auto'
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
          position: 'relative',
          marginBottom: '20px'
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

          {/* Target Date & Est Hours Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Target Date */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-med)', marginBottom: '6px' }}>
                Date Cible
              </label>
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
                  color: '#ffffff',
                  colorScheme: 'dark'
                }}
              />
            </div>

            {/* Est Hours */}
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-med)', marginBottom: '6px' }}>
                Heures Estimées ({estHours}h)
              </label>
              <input
                type="number"
                min={1}
                max={5000}
                value={estHours}
                onChange={(e) => setEstHours(Math.max(1, Number(e.target.value)))}
                required
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--border-radius-md)',
                  padding: '12px 16px',
                  fontSize: '0.9rem',
                  outline: 'none',
                  color: '#ffffff'
                }}
              />
            </div>
          </div>

          {/* Niveau de Priorité */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-med)', marginBottom: '8px' }}>
              Niveau de Priorité
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.02)',
              padding: '6px',
              borderRadius: 'var(--border-radius-md)',
              border: '1px solid var(--border-color)'
            }}>
              {(['low', 'medium', 'high'] as const).map((p) => {
                const isSelected = priority === p;
                const label = p === 'low' ? '❄️ Basse' : p === 'medium' ? '⚡ Moyenne' : '🔥 Haute';
                
                const activeColor = 
                  p === 'low' ? '#38bdf8' : 
                  p === 'medium' ? 'var(--accent-warning)' : 
                  'var(--accent-danger)';
                
                const activeBg = 
                  p === 'low' ? 'rgba(56, 189, 248, 0.12)' : 
                  p === 'medium' ? 'rgba(234, 179, 8, 0.12)' : 
                  'rgba(244, 63, 94, 0.12)';

                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    style={{
                      padding: '10px',
                      borderRadius: 'var(--border-radius-sm)',
                      border: '1px solid ' + (isSelected ? activeColor : 'transparent'),
                      backgroundColor: isSelected ? activeBg : 'transparent',
                      color: isSelected ? '#ffffff' : 'var(--text-med)',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: isSelected ? 700 : 500,
                      transition: 'var(--transition-fast)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      boxShadow: isSelected ? `0 0 10px ${activeBg}` : 'none'
                    }}
                    onMouseOver={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
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
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* User Starting Context (Goal Only) */}
          {type === 'goal' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-med)', marginBottom: '6px' }}>
                Situation de départ / Contexte personnel
              </label>
              <textarea
                value={userStartContext}
                onChange={(e) => setUserStartContext(e.target.value)}
                placeholder="Ex: Jamais couru (grand débutant), OU déjà bon niveau mais reprise..."
                rows={2}
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
                  color: '#ffffff',
                  transition: 'var(--transition-fast)'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
              />
            </div>
          )}

          {/* AI Helper trigger button */}
          {type === 'goal' && aiConfig.apiKey && (
            <div style={{ marginTop: '5px' }}>
              <button
                type="button"
                onClick={async () => {
                  if (!title.trim()) {
                    setErrorMsg('Veuillez saisir un titre avant d\'évaluer avec l\'IA.');
                    return;
                  }
                  setIsAiLoading(true);
                  setErrorMsg('');
                  try {
                    const result = await evaluateGoalViaAi(
                      title,
                      description,
                      estHours,
                      perceivedDifficulty,
                      userStartContext,
                      aiConfig
                    );
                    setCoeffPublic(result.coeff_public);
                    setCoeffPersonal(result.coeff_personal);
                    setAiExplanation(
                      `🌍 ${result.explanation_public}\n👤 ${result.explanation_personal}`
                    );
                  } catch (err: any) {
                    setErrorMsg(err.message || 'Échec de la connexion IA.');
                  } finally {
                    setIsAiLoading(false);
                  }
                }}
                disabled={isAiLoading}
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(168, 85, 247, 0.1)',
                  border: '1px solid var(--accent-primary)',
                  color: 'var(--accent-primary)',
                  borderRadius: 'var(--border-radius-md)',
                  padding: '10px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 0 10px rgba(168, 85, 247, 0.1)'
                }}
              >
                <Sparkles size={16} className={isAiLoading ? 'animate-spin' : ''} />
                {isAiLoading ? 'Évaluation IA en cours...' : 'Évaluer & Calibrer via l\'IA'}
              </button>
            </div>
          )}

          {/* AI Subtasks trigger (Milestone Only) */}
          {type === 'milestone' && aiConfig.apiKey && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={async () => {
                  if (!title.trim()) {
                    setErrorMsg('Saisissez le titre de l\'étape avant de générer.');
                    return;
                  }
                  setIsAiLoading(true);
                  setErrorMsg('');
                  try {
                    const subtasks = await suggestSubtasksViaAi(title, description, aiConfig);
                    setGeneratedSubtaskTitles(subtasks);
                  } catch (err: any) {
                    setErrorMsg(err.message || 'Échec de la génération de sous-tâches.');
                  } finally {
                    setIsAiLoading(false);
                  }
                }}
                disabled={isAiLoading}
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(14, 165, 233, 0.1)',
                  border: '1px solid var(--accent-secondary)',
                  color: 'var(--accent-secondary)',
                  borderRadius: 'var(--border-radius-md)',
                  padding: '10px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <Sparkles size={16} />
                {isAiLoading ? 'Génération de tâches...' : 'Suggérer des sous-tâches via l\'IA'}
              </button>

              {generatedSubtaskTitles.length > 0 && (
                <div style={{
                  marginTop: '4px',
                  backgroundColor: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--border-radius-md)',
                  padding: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h5 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-secondary)' }}>
                      Tâches suggérées ({generatedSubtaskTitles.length})
                    </h5>
                    <button
                      type="button"
                      onClick={() => setGeneratedSubtaskTitles([])}
                      style={{ background: 'transparent', border: 'none', color: 'var(--accent-danger)', fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      Effacer tout
                    </button>
                  </div>
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingLeft: 0, listStyle: 'none', margin: 0 }}>
                    {generatedSubtaskTitles.map((st, idx) => (
                      <li key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        backgroundColor: 'rgba(255,255,255,0.02)',
                        padding: '6px 10px',
                        borderRadius: 'var(--border-radius-sm)',
                        fontSize: '0.8rem'
                      }}>
                        <span style={{ color: '#ffffff' }}>{st}</span>
                        <button
                          type="button"
                          onClick={() => setGeneratedSubtaskTitles(prev => prev.filter((_, i) => i !== idx))}
                          style={{ background: 'transparent', border: 'none', color: 'var(--text-low)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </li>
                    ))}
                  </ul>
                  
                  {/* Temp subtask input */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <input
                      type="text"
                      value={tempSubtaskInput}
                      onChange={(e) => setTempSubtaskInput(e.target.value)}
                      placeholder="Ajouter une tâche manuelle..."
                      style={{
                        flex: 1,
                        backgroundColor: 'rgba(255,255,255,0.01)',
                        border: '1px solid var(--border-color)',
                        borderRadius: 'var(--border-radius-sm)',
                        padding: '6px 10px',
                        fontSize: '0.78rem',
                        color: '#ffffff'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (tempSubtaskInput.trim()) {
                          setGeneratedSubtaskTitles(prev => [...prev, tempSubtaskInput.trim()]);
                          setTempSubtaskInput('');
                        }
                      }}
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        border: '1px solid var(--border-color)',
                        padding: '6px 10px',
                        borderRadius: 'var(--border-radius-sm)',
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                        color: '#ffffff'
                      }}
                    >
                      Ajouter
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Points Calibrator Section */}
          <div style={{
            backgroundColor: 'rgba(255,255,255,0.01)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--border-radius-lg)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Calibrage des Points XP</span>
              <span style={{
                fontSize: '0.72rem',
                backgroundColor: 'rgba(168, 85, 247, 0.1)',
                color: 'var(--accent-primary)',
                padding: '2px 8px',
                borderRadius: '10px',
                fontWeight: 600
              }}>
                Formule Active
              </span>
            </div>

            {/* Perceived Difficulty Selector */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-med)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Difficulté Perçue
                  <span title="Votre sensation d'effort sur une échelle de 1 à 5." style={{ display: 'inline-flex', alignItems: 'center', cursor: 'help' }}>
                    <HelpCircle size={12} />
                  </span>
                </label>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-warning)' }}>{perceivedDifficulty} / 5</span>
              </div>
              <input
                type="range"
                min={1}
                max={5}
                value={perceivedDifficulty}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setPerceivedDifficulty(val);
                  setDifficulty(val); // Sync back to the base model difficulty too
                }}
                style={{ width: '100%', accentColor: 'var(--accent-warning)' }}
              />
            </div>

            {type === 'goal' && (
              <>
                {/* Public Coefficient */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-med)' }}>
                      🌍 Coefficient Public (Rareté globale)
                    </label>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-primary)' }}>x{coeffPublic.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={1.0}
                    max={3.0}
                    step={0.1}
                    value={coeffPublic}
                    onChange={(e) => setCoeffPublic(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-low)', marginTop: '2px' }}>
                    <span>1.0 (Simple)</span>
                    <span>2.0 (Difficile)</span>
                    <span>3.0 (Monde-Classe)</span>
                  </div>
                </div>

                {/* Personal Coefficient */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '0.8rem', color: 'var(--text-med)' }}>
                      👤 Coefficient Personnel (Ajustement situation)
                    </label>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--accent-secondary)' }}>x{coeffPersonal.toFixed(2)}</span>
                  </div>
                  <input
                    type="range"
                    min={0.2}
                    max={3.0}
                    step={0.1}
                    value={coeffPersonal}
                    onChange={(e) => setCoeffPersonal(Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--accent-secondary)' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: 'var(--text-low)', marginTop: '2px' }}>
                    <span>0.5 (Pro/Expert)</span>
                    <span>1.0 (Normal)</span>
                    <span>3.0 (Énorme Défi Perso)</span>
                  </div>
                </div>
              </>
            )}

            {/* Live Point Counter Visualizer */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-around',
              alignItems: 'center',
              backgroundColor: 'rgba(0,0,0,0.2)',
              borderRadius: 'var(--border-radius-md)',
              padding: '12px',
              border: '1px solid rgba(255,255,255,0.02)',
              marginTop: '4px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-low)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Points Absolus</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-primary)', marginTop: '2px' }}>
                  {Math.round(estHours * perceivedDifficulty * coeffPublic * 10)} XP
                </div>
              </div>
              
              {type === 'goal' && (
                <>
                  <div style={{ height: '30px', width: '1px', backgroundColor: 'rgba(255,255,255,0.05)' }} />
                  
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-low)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Points Relatifs</div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--accent-secondary)', marginTop: '2px' }}>
                      {Math.round(estHours * perceivedDifficulty * coeffPublic * 10 * coeffPersonal)} XP
                    </div>
                  </div>
                </>
              )}
            </div>
            
            {/* AI explanation card */}
            {type === 'goal' && aiExplanation && (
              <div style={{
                fontSize: '0.75rem',
                color: 'var(--text-med)',
                backgroundColor: 'rgba(168, 85, 247, 0.03)',
                border: '1px dashed rgba(168, 85, 247, 0.2)',
                borderRadius: 'var(--border-radius-sm)',
                padding: '10px',
                lineHeight: 1.4,
                whiteSpace: 'pre-wrap'
              }}>
                {aiExplanation}
              </div>
            )}
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
