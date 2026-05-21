import React, { useState } from 'react';
import { useGoals } from '../context/GoalContext';
import { suggestHabitViaAi } from '../utils/aiClient';
import type { HabitSuggestionResult } from '../utils/aiClient';
import { 
  Activity, 
  Sparkles, 
  Trash2, 
  Calendar, 
  Target, 
  Check, 
  X, 
  Plus, 
  Clock
} from 'lucide-react';

export const HabitsView: React.FC = () => {
  const { 
    finalGoals, 
    habits, 
    habitLogs, 
    addHabit, 
    deleteHabit, 
    aiConfig 
  } = useGoals();

  // Tab controls inside creation panel
  const [creationMode, setCreationMode] = useState<'manual' | 'ai'>('manual');

  // Manual Habit Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [endDate, setEndDate] = useState('');
  const [frequencyType, setFrequencyType] = useState<'daily' | 'weekly' | 'custom'>('daily');
  const [customDays, setCustomDays] = useState(3);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // AI Suggestion State
  const [aiSelectedGoals, setAiSelectedGoals] = useState<string[]>([]);
  const [aiFrequencyPref, setAiFrequencyPref] = useState<'daily' | 'weekly' | 'custom' | 'ia'>('ia');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<HabitSuggestionResult | null>(null);

  // Form Submissions
  const handleCreateHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!title.trim()) {
      setErrorMsg('Veuillez donner un titre à votre habitude.');
      return;
    }
    if (!endDate) {
      setErrorMsg('Veuillez définir une date de fin.');
      return;
    }

    try {
      await addHabit({
        title: title.trim(),
        description: description.trim() || undefined,
        start_date: new Date().toISOString().split('T')[0],
        end_date: endDate,
        frequency_type: frequencyType,
        custom_days_per_week: frequencyType === 'custom' ? customDays : undefined,
        goal_ids: selectedGoals
      });

      setSuccessMsg('Habitude créée avec succès ! Retrouvez-la sur votre calendrier.');
      setTitle('');
      setDescription('');
      setEndDate('');
      setFrequencyType('daily');
      setSelectedGoals([]);
      
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la création de l\'habitude.');
    }
  };

  const handleGenerateAiHabit = async () => {
    setErrorMsg('');
    setAiSuggestion(null);

    if (aiSelectedGoals.length === 0) {
      setErrorMsg('Veuillez lier au moins un objectif pour guider l\'IA.');
      return;
    }

    setIsAiLoading(true);
    try {
      const selectedTitles = finalGoals
        .filter(g => aiSelectedGoals.includes(g.id))
        .map(g => g.title);

      const suggestion = await suggestHabitViaAi(selectedTitles, aiFrequencyPref, aiConfig);
      setAiSuggestion(suggestion);
    } catch (err: any) {
      setErrorMsg(err.message || 'Échec de la génération IA.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAcceptAiHabit = async () => {
    if (!aiSuggestion) return;
    setErrorMsg('');
    setSuccessMsg('');

    try {
      // Calculate a realistic default end date (e.g. 30 days from now)
      const date = new Date();
      date.setDate(date.getDate() + 30);
      const defaultEndDate = date.toISOString().split('T')[0];

      await addHabit({
        title: aiSuggestion.title,
        description: aiSuggestion.description,
        start_date: new Date().toISOString().split('T')[0],
        end_date: defaultEndDate,
        frequency_type: aiSuggestion.frequency_type,
        custom_days_per_week: aiSuggestion.custom_days_per_week || undefined,
        goal_ids: aiSelectedGoals
      });

      setSuccessMsg(`Habitude "${aiSuggestion.title}" ajoutée avec succès pour 30 jours !`);
      setAiSuggestion(null);
      setAiSelectedGoals([]);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de la création de l\'habitude.');
    }
  };

  // Toggle goal selection helper
  const toggleGoalSelection = (goalId: string) => {
    setSelectedGoals(prev => 
      prev.includes(goalId) ? prev.filter(id => id !== goalId) : [...prev, goalId]
    );
  };

  const toggleAiGoalSelection = (goalId: string) => {
    setAiSelectedGoals(prev => 
      prev.includes(goalId) ? prev.filter(id => id !== goalId) : [...prev, goalId]
    );
  };

  // Compliance calculations for Habits List
  const getHabitStats = (habitId: string) => {
    const logs = habitLogs.filter(l => l.habit_id === habitId);
    const doneCount = logs.filter(l => l.status === 'done').length;
    const missedCount = logs.filter(l => l.status === 'missed').length;
    const totalLogged = doneCount + missedCount;
    const compliance = totalLogged > 0 ? Math.round((doneCount / totalLogged) * 100) : 100;
    return { doneCount, missedCount, compliance };
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Habits Header Title */}
      <div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Activity style={{ color: 'var(--accent-primary)' }} />
          Suivi des Habitudes
        </h1>
        <p style={{ color: 'var(--text-med)', fontSize: '0.95rem' }}>
          Créez des routines récurrentes et améliorez votre taux de réussite RPG au quotidien.
        </p>
      </div>

      {/* Grid Layout */}
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        
        {/* LEFT PANEL: Active Habits List (Flex 60%) */}
        <div style={{ flex: '1 1 58%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 4px 0', color: '#ffffff' }}>
            Mes Routines Actives ({habits.length})
          </h2>

          {habits.length === 0 ? (
            <div className="glass" style={{ borderRadius: 'var(--border-radius-lg)', padding: '40px', textAlign: 'center', color: 'var(--text-low)' }}>
              <Clock size={40} style={{ color: 'var(--text-low)', marginBottom: '12px', opacity: 0.5 }} />
              <p style={{ fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>Aucune habitude en cours.</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-low)', marginTop: '4px' }}>
                Créez une routine manuellement ou utilisez notre assistant IA à droite pour commencer !
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {habits.map(h => {
                const { doneCount, missedCount, compliance } = getHabitStats(h.id);
                
                // SVG Progress Circle math
                const radius = 24;
                const circumference = 2 * Math.PI * radius;
                const strokeDashoffset = circumference - (compliance / 100) * circumference;

                // Color based on compliance rate
                const ringColor = compliance >= 80 
                  ? '#10b981' // Green
                  : compliance >= 50 
                    ? '#f59e0b' // Yellow
                    : '#ef4444'; // Red

                return (
                  <div 
                    key={h.id} 
                    className="glass-interactive" 
                    style={{ 
                      borderRadius: 'var(--border-radius-lg)', 
                      padding: '20px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      gap: '16px',
                      border: '1px solid var(--border-color)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Left: Info details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#ffffff' }}>
                            {h.title}
                          </span>
                          
                          {/* Frequency Tag */}
                          <span style={{ 
                            fontSize: '0.62rem', 
                            fontWeight: 700, 
                            backgroundColor: 'rgba(255,255,255,0.03)', 
                            border: '1px solid var(--border-color)',
                            color: 'var(--text-med)',
                            padding: '1px 6px',
                            borderRadius: '4px'
                          }}>
                            {h.frequency_type === 'daily' 
                              ? '🔄 Quotidien' 
                              : h.frequency_type === 'weekly' 
                                ? '📅 Hebdomadaire' 
                                : `📅 ${h.custom_days_per_week}j / semaine`}
                          </span>
                        </div>
                        {h.description && (
                          <p style={{ color: 'var(--text-med)', fontSize: '0.82rem', margin: '4px 0 0 0', lineHeight: 1.3 }}>
                            {h.description}
                          </p>
                        )}
                      </div>

                      {/* Dates range */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-low)' }}>
                        <Calendar size={12} />
                        <span>Du {new Date(h.start_date).toLocaleDateString('fr-FR')} au {new Date(h.end_date).toLocaleDateString('fr-FR')}</span>
                      </div>

                      {/* Connected Goals badges */}
                      {h.goal_ids && h.goal_ids.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                          {h.goal_ids.map(gid => {
                            const goal = finalGoals.find(g => g.id === gid);
                            if (!goal) return null;
                            return (
                              <span 
                                key={gid} 
                                style={{ 
                                  fontSize: '0.62rem', 
                                  fontWeight: 600, 
                                  backgroundColor: 'rgba(168, 85, 247, 0.05)', 
                                  border: '1px solid rgba(168, 85, 247, 0.15)',
                                  color: 'var(--accent-primary)',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px'
                                }}
                              >
                                <Target size={8} />
                                {goal.title}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Right: Circle progress ring & actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                      
                      {/* RPG Tracker Ring */}
                      <div style={{ position: 'relative', width: '56px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title={`Taux de réussite : ${compliance}%`}>
                        <svg width="56" height="56" viewBox="0 0 56 56" style={{ transform: 'rotate(-90deg)', position: 'absolute' }}>
                          {/* Background ring */}
                          <circle
                            cx="28"
                            cy="28"
                            r={radius}
                            fill="transparent"
                            stroke="rgba(255,255,255,0.02)"
                            strokeWidth="4"
                          />
                          {/* Colored ring */}
                          <circle
                            cx="28"
                            cy="28"
                            r={radius}
                            fill="transparent"
                            stroke={ringColor}
                            strokeWidth="4"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            style={{ transition: 'stroke-dashoffset 0.3s ease' }}
                          />
                        </svg>
                        <div style={{ fontSize: '0.78rem', fontWeight: 800, color: ringColor }}>
                          {compliance}%
                        </div>
                      </div>

                      {/* Mini Log Stats breakdown */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.7rem', color: 'var(--text-low)', minWidth: '60px' }}>
                        <span style={{ color: 'var(--accent-success)' }}>🟢 Fait: {doneCount}</span>
                        <span style={{ color: '#f43f5e' }}>🔴 Raté: {missedCount}</span>
                      </div>

                      {/* Delete Routine Button */}
                      <button
                        onClick={() => {
                          if (window.confirm('Voulez-vous supprimer cette routine ? Tout votre historique de validation sera effacé.')) {
                            deleteHabit(h.id);
                          }
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-low)',
                          cursor: 'pointer',
                          padding: '8px',
                          borderRadius: 'var(--border-radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'var(--transition-fast)'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.color = '#f43f5e';
                          e.currentTarget.style.backgroundColor = 'rgba(244,63,94,0.06)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.color = 'var(--text-low)';
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        title="Supprimer la routine"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Creation & AI Assistant Form (Flex 35%) */}
        <div style={{ flex: '1 1 35%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Panel Selector Mode Header */}
          <div style={{
            display: 'flex',
            backgroundColor: 'rgba(255,255,255,0.01)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--border-radius-lg)',
            padding: '4px'
          }}>
            <button
              onClick={() => {
                setCreationMode('manual');
                setErrorMsg('');
              }}
              style={{
                flex: 1,
                background: creationMode === 'manual' ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--border-radius-md)',
                padding: '10px',
                fontSize: '0.8rem',
                fontWeight: creationMode === 'manual' ? 700 : 500,
                color: creationMode === 'manual' ? '#ffffff' : 'var(--text-med)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'var(--transition-fast)'
              }}
            >
              <Plus size={14} />
              Manuel
            </button>
            
            {aiConfig.apiKey && (
              <button
                onClick={() => {
                  setCreationMode('ai');
                  setErrorMsg('');
                }}
                style={{
                  flex: 1,
                  background: creationMode === 'ai' ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                  border: 'none',
                  borderRadius: 'var(--border-radius-md)',
                  padding: '10px',
                  fontSize: '0.8rem',
                  fontWeight: creationMode === 'ai' ? 700 : 500,
                  color: creationMode === 'ai' ? '#ffffff' : 'var(--text-med)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'var(--transition-fast)'
                }}
              >
                <Sparkles size={14} style={{ color: 'var(--accent-primary)' }} />
                Conseils IA
              </button>
            )}
          </div>

          {/* Form Content container */}
          <div className="glass" style={{ borderRadius: 'var(--border-radius-lg)', padding: '24px' }}>
            
            {/* Error or Success banners */}
            {errorMsg && (
              <div style={{ 
                backgroundColor: 'rgba(244,63,94,0.08)', 
                border: '1px solid rgba(244,63,94,0.2)', 
                color: '#fca5a5', 
                borderRadius: 'var(--border-radius-md)', 
                padding: '12px', 
                fontSize: '0.78rem',
                marginBottom: '16px' 
              }}>
                ⚠️ {errorMsg}
              </div>
            )}
            
            {successMsg && (
              <div style={{ 
                backgroundColor: 'rgba(16,185,129,0.08)', 
                border: '1px solid rgba(16,185,129,0.2)', 
                color: '#a7f3d0', 
                borderRadius: 'var(--border-radius-md)', 
                padding: '12px', 
                fontSize: '0.78rem',
                marginBottom: '16px' 
              }}>
                ✔️ {successMsg}
              </div>
            )}

            {/* MANUAL FORM RENDER */}
            {creationMode === 'manual' && (
              <form onSubmit={handleCreateHabit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 4px 0', color: '#ffffff' }}>
                  Créer une Habitude
                </h3>

                {/* Title input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-med)' }}>Titre de l'habitude</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex: Lire 20 pages, Boire 2L d'eau..."
                    style={{
                      width: '100%',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--border-radius-md)',
                      padding: '10px 12px',
                      fontSize: '0.82rem',
                      color: '#ffffff',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Description input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-med)' }}>Description / Consignes</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Détaillez votre routine quotidienne ou hebdomadaire..."
                    rows={3}
                    style={{
                      width: '100%',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--border-radius-md)',
                      padding: '10px 12px',
                      fontSize: '0.82rem',
                      color: '#ffffff',
                      outline: 'none',
                      resize: 'none'
                    }}
                  />
                </div>

                {/* End Date input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-med)' }}>Date de fin</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={{
                      width: '100%',
                      backgroundColor: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--border-radius-md)',
                      padding: '10px 12px',
                      fontSize: '0.82rem',
                      color: '#ffffff',
                      outline: 'none'
                    }}
                  />
                </div>

                {/* Frequency picker */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-med)' }}>Fréquence</label>
                  <div style={{
                    display: 'flex',
                    backgroundColor: 'rgba(255,255,255,0.01)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--border-radius-md)',
                    padding: '2px'
                  }}>
                    {(['daily', 'weekly', 'custom'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFrequencyType(type)}
                        style={{
                          flex: 1,
                          background: frequencyType === type ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                          border: 'none',
                          borderRadius: 'var(--border-radius-sm)',
                          padding: '8px',
                          fontSize: '0.72rem',
                          fontWeight: frequencyType === type ? 700 : 500,
                          color: frequencyType === type ? '#ffffff' : 'var(--text-med)',
                          cursor: 'pointer'
                        }}
                      >
                        {type === 'daily' ? 'Journalier' : type === 'weekly' ? 'Hebdo' : 'Perso'}
                      </button>
                    ))}
                  </div>

                  {/* Custom frequency parameters */}
                  {frequencyType === 'custom' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
                      <input 
                        type="range" 
                        min="1" 
                        max="6" 
                        value={customDays} 
                        onChange={(e) => setCustomDays(Number(e.target.value))}
                        style={{ flex: 1, accentColor: 'var(--accent-primary)' }}
                      />
                      <span style={{ fontSize: '0.78rem', color: '#ffffff', minWidth: '40px', textAlign: 'right' }}>
                        {customDays}j / sem
                      </span>
                    </div>
                  )}
                </div>

                {/* Linked Goals List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-med)' }}>Associer à des objectifs</label>
                  {finalGoals.length === 0 ? (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-low)' }}>Aucun objectif créé pour le moment.</span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto', paddingRight: '4px' }}>
                      {finalGoals.map(g => (
                        <label 
                          key={g.id} 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            fontSize: '0.76rem', 
                            color: '#ffffff', 
                            cursor: 'pointer',
                            padding: '6px 8px',
                            backgroundColor: selectedGoals.includes(g.id) ? 'rgba(168, 85, 247, 0.04)' : 'transparent',
                            borderRadius: '4px',
                            border: '1px solid',
                            borderColor: selectedGoals.includes(g.id) ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                            transition: 'var(--transition-fast)'
                          }}
                        >
                          <input 
                            type="checkbox"
                            checked={selectedGoals.includes(g.id)}
                            onChange={() => toggleGoalSelection(g.id)}
                            style={{ accentColor: 'var(--accent-primary)' }}
                          />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {g.title}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Create Habit button */}
                <button
                  type="submit"
                  style={{
                    backgroundColor: 'var(--accent-primary)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 'var(--border-radius-md)',
                    padding: '10px 14px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: 'var(--shadow-neon-primary)',
                    marginTop: '10px',
                    transition: 'var(--transition-fast)'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.15)'}
                  onMouseOut={(e) => e.currentTarget.style.filter = 'none'}
                >
                  <Plus size={14} />
                  Enregistrer l'Habitude
                </button>
              </form>
            )}

            {/* AI ASSISTANT PANEL RENDER */}
            {creationMode === 'ai' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} style={{ color: 'var(--accent-primary)' }} />
                    Générateur d'Habitude IA
                  </h3>
                  <p style={{ fontSize: '0.72rem', color: 'var(--text-low)', marginTop: '2px', lineHeight: 1.3 }}>
                    Sélectionnez vos objectifs et laissez le coach IA vous calibrer la routine parfaite.
                  </p>
                </div>

                {/* AI Linked Goals */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-med)' }}>Associer aux objectifs</label>
                  {finalGoals.length === 0 ? (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-low)' }}>Aucun objectif créé pour le moment.</span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto', paddingRight: '4px' }}>
                      {finalGoals.map(g => (
                        <label 
                          key={g.id} 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            fontSize: '0.76rem', 
                            color: '#ffffff', 
                            cursor: 'pointer',
                            padding: '6px 8px',
                            backgroundColor: aiSelectedGoals.includes(g.id) ? 'rgba(168, 85, 247, 0.04)' : 'transparent',
                            borderRadius: '4px',
                            border: '1px solid',
                            borderColor: aiSelectedGoals.includes(g.id) ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                            transition: 'var(--transition-fast)'
                          }}
                        >
                          <input 
                            type="checkbox"
                            checked={aiSelectedGoals.includes(g.id)}
                            onChange={() => toggleAiGoalSelection(g.id)}
                            style={{ accentColor: 'var(--accent-primary)' }}
                          />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {g.title}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* AI Frequency Preference */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-med)' }}>Fréquence Souhaitée</label>
                  <div style={{
                    display: 'flex',
                    backgroundColor: 'rgba(255,255,255,0.01)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--border-radius-md)',
                    padding: '2px'
                  }}>
                    {(['daily', 'weekly', 'custom', 'ia'] as const).map((pref) => (
                      <button
                        key={pref}
                        onClick={() => setAiFrequencyPref(pref)}
                        style={{
                          flex: 1,
                          background: aiFrequencyPref === pref ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                          border: 'none',
                          borderRadius: 'var(--border-radius-sm)',
                          padding: '8px',
                          fontSize: '0.7rem',
                          fontWeight: aiFrequencyPref === pref ? 700 : 500,
                          color: aiFrequencyPref === pref ? '#ffffff' : 'var(--text-med)',
                          cursor: 'pointer',
                          textTransform: 'uppercase'
                        }}
                      >
                        {pref === 'daily' ? 'Jour' : pref === 'weekly' ? 'Hebdo' : pref === 'custom' ? 'Perso' : '🤖 IA'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Run Generator Button */}
                <button
                  type="button"
                  disabled={isAiLoading}
                  onClick={handleGenerateAiHabit}
                  style={{
                    backgroundColor: 'rgba(168, 85, 247, 0.1)',
                    color: 'var(--accent-primary)',
                    border: '1px solid var(--accent-primary)',
                    borderRadius: 'var(--border-radius-md)',
                    padding: '10px 14px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    marginTop: '10px',
                    transition: 'var(--transition-fast)'
                  }}
                  onMouseOver={(e) => {
                    if (!isAiLoading) {
                      e.currentTarget.style.backgroundColor = 'var(--accent-primary)';
                      e.currentTarget.style.color = '#ffffff';
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isAiLoading) {
                      e.currentTarget.style.backgroundColor = 'rgba(168, 85, 247, 0.1)';
                      e.currentTarget.style.color = 'var(--accent-primary)';
                    }
                  }}
                >
                  <Sparkles size={14} className={isAiLoading ? 'animate-spin' : ''} />
                  {isAiLoading ? 'Coaching IA en cours...' : '🚀 Suggérer une Habitude'}
                </button>

                {/* AI SUGGESTION DISPLAY CARD */}
                {aiSuggestion && (
                  <div 
                    style={{ 
                      marginTop: '16px',
                      backgroundColor: 'rgba(168, 85, 247, 0.03)',
                      border: '1px dashed var(--accent-primary)',
                      borderRadius: 'var(--border-radius-md)',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.62rem', fontWeight: 800, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        PROPOSITION COOPERATIVE IA
                      </span>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '2px 0 0 0', color: '#ffffff' }}>
                        {aiSuggestion.title}
                      </h4>
                      <span style={{ 
                        fontSize: '0.58rem', 
                        fontWeight: 700, 
                        backgroundColor: 'rgba(255,255,255,0.03)',
                        padding: '1px 5px',
                        borderRadius: '3px',
                        color: 'var(--text-low)',
                        display: 'inline-block',
                        marginTop: '4px'
                      }}>
                        {aiSuggestion.frequency_type === 'daily' 
                          ? '🔄 Quotidienne' 
                          : aiSuggestion.frequency_type === 'weekly' 
                            ? '📅 Hebdomadaire' 
                            : `📅 ${aiSuggestion.custom_days_per_week}j / semaine`}
                      </span>
                    </div>

                    <p style={{ fontSize: '0.78rem', color: 'var(--text-med)', margin: 0, lineHeight: 1.3 }}>
                      {aiSuggestion.description}
                    </p>

                    <div style={{ 
                      borderTop: '1px solid rgba(255,255,255,0.05)', 
                      paddingTop: '8px', 
                      fontSize: '0.72rem', 
                      color: 'var(--text-low)', 
                      fontStyle: 'italic',
                      lineHeight: 1.3
                    }}>
                      💡 <strong>Pourquoi cette routine ?</strong> {aiSuggestion.explanation}
                    </div>

                    {/* Accept/Decline action buttons */}
                    <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                      <button
                        onClick={handleAcceptAiHabit}
                        style={{
                          flex: 1,
                          backgroundColor: '#10b981',
                          color: '#ffffff',
                          border: 'none',
                          borderRadius: 'var(--border-radius-sm)',
                          padding: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                      >
                        <Check size={12} />
                        Accepter
                      </button>
                      <button
                        onClick={() => setAiSuggestion(null)}
                        style={{
                          flex: 1,
                          backgroundColor: 'rgba(255, 255, 255, 0.02)',
                          color: 'var(--text-med)',
                          border: '1px solid var(--border-color)',
                          borderRadius: 'var(--border-radius-sm)',
                          padding: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '4px'
                        }}
                      >
                        <X size={12} />
                        Refuser
                      </button>
                    </div>

                  </div>
                )}

              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
};
