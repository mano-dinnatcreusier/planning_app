export interface FinalGoal {
  id: string;
  title: string;
  description: string;
  difficulty: number; // 1 to 5
  target_date: string; // YYYY-MM-DD
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  progress?: number; // Calculated dynamic field (0-100)
  priority?: 'low' | 'medium' | 'high';
  
  // Points System Fields
  est_hours?: number;
  perceived_difficulty?: number;
  coeff_public?: number;
  coeff_personal?: number;
  points_absolute?: number;
  points_relative?: number;
  user_start_context?: string;
  ai_explanation?: string;
  user_id?: string;
}

export interface Milestone {
  id: string;
  final_goal_id: string;
  title: string;
  description: string;
  difficulty: number; // 1 to 5
  order_index: number;
  target_date: string; // YYYY-MM-DD
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  progress?: number; // Calculated dynamic field (0-100)
  priority?: 'low' | 'medium' | 'high';

  // Points System Fields (calculated or inherited)
  est_hours?: number;
  perceived_difficulty?: number;
  points_absolute?: number;
  points_relative?: number;
}

export interface Subtask {
  id: string;
  milestone_id: string;
  title: string;
  is_completed: boolean;
  order_index: number;
  created_at: string;
}

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface AiConfig {
  url: string;
  apiKey: string;
  model: string;
}

export interface Habit {
  id: string;
  title: string;
  description?: string;
  start_date: string;
  end_date: string;
  frequency_type: 'daily' | 'weekly' | 'custom';
  custom_days_per_week?: number;
  goal_ids: string[];
  created_at: string;
  user_id?: string;
}

export interface HabitLog {
  habit_id: string;
  date: string;
  status: 'done' | 'missed';
}

export interface Tracker {
  id: string;
  name: string;
  periodicity: 'daily' | 'hebdo' | 'month' | 'custom';
  unit: string;
  created_at: string;
  user_id?: string;
}

export interface TrackerLog {
  id: string;
  tracker_id: string;
  date: string; // YYYY-MM-DD
  value: string; // The user can enter whatever value they want, not necessarily a number
  created_at: string;
}

export interface StrongExercise {
  id: string;
  name: string;
  created_at?: string;
  user_id?: string;
}

export interface StrongWorkoutSet {
  id?: string;
  exercise_name: string;
  weight: number;
  reps: number;
  set_order: number;
}

export interface StrongWorkout {
  id: string;
  date: string; // YYYY-MM-DD
  name: string; // e.g. "Leg", "Chest and Triceps"
  sets: StrongWorkoutSet[];
  created_at?: string;
  user_id?: string;
}


