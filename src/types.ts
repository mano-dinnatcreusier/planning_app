export interface FinalGoal {
  id: string;
  title: string;
  description: string;
  difficulty: number; // 1 to 5
  target_date: string; // YYYY-MM-DD
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
  progress?: number; // Calculated dynamic field (0-100)
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
