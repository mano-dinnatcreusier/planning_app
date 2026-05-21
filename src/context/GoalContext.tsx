import React, { createContext, useContext, useState, useEffect } from 'react';
import type { FinalGoal, Milestone, Subtask, AiConfig } from '../types';
import { getSupabase, initSupabaseClient, getSupabaseConfig } from '../utils/supabaseClient';
import { getAiConfig, saveAiConfigInStorage } from '../utils/aiClient';

interface GoalContextType {
  finalGoals: FinalGoal[];
  milestones: Milestone[];
  subtasks: Subtask[];
  loading: boolean;
  isSupabaseConnected: boolean;
  supabaseConfig: { url: string; anonKey: string };
  aiConfig: AiConfig;
  // Final Goals CRUD
  addFinalGoal: (title: string, description: string, difficulty: number, targetDate: string, scoringFields?: Partial<FinalGoal>) => Promise<string>;
  updateFinalGoal: (id: string, updates: Partial<FinalGoal>) => Promise<void>;
  deleteFinalGoal: (id: string) => Promise<void>;
  // Milestones CRUD
  addMilestone: (finalGoalId: string, title: string, description: string, difficulty: number, targetDate: string, scoringFields?: Partial<Milestone>) => Promise<string>;
  updateMilestone: (id: string, updates: Partial<Milestone>) => Promise<void>;
  deleteMilestone: (id: string) => Promise<void>;
  reorderMilestones: (finalGoalId: string, orderedMilestoneIds: string[]) => Promise<void>;
  // Subtasks CRUD
  addSubtask: (milestoneId: string, title: string) => Promise<void>;
  toggleSubtask: (id: string, isCompleted: boolean) => Promise<void>;
  deleteSubtask: (id: string) => Promise<void>;
  // Config & Demo Data
  saveSupabaseConfig: (url: string, key: string) => Promise<boolean>;
  saveAiConfig: (url: string, apiKey: string, model: string) => Promise<void>;
  clearDatabase: () => Promise<void>;
  loadDemoData: () => Promise<void>;
}

const GoalContext = createContext<GoalContextType | undefined>(undefined);

export const GoalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [finalGoals, setFinalGoals] = useState<FinalGoal[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState<boolean>(false);
  const [supabaseConfig, setSupabaseConfig] = useState(getSupabaseConfig());
  const [aiConfig, setAiConfig] = useState(getAiConfig());

  // Points helper calculations
  const calculateFinalGoalPoints = (goal: Partial<FinalGoal>) => {
    const h = goal.est_hours ?? 10;
    const d = goal.perceived_difficulty ?? goal.difficulty ?? 3;
    const cPub = goal.coeff_public ?? 1.5;
    const cPers = goal.coeff_personal ?? 1.0;
    const points_absolute = Math.round(h * d * cPub * 10);
    const points_relative = Math.round(points_absolute * cPers);
    return { points_absolute, points_relative };
  };

  const calculateMilestonePoints = (ms: Partial<Milestone>, parentGoal?: FinalGoal) => {
    const h = ms.est_hours ?? 2;
    const d = ms.perceived_difficulty ?? ms.difficulty ?? 3;
    const cPub = parentGoal?.coeff_public ?? 1.5;
    const cPers = parentGoal?.coeff_personal ?? 1.0;
    const points_absolute = Math.round(h * d * cPub * 10);
    const points_relative = Math.round(points_absolute * cPers);
    return { points_absolute, points_relative };
  };

  // Check connection status
  useEffect(() => {
    const supabase = getSupabase();
    setIsSupabaseConnected(!!supabase);
    loadAllData();
  }, [supabaseConfig.url, supabaseConfig.anonKey]);

  // Read data
  const loadAllData = async () => {
    setLoading(true);
    const supabase = getSupabase();

    if (supabase) {
      try {
        // Fetch from Supabase
        const { data: fgData, error: fgErr } = await supabase.from('final_goals').select('*').order('created_at', { ascending: false });
        const { data: msData, error: msErr } = await supabase.from('milestones').select('*').order('order_index', { ascending: true });
        const { data: stData, error: stErr } = await supabase.from('subtasks').select('*').order('order_index', { ascending: true });

        if (fgErr || msErr || stErr) {
          throw new Error('Supabase fetch error');
        }

        setFinalGoals(fgData || []);
        setMilestones(msData || []);
        setSubtasks(stData || []);
      } catch (err) {
        console.error('Supabase failed, falling back to LocalStorage', err);
        loadFromLocalStorage();
      }
    } else {
      loadFromLocalStorage();
    }
    setLoading(false);
  };

  const loadFromLocalStorage = () => {
    const fg = localStorage.getItem('fg_goals');
    const ms = localStorage.getItem('fg_milestones');
    const st = localStorage.getItem('fg_subtasks');

    setFinalGoals(fg ? JSON.parse(fg) : []);
    setMilestones(ms ? JSON.parse(ms) : []);
    setSubtasks(st ? JSON.parse(st) : []);
  };

  // Sync to LocalStorage (helper for LS mode)
  const syncToLocalStorage = (fg: FinalGoal[], ms: Milestone[], st: Subtask[]) => {
    localStorage.setItem('fg_goals', JSON.stringify(fg));
    localStorage.setItem('fg_milestones', JSON.stringify(ms));
    localStorage.setItem('fg_subtasks', JSON.stringify(st));
  };

  // Helper dynamic calculations
  const getComputedMilestones = (rawMilestones: Milestone[], rawSubtasks: Subtask[]) => {
    return rawMilestones.map(ms => {
      const msSubtasks = rawSubtasks.filter(st => st.milestone_id === ms.id);
      if (msSubtasks.length === 0) {
        // Binary progress based on status if no subtasks
        const progress = ms.status === 'completed' ? 100 : 0;
        return { ...ms, progress };
      }
      const completed = msSubtasks.filter(st => st.is_completed).length;
      const progress = Math.round((completed / msSubtasks.length) * 100);
      return { ...ms, progress };
    });
  };

  const getComputedFinalGoals = (rawGoals: FinalGoal[], computedMs: Milestone[]) => {
    return rawGoals.map(goal => {
      const goalMs = computedMs.filter(ms => ms.final_goal_id === goal.id);
      if (goalMs.length === 0) {
        const progress = goal.status === 'completed' ? 100 : 0;
        return { ...goal, progress };
      }

      // Progression is the average of milestones progression, weighted by milestone difficulty
      let totalWeight = 0;
      let totalProgressWeighted = 0;

      goalMs.forEach(ms => {
        const progress = ms.progress || 0;
        const weight = ms.difficulty || 1;
        totalProgressWeighted += progress * weight;
        totalWeight += weight;
      });

      const progress = totalWeight > 0 ? Math.round(totalProgressWeighted / totalWeight) : 0;
      
      // Auto-update status based on progress for polished UX
      let status = goal.status;
      if (progress === 100) {
        status = 'completed';
      } else if (progress > 0) {
        status = 'in_progress';
      }

      return { ...goal, progress, status };
    });
  };

  // Live computed states for rendering
  const computedMilestones = getComputedMilestones(milestones, subtasks);
  const computedFinalGoals = getComputedFinalGoals(finalGoals, computedMilestones);

  // --- FINAL GOALS CRUD ---
  const addFinalGoal = async (
    title: string,
    description: string,
    difficulty: number,
    targetDate: string,
    scoringFields?: Partial<FinalGoal>
  ) => {
    const baseGoal: Partial<FinalGoal> = {
      est_hours: 10,
      perceived_difficulty: difficulty,
      coeff_public: 1.5,
      coeff_personal: 1.0,
      user_start_context: '',
      ai_explanation: '',
      ...scoringFields
    };
    const { points_absolute, points_relative } = calculateFinalGoalPoints(baseGoal);

    const newGoal: FinalGoal = {
      id: crypto.randomUUID(),
      title,
      description,
      difficulty,
      target_date: targetDate || new Date().toISOString().split('T')[0],
      status: 'pending',
      created_at: new Date().toISOString(),
      ...baseGoal,
      points_absolute,
      points_relative
    };

    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.from('final_goals').insert(newGoal);
      if (error) throw error;
      setFinalGoals(prev => [newGoal, ...prev]);
    } else {
      // LocalStorage mode with realistic micro-loading
      await new Promise(r => setTimeout(r, 150));
      const nextGoals = [newGoal, ...finalGoals];
      setFinalGoals(nextGoals);
      syncToLocalStorage(nextGoals, milestones, subtasks);
    }
    return newGoal.id;
  };

  const updateFinalGoal = async (id: string, updates: Partial<FinalGoal>) => {
    const current = finalGoals.find(g => g.id === id);
    let finalUpdates = { ...updates };
    
    if (
      updates.est_hours !== undefined ||
      updates.perceived_difficulty !== undefined ||
      updates.coeff_public !== undefined ||
      updates.coeff_personal !== undefined ||
      updates.difficulty !== undefined
    ) {
      const merged = { ...current, ...updates };
      const { points_absolute, points_relative } = calculateFinalGoalPoints(merged);
      finalUpdates = { ...finalUpdates, points_absolute, points_relative };
    }

    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.from('final_goals').update(finalUpdates).eq('id', id);
      if (error) throw error;
      setFinalGoals(prev => prev.map(g => g.id === id ? { ...g, ...finalUpdates } : g));
    } else {
      const nextGoals = finalGoals.map(g => g.id === id ? { ...g, ...finalUpdates } : g);
      setFinalGoals(nextGoals);
      syncToLocalStorage(nextGoals, milestones, subtasks);
    }
  };

  const deleteFinalGoal = async (id: string) => {
    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.from('final_goals').delete().eq('id', id);
      if (error) throw error;
      setFinalGoals(prev => prev.filter(g => g.id !== id));
      setMilestones(prev => prev.filter(m => m.final_goal_id !== id));
      // Cascade delete subtasks
      const msIdsToDelete = milestones.filter(m => m.final_goal_id === id).map(m => m.id);
      setSubtasks(prev => prev.filter(s => !msIdsToDelete.includes(s.milestone_id)));
    } else {
      const nextGoals = finalGoals.filter(g => g.id !== id);
      const nextMilestones = milestones.filter(m => m.final_goal_id !== id);
      const msIdsToDelete = milestones.filter(m => m.final_goal_id === id).map(m => m.id);
      const nextSubtasks = subtasks.filter(s => !msIdsToDelete.includes(s.milestone_id));

      setFinalGoals(nextGoals);
      setMilestones(nextMilestones);
      setSubtasks(nextSubtasks);
      syncToLocalStorage(nextGoals, nextMilestones, nextSubtasks);
    }
  };

  // --- MILESTONES CRUD ---
  const addMilestone = async (
    finalGoalId: string,
    title: string,
    description: string,
    difficulty: number,
    targetDate: string,
    scoringFields?: Partial<Milestone>
  ) => {
    const parentGoal = finalGoals.find(g => g.id === finalGoalId);
    const baseMs: Partial<Milestone> = {
      est_hours: 2,
      perceived_difficulty: difficulty,
      ...scoringFields
    };
    const { points_absolute, points_relative } = calculateMilestonePoints(baseMs, parentGoal);

    const goalMs = milestones.filter(m => m.final_goal_id === finalGoalId);
    const newMs: Milestone = {
      id: crypto.randomUUID(),
      final_goal_id: finalGoalId,
      title,
      description,
      difficulty,
      order_index: goalMs.length,
      target_date: targetDate || new Date().toISOString().split('T')[0],
      status: 'pending',
      created_at: new Date().toISOString(),
      ...baseMs,
      points_absolute,
      points_relative
    };

    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.from('milestones').insert(newMs);
      if (error) throw error;
      setMilestones(prev => [...prev, newMs]);
    } else {
      await new Promise(r => setTimeout(r, 150));
      const nextMs = [...milestones, newMs];
      setMilestones(nextMs);
      syncToLocalStorage(finalGoals, nextMs, subtasks);
    }
    return newMs.id;
  };

  const updateMilestone = async (id: string, updates: Partial<Milestone>) => {
    const current = milestones.find(m => m.id === id);
    const parentGoal = finalGoals.find(g => g.id === (updates.final_goal_id || current?.final_goal_id));
    let finalUpdates = { ...updates };

    if (
      updates.est_hours !== undefined ||
      updates.perceived_difficulty !== undefined ||
      updates.difficulty !== undefined
    ) {
      const merged = { ...current, ...updates };
      const { points_absolute, points_relative } = calculateMilestonePoints(merged, parentGoal);
      finalUpdates = { ...finalUpdates, points_absolute, points_relative };
    }

    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.from('milestones').update(finalUpdates).eq('id', id);
      if (error) throw error;
      setMilestones(prev => prev.map(m => m.id === id ? { ...m, ...finalUpdates } : m));
    } else {
      const nextMs = milestones.map(m => m.id === id ? { ...m, ...finalUpdates } : m);
      setMilestones(nextMs);
      syncToLocalStorage(finalGoals, nextMs, subtasks);
    }
  };

  const deleteMilestone = async (id: string) => {
    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.from('milestones').delete().eq('id', id);
      if (error) throw error;
      setMilestones(prev => prev.filter(m => m.id !== id));
      setSubtasks(prev => prev.filter(s => s.milestone_id !== id));
    } else {
      const nextMs = milestones.filter(m => m.id !== id);
      const nextSubtasks = subtasks.filter(s => s.milestone_id !== id);
      setMilestones(nextMs);
      setSubtasks(nextSubtasks);
      syncToLocalStorage(finalGoals, nextMs, nextSubtasks);
    }
  };

  const reorderMilestones = async (finalGoalId: string, orderedMilestoneIds: string[]) => {
    const supabase = getSupabase();
    if (supabase) {
      try {
        const promises = orderedMilestoneIds.map((id, index) => 
          supabase.from('milestones').update({ order_index: index }).eq('id', id)
        );
        await Promise.all(promises);
        setMilestones(prev => {
          const unaffected = prev.filter(m => m.final_goal_id !== finalGoalId);
          const affected = prev.filter(m => m.final_goal_id === finalGoalId);
          const reordered = orderedMilestoneIds.map((id, index) => {
            const m = affected.find(x => x.id === id)!;
            return { ...m, order_index: index };
          });
          return [...unaffected, ...reordered].sort((a, b) => a.order_index - b.order_index);
        });
      } catch (err) {
        console.error('Failed to reorder milestones in database', err);
      }
    } else {
      const nextMs = milestones.map(m => {
        if (m.final_goal_id === finalGoalId) {
          const idx = orderedMilestoneIds.indexOf(m.id);
          return { ...m, order_index: idx !== -1 ? idx : m.order_index };
        }
        return m;
      }).sort((a, b) => {
        if (a.final_goal_id === b.final_goal_id && a.final_goal_id === finalGoalId) {
          return a.order_index - b.order_index;
        }
        return 0;
      });

      setMilestones(nextMs);
      syncToLocalStorage(finalGoals, nextMs, subtasks);
    }
  };

  // --- SUBTASKS CRUD ---
  const addSubtask = async (milestoneId: string, title: string) => {
    const msSubtasks = subtasks.filter(s => s.milestone_id === milestoneId);
    const newSt: Subtask = {
      id: crypto.randomUUID(),
      milestone_id: milestoneId,
      title,
      is_completed: false,
      order_index: msSubtasks.length,
      created_at: new Date().toISOString()
    };

    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.from('subtasks').insert(newSt);
      if (error) throw error;
      setSubtasks(prev => [...prev, newSt]);
    } else {
      const nextSt = [...subtasks, newSt];
      setSubtasks(nextSt);
      syncToLocalStorage(finalGoals, milestones, nextSt);
    }
  };

  const toggleSubtask = async (id: string, isCompleted: boolean) => {
    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.from('subtasks').update({ is_completed: isCompleted }).eq('id', id);
      if (error) throw error;
      setSubtasks(prev => prev.map(s => s.id === id ? { ...s, is_completed: isCompleted } : s));
    } else {
      const nextSt = subtasks.map(s => s.id === id ? { ...s, is_completed: isCompleted } : s);
      setSubtasks(nextSt);
      
      // Auto-update status of parent milestone for beautiful interactivity
      const targetSubtask = subtasks.find(s => s.id === id)!;
      const milestoneId = targetSubtask.milestone_id;
      const siblings = nextSt.filter(s => s.milestone_id === milestoneId);
      const allCompleted = siblings.every(s => s.is_completed);
      const someCompleted = siblings.some(s => s.is_completed);
      
      let status: 'pending' | 'in_progress' | 'completed' = 'pending';
      if (allCompleted) {
        status = 'completed';
      } else if (someCompleted) {
        status = 'in_progress';
      }

      const nextMs = milestones.map(m => m.id === milestoneId ? { ...m, status } : m);
      setMilestones(nextMs);
      
      syncToLocalStorage(finalGoals, nextMs, nextSt);
    }
  };

  const deleteSubtask = async (id: string) => {
    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.from('subtasks').delete().eq('id', id);
      if (error) throw error;
      setSubtasks(prev => prev.filter(s => s.id !== id));
    } else {
      const nextSt = subtasks.filter(s => s.id !== id);
      setSubtasks(nextSt);
      syncToLocalStorage(finalGoals, milestones, nextSt);
    }
  };

  // --- CONFIG & DEMO DATA ---
  const saveSupabaseConfig = async (url: string, key: string): Promise<boolean> => {
    if (!url || !key) {
      localStorage.removeItem('supabase_url');
      localStorage.removeItem('supabase_anon_key');
      setSupabaseConfig({ url: '', anonKey: '' });
      setIsSupabaseConnected(false);
      loadFromLocalStorage();
      return true;
    }

    try {
      localStorage.setItem('supabase_url', url);
      localStorage.setItem('supabase_anon_key', key);
      const client = initSupabaseClient(url, key);
      
      if (client) {
        setSupabaseConfig({ url, anonKey: key });
        setIsSupabaseConnected(true);
        // Trigger actual fetch from the newly configured database
        setLoading(true);
        const { data: fgData, error: fgErr } = await client.from('final_goals').select('*').order('created_at', { ascending: false });
        const { data: msData, error: msErr } = await client.from('milestones').select('*').order('order_index', { ascending: true });
        const { data: stData, error: stErr } = await client.from('subtasks').select('*').order('order_index', { ascending: true });

        if (fgErr || msErr || stErr) {
          throw new Error('Supabase fetch failed on save');
        }

        setFinalGoals(fgData || []);
        setMilestones(msData || []);
        setSubtasks(stData || []);
        setLoading(false);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to apply Supabase config:', err);
      setLoading(false);
      return false;
    }
  };

  const clearDatabase = async () => {
    setLoading(true);
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('final_goals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        setFinalGoals([]);
        setMilestones([]);
        setSubtasks([]);
      } catch (err) {
        console.error('Supabase clear failed', err);
      }
    } else {
      setFinalGoals([]);
      setMilestones([]);
      setSubtasks([]);
      syncToLocalStorage([], [], []);
    }
    setLoading(false);
  };

  const loadDemoData = async () => {
    setLoading(true);
    const g1_id = crypto.randomUUID();
    const g2_id = crypto.randomUUID();

    // 1. Goals
    const demoGoals: FinalGoal[] = [
      {
        id: g1_id,
        title: "🚀 Lancer mon SaaS (Indie hacking)",
        description: "Créer, valider et lancer un produit SaaS rentable en solo d'ici la fin de l'année.",
        difficulty: 5,
        target_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 6 mois
        status: 'in_progress',
        created_at: new Date().toISOString()
      },
      {
        id: g2_id,
        title: "🌿 Marathon de Paris & Cardio Peak",
        description: "Préparation physique complète et complétion d'un marathon complet en moins de 4h.",
        difficulty: 4,
        target_date: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 4 mois
        status: 'pending',
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    // 2. Milestones
    const m1_id = crypto.randomUUID();
    const m2_id = crypto.randomUUID();
    const m3_id = crypto.randomUUID();
    const m4_id = crypto.randomUUID();
    const m5_id = crypto.randomUUID();

    const demoMilestones: Milestone[] = [
      {
        id: m1_id,
        final_goal_id: g1_id,
        title: "🎯 Étape 1 : MVP & Validation d'idée",
        description: "Création d'une landing page simple et recueil de 100 emails d'utilisateurs intéressés.",
        difficulty: 3,
        order_index: 0,
        target_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'completed',
        created_at: new Date().toISOString()
      },
      {
        id: m2_id,
        final_goal_id: g1_id,
        title: "💻 Étape 2 : Développement du Core",
        description: "Coder le produit fonctionnel minimal, incluant l'authentification et les fonctionnalités cœur.",
        difficulty: 5,
        order_index: 1,
        target_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'in_progress',
        created_at: new Date().toISOString()
      },
      {
        id: m3_id,
        final_goal_id: g1_id,
        title: "💰 Étape 3 : Paiement & Marketing",
        description: "Intégration de Stripe pour le paiement récurrent et lancement de la beta fermée.",
        difficulty: 4,
        order_index: 2,
        target_date: new Date(Date.now() + 75 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pending',
        created_at: new Date().toISOString()
      },
      {
        id: m4_id,
        final_goal_id: g2_id,
        title: "🏃‍♂️ Étape 1 : Reprise et Endurance",
        description: "Atteindre 15km de course continue à allure stable sans fatigue critique.",
        difficulty: 2,
        order_index: 0,
        target_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'in_progress',
        created_at: new Date().toISOString()
      },
      {
        id: m5_id,
        final_goal_id: g2_id,
        title: "🏁 Étape 2 : Semi-Marathon Test",
        description: "Courir un semi-marathon officiel à allure cible (5:30 min/km).",
        difficulty: 4,
        order_index: 1,
        target_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'pending',
        created_at: new Date().toISOString()
      }
    ];

    // 3. Subtasks
    const demoSubtasks: Subtask[] = [
      // M1 Subtasks
      { id: crypto.randomUUID(), milestone_id: m1_id, title: "Lister 3 idées de micro-SaaS", is_completed: true, order_index: 0, created_at: new Date().toISOString() },
      { id: crypto.randomUUID(), milestone_id: m1_id, title: "Designer le mockup Figma (1 page)", is_completed: true, order_index: 1, created_at: new Date().toISOString() },
      { id: crypto.randomUUID(), milestone_id: m1_id, title: "Déployer la landing page de pré-inscription", is_completed: true, order_index: 2, created_at: new Date().toISOString() },
      { id: crypto.randomUUID(), milestone_id: m1_id, title: "Atteindre 100 inscrits via X / LinkedIn", is_completed: true, order_index: 3, created_at: new Date().toISOString() },
      
      // M2 Subtasks
      { id: crypto.randomUUID(), milestone_id: m2_id, title: "Configurer le projet Vite React + TS", is_completed: true, order_index: 0, created_at: new Date().toISOString() },
      { id: crypto.randomUUID(), milestone_id: m2_id, title: "Mettre en place la base de données Supabase", is_completed: true, order_index: 1, created_at: new Date().toISOString() },
      { id: crypto.randomUUID(), milestone_id: m2_id, title: "Développer le dashboard principal", is_completed: false, order_index: 2, created_at: new Date().toISOString() },
      { id: crypto.randomUUID(), milestone_id: m2_id, title: "Créer le tunnel d'authentification", is_completed: false, order_index: 3, created_at: new Date().toISOString() },
      
      // M3 Subtasks
      { id: crypto.randomUUID(), milestone_id: m3_id, title: "Créer un compte Stripe officiel", is_completed: false, order_index: 0, created_at: new Date().toISOString() },
      { id: crypto.randomUUID(), milestone_id: m3_id, title: "Créer le webhook Supabase / Stripe", is_completed: false, order_index: 1, created_at: new Date().toISOString() },
      { id: crypto.randomUUID(), milestone_id: m3_id, title: "Inviter 10 utilisateurs beta à tester le produit", is_completed: false, order_index: 2, created_at: new Date().toISOString() },

      // M4 Subtasks
      { id: crypto.randomUUID(), milestone_id: m4_id, title: "Acheter des chaussures de course adaptées", is_completed: true, order_index: 0, created_at: new Date().toISOString() },
      { id: crypto.randomUUID(), milestone_id: m4_id, title: "Faire 3 sorties de 8km par semaine", is_completed: true, order_index: 1, created_at: new Date().toISOString() },
      { id: crypto.randomUUID(), milestone_id: m4_id, title: "Faire une sortie longue de 15km", is_completed: false, order_index: 2, created_at: new Date().toISOString() }
    ];

    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('final_goals').insert(demoGoals);
        await supabase.from('milestones').insert(demoMilestones);
        await supabase.from('subtasks').insert(demoSubtasks);
        setFinalGoals(demoGoals);
        setMilestones(demoMilestones);
        setSubtasks(demoSubtasks);
      } catch (err) {
        console.error('Failed to seed Supabase, seeding LocalStorage', err);
        setFinalGoals(demoGoals);
        setMilestones(demoMilestones);
        setSubtasks(demoSubtasks);
        syncToLocalStorage(demoGoals, demoMilestones, demoSubtasks);
      }
    } else {
      await new Promise(r => setTimeout(r, 200));
      setFinalGoals(demoGoals);
      setMilestones(demoMilestones);
      setSubtasks(demoSubtasks);
      syncToLocalStorage(demoGoals, demoMilestones, demoSubtasks);
    }
    setLoading(false);
  };

  const saveAiConfig = async (url: string, apiKey: string, model: string) => {
    const config = { url, apiKey, model };
    saveAiConfigInStorage(config);
    setAiConfig(config);
  };

  return (
    <GoalContext.Provider
      value={{
        finalGoals: computedFinalGoals,
        milestones: computedMilestones,
        subtasks,
        loading,
        isSupabaseConnected,
        supabaseConfig,
        aiConfig,
        addFinalGoal,
        updateFinalGoal,
        deleteFinalGoal,
        addMilestone,
        updateMilestone,
        deleteMilestone,
        reorderMilestones,
        addSubtask,
        toggleSubtask,
        deleteSubtask,
        saveSupabaseConfig,
        saveAiConfig,
        clearDatabase,
        loadDemoData
      }}
    >
      {children}
    </GoalContext.Provider>
  );
};

export const useGoals = () => {
  const context = useContext(GoalContext);
  if (context === undefined) {
    throw new Error('useGoals must be used within a GoalProvider');
  }
  return context;
};
