import React, { createContext, useContext, useState, useEffect } from 'react';
import type { FinalGoal, Milestone, Subtask, AiConfig, Habit, HabitLog } from '../types';
import { getSupabase, initSupabaseClient, getSupabaseConfig } from '../utils/supabaseClient';
import { getAiConfig, saveAiConfigInStorage } from '../utils/aiClient';
import type { User } from '@supabase/supabase-js';

interface GoalContextType {
  finalGoals: FinalGoal[];
  milestones: Milestone[];
  subtasks: Subtask[];
  habits: Habit[];
  habitLogs: HabitLog[];
  loading: boolean;
  isSupabaseConnected: boolean;
  supabaseConfig: { url: string; anonKey: string };
  aiConfig: AiConfig;
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  signup: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  // Final Goals CRUD
  addFinalGoal: (title: string, description: string, difficulty: number, targetDate: string, scoringFields?: Partial<FinalGoal>) => Promise<string>;
  updateFinalGoal: (id: string, updates: Partial<FinalGoal>) => Promise<void>;
  updateFinalGoalDate: (id: string, date: string) => Promise<void>;
  deleteFinalGoal: (id: string) => Promise<void>;
  // Milestones CRUD
  addMilestone: (finalGoalId: string, title: string, description: string, difficulty: number, targetDate: string, scoringFields?: Partial<Milestone>) => Promise<string>;
  updateMilestone: (id: string, updates: Partial<Milestone>) => Promise<void>;
  updateMilestoneDate: (id: string, date: string) => Promise<void>;
  deleteMilestone: (id: string) => Promise<void>;
  reorderMilestones: (finalGoalId: string, orderedMilestoneIds: string[]) => Promise<void>;
  // Subtasks CRUD
  addSubtask: (milestoneId: string, title: string) => Promise<void>;
  toggleSubtask: (id: string, isCompleted: boolean) => Promise<void>;
  deleteSubtask: (id: string) => Promise<void>;
  // Habits CRUD
  addHabit: (habitData: Omit<Habit, 'id' | 'created_at'>) => Promise<string>;
  deleteHabit: (id: string) => Promise<void>;
  toggleHabitLog: (habitId: string, date: string, currentStatus: 'done' | 'missed' | null) => Promise<void>;
  // Config & Demo Data
  saveSupabaseConfig: (url: string, key: string) => Promise<boolean>;
  saveAiConfig: (url: string, apiKey: string, model: string) => Promise<void>;
  clearDatabase: () => Promise<void>;
  loadDemoData: () => Promise<void>;
}

const GoalContext = createContext<GoalContextType | undefined>(undefined);

export const GoalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [finalGoals, setFinalGoals] = useState<FinalGoal[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
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

  const [authInitialized, setAuthInitialized] = useState<boolean>(false);

  // Check connection status & retrieve session
  useEffect(() => {
    const supabase = getSupabase();
    setIsSupabaseConnected(!!supabase);
    
    if (supabase) {
      // Get initial session
      supabase.auth.getSession().then(({ data: { session } }) => {
        setUser(session?.user ?? null);
        setAuthInitialized(true);
      }).catch(() => {
        setAuthInitialized(true);
      });

      // Listen to auth changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
        setAuthInitialized(true);
      });

      return () => subscription.unsubscribe();
    } else {
      setAuthInitialized(true);
    }
  }, [supabaseConfig.url, supabaseConfig.anonKey]);

  // Load data when connection or user state changes
  useEffect(() => {
    if (authInitialized) {
      loadAllData();
    }
  }, [isSupabaseConnected, user, authInitialized]);

  // Read data
  const loadAllData = async () => {
    setLoading(true);
    try {
      const supabase = getSupabase();

      if (supabase && user) {
        try {
          const userId = user.id;

          // Load deepseek settings from cloud profile
          try {
            const { data: profileData } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('user_id', userId)
              .maybeSingle();

            if (profileData) {
              const loadedAiConfig = {
                url: 'https://api.deepseek.com/v1',
                apiKey: profileData.ai_api_key || '',
                model: profileData.ai_model || 'deepseek-chat'
              };
              setAiConfig(loadedAiConfig);
              saveAiConfigInStorage(loadedAiConfig);
            }
          } catch (profileErr) {
            console.warn("User profile loading failed:", profileErr);
          }

          // Fetch from Supabase cloud (user-filtered)
          const { data: fgData, error: fgErr } = await supabase
            .from('final_goals')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

          const { data: hbData, error: hbErr } = await supabase
            .from('habits')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

          if (fgErr || hbErr) {
            throw new Error('Supabase fetch error');
          }

          let validFgData = fgData || [];
          let validHbData = hbData || [];

          // Migrate goals and habits independently to the cloud
          let migrated = false;

          const safeGetItem = (key: string) => {
            try {
              return localStorage.getItem(key);
            } catch (e) {
              console.warn("localStorage not accessible for migration:", key, e);
              return null;
            }
          };

          const safeParse = (str: string | null) => {
            if (!str) return [];
            try {
              return JSON.parse(str);
            } catch (e) {
              console.error("Failed to parse local JSON during migration:", e);
              return [];
            }
          };

          if (validFgData.length === 0) {
            const fgLocalStr = safeGetItem('fg_goals');
            const msLocalStr = safeGetItem('fg_milestones');
            const stLocalStr = safeGetItem('fg_subtasks');

            const localFg = safeParse(fgLocalStr);
            const localMs = safeParse(msLocalStr);
            const localSt = safeParse(stLocalStr);

            if (localFg.length > 0) {
              console.log("Migrating local storage goals to the cloud for user id:", userId);
              const goalsToUpload = localFg.map((g: any) => ({ ...g, user_id: userId }));
              await supabase.from('final_goals').insert(goalsToUpload);

              if (localMs.length > 0) {
                await supabase.from('milestones').insert(localMs);
              }
              if (localSt.length > 0) {
                await supabase.from('subtasks').insert(localSt);
              }
              migrated = true;
            }
          }

          if (validHbData.length === 0) {
            const hbLocalStr = safeGetItem('fg_habits');
            const hblLocalStr = safeGetItem('fg_habit_logs');

            const localHb = safeParse(hbLocalStr);
            const localHbl = safeParse(hblLocalStr);

            if (localHb.length > 0) {
              console.log("Migrating local storage habits to the cloud for user id:", userId);
              const habitsToUpload = localHb.map((h: any) => ({ ...h, user_id: userId }));
              await supabase.from('habits').insert(habitsToUpload);

              if (localHbl.length > 0) {
                await supabase.from('habit_logs').insert(localHbl);
              }
              migrated = true;
            }
          }

          if (migrated) {
            // Re-fetch since we just migrated!
            const { data: refetchedFg } = await supabase
              .from('final_goals')
              .select('*')
              .eq('user_id', userId)
              .order('created_at', { ascending: false });

            const { data: refetchedHb } = await supabase
              .from('habits')
              .select('*')
              .eq('user_id', userId)
              .order('created_at', { ascending: false });

            validFgData = refetchedFg || [];
            validHbData = refetchedHb || [];
          }

          // Fetch Milestones
          let msData: Milestone[] = [];
          const goalIds = validFgData.map(g => g.id);
          if (goalIds.length > 0) {
            const { data, error } = await supabase
              .from('milestones')
              .select('*')
              .in('final_goal_id', goalIds)
              .order('order_index', { ascending: true });
            if (error) throw error;
            msData = data || [];
          }

          // Fetch Subtasks
          let stData: Subtask[] = [];
          const msIds = msData.map(m => m.id);
          if (msIds.length > 0) {
            const { data, error } = await supabase
              .from('subtasks')
              .select('*')
              .in('milestone_id', msIds)
              .order('order_index', { ascending: true });
            if (error) throw error;
            stData = data || [];
          }

          // Fetch Habit Logs
          let hblData: HabitLog[] = [];
          const hbIds = validHbData.map(h => h.id);
          if (hbIds.length > 0) {
            const { data, error } = await supabase
              .from('habit_logs')
              .select('*')
              .in('habit_id', hbIds);
            if (error) throw error;
            hblData = data || [];
          }

          setFinalGoals(validFgData);
          setMilestones(msData);
          setSubtasks(stData);
          setHabits(validHbData);
          setHabitLogs(hblData);
        } catch (err) {
          console.error('Supabase failed, falling back to LocalStorage', err);
          loadFromLocalStorage();
        }
      } else {
        loadFromLocalStorage();
      }
    } catch (globalErr) {
      console.error('Global error in loadAllData:', globalErr);
      loadFromLocalStorage();
    } finally {
      setLoading(false);
    }
  };

  // Auth Operations
  const login = async (username: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Base de données non configurée.");

    const email = username.includes('@') ? username.trim() : `${username.trim().toLowerCase()}@planning.app`;
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    setUser(data.user);
  };

  const signup = async (username: string, password: string) => {
    const supabase = getSupabase();
    if (!supabase) throw new Error("Base de données non configurée.");

    const email = username.includes('@') ? username.trim() : `${username.trim().toLowerCase()}@planning.app`;
    
    // Sign up user
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) throw error;
    if (!data.user) throw new Error("Erreur lors de la création de l'utilisateur.");

    // Create user profile in profiles table
    try {
      await supabase
        .from('user_profiles')
        .insert({
          user_id: data.user.id,
          ai_api_key: '',
          ai_model: 'deepseek-chat'
        });
    } catch (profileErr) {
      console.warn("Could not create initial user profile in DB:", profileErr);
    }

    setUser(data.user);
  };

  const logout = async () => {
    const supabase = getSupabase();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setFinalGoals([]);
    setMilestones([]);
    setSubtasks([]);
    setHabits([]);
    setHabitLogs([]);
  };

  const loadFromLocalStorage = () => {
    try {
      const safeGet = (key: string) => {
        try {
          return localStorage.getItem(key);
        } catch (e) {
          console.warn("localStorage read failed for:", key, e);
          return null;
        }
      };

      const safeParse = (str: string | null) => {
        if (!str) return [];
        try {
          return JSON.parse(str);
        } catch (e) {
          console.error("Failed to parse JSON from localStorage:", e);
          return [];
        }
      };

      const fg = safeGet('fg_goals');
      const ms = safeGet('fg_milestones');
      const st = safeGet('fg_subtasks');
      const hb = safeGet('fg_habits');
      const hbl = safeGet('fg_habit_logs');

      setFinalGoals(safeParse(fg));
      setMilestones(safeParse(ms));
      setSubtasks(safeParse(st));
      setHabits(safeParse(hb));
      setHabitLogs(safeParse(hbl));
    } catch (err) {
      console.error("Critical fallback failure in loadFromLocalStorage:", err);
      setFinalGoals([]);
      setMilestones([]);
      setSubtasks([]);
      setHabits([]);
      setHabitLogs([]);
    }
  };

  // Sync to LocalStorage (helper for LS mode)
  const syncToLocalStorage = (fg: FinalGoal[], ms: Milestone[], st: Subtask[]) => {
    try {
      localStorage.setItem('fg_goals', JSON.stringify(fg));
      localStorage.setItem('fg_milestones', JSON.stringify(ms));
      localStorage.setItem('fg_subtasks', JSON.stringify(st));
    } catch (e) {
      console.warn("localStorage sync failed:", e);
    }
  };

  const syncHabitsToLocalStorage = (hbList: Habit[], hblList: HabitLog[]) => {
    try {
      localStorage.setItem('fg_habits', JSON.stringify(hbList));
      localStorage.setItem('fg_habit_logs', JSON.stringify(hblList));
    } catch (e) {
      console.warn("localStorage habits sync failed:", e);
    }
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
      priority: 'medium',
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
      points_relative,
      user_id: user?.id
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
      priority: 'medium',
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
      try {
        localStorage.removeItem('supabase_url');
        localStorage.removeItem('supabase_anon_key');
      } catch (e) {
        console.warn("localStorage not accessible to clear config:", e);
      }
      setSupabaseConfig({ url: '', anonKey: '' });
      setIsSupabaseConnected(false);
      loadFromLocalStorage();
      return true;
    }

    try {
      try {
        localStorage.setItem('supabase_url', url);
        localStorage.setItem('supabase_anon_key', key);
      } catch (e) {
        console.warn("localStorage not accessible to set config:", e);
      }
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
        created_at: new Date().toISOString(),
        priority: 'high'
      },
      {
        id: g2_id,
        title: "🌿 Marathon de Paris & Cardio Peak",
        description: "Préparation physique complète et complétion d'un marathon complet en moins de 4h.",
        difficulty: 4,
        target_date: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 4 mois
        status: 'pending',
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        priority: 'medium'
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
        created_at: new Date().toISOString(),
        priority: 'medium'
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
        created_at: new Date().toISOString(),
        priority: 'high'
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
        created_at: new Date().toISOString(),
        priority: 'medium'
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
        created_at: new Date().toISOString(),
        priority: 'medium'
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
        created_at: new Date().toISOString(),
        priority: 'high'
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

  const updateFinalGoalDate = async (id: string, date: string) => {
    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.from('final_goals').update({ target_date: date }).eq('id', id);
      if (error) throw error;
      setFinalGoals(prev => prev.map(g => g.id === id ? { ...g, target_date: date } : g));
    } else {
      const nextGoals = finalGoals.map(g => g.id === id ? { ...g, target_date: date } : g);
      setFinalGoals(nextGoals);
      syncToLocalStorage(nextGoals, milestones, subtasks);
    }
  };

  const updateMilestoneDate = async (id: string, date: string) => {
    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.from('milestones').update({ target_date: date }).eq('id', id);
      if (error) throw error;
      setMilestones(prev => prev.map(m => m.id === id ? { ...m, target_date: date } : m));
    } else {
      const nextMs = milestones.map(m => m.id === id ? { ...m, target_date: date } : m);
      setMilestones(nextMs);
      syncToLocalStorage(finalGoals, nextMs, subtasks);
    }
  };

  // --- HABITS CRUD ---
  const addHabit = async (habitData: Omit<Habit, 'id' | 'created_at'>) => {
    const newHabit: Habit = {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      ...habitData,
      user_id: user?.id
    };
    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.from('habits').insert(newHabit);
      if (error) throw error;
      setHabits(prev => [newHabit, ...prev]);
    } else {
      await new Promise(r => setTimeout(r, 100));
      const nextHabits = [newHabit, ...habits];
      setHabits(nextHabits);
      syncHabitsToLocalStorage(nextHabits, habitLogs);
    }
    return newHabit.id;
  };

  const deleteHabit = async (id: string) => {
    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.from('habits').delete().eq('id', id);
      if (error) throw error;
      setHabits(prev => prev.filter(h => h.id !== id));
      setHabitLogs(prev => prev.filter(l => l.habit_id !== id));
    } else {
      const nextHabits = habits.filter(h => h.id !== id);
      const nextLogs = habitLogs.filter(l => l.habit_id !== id);
      setHabits(nextHabits);
      setHabitLogs(nextLogs);
      syncHabitsToLocalStorage(nextHabits, nextLogs);
    }
  };

  const toggleHabitLog = async (habitId: string, date: string, currentStatus: 'done' | 'missed' | null) => {
    const nextStatus = currentStatus === null ? 'done' : currentStatus === 'done' ? 'missed' : null;
    const supabase = getSupabase();
    
    if (supabase) {
      if (nextStatus === null) {
        const { error } = await supabase.from('habit_logs').delete().eq('habit_id', habitId).eq('date', date);
        if (error) throw error;
        setHabitLogs(prev => prev.filter(l => !(l.habit_id === habitId && l.date === date)));
      } else {
        const newLog: HabitLog = { habit_id: habitId, date, status: nextStatus as 'done' | 'missed' };
        const { error } = await supabase.from('habit_logs').upsert(newLog);
        if (error) throw error;
        setHabitLogs(prev => {
          const filtered = prev.filter(l => !(l.habit_id === habitId && l.date === date));
          return [...filtered, newLog];
        });
      }
    } else {
      let nextLogs = [...habitLogs];
      if (nextStatus === null) {
        nextLogs = nextLogs.filter(l => !(l.habit_id === habitId && l.date === date));
      } else {
        const newLog: HabitLog = { habit_id: habitId, date, status: nextStatus as 'done' | 'missed' };
        const filtered = nextLogs.filter(l => !(l.habit_id === habitId && l.date === date));
        nextLogs = [...filtered, newLog];
      }
      setHabitLogs(nextLogs);
      syncHabitsToLocalStorage(habits, nextLogs);
    }
  };

  return (
    <GoalContext.Provider
      value={{
        finalGoals: computedFinalGoals,
        milestones: computedMilestones,
        subtasks,
        habits,
        habitLogs,
        loading: loading || !authInitialized,
        isSupabaseConnected,
        supabaseConfig,
        aiConfig,
        user,
        login,
        signup,
        logout,
        addFinalGoal,
        updateFinalGoal,
        updateFinalGoalDate,
        deleteFinalGoal,
        addMilestone,
        updateMilestone,
        updateMilestoneDate,
        deleteMilestone,
        reorderMilestones,
        addSubtask,
        toggleSubtask,
        deleteSubtask,
        addHabit,
        deleteHabit,
        toggleHabitLog,
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
