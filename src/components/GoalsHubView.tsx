import React, { useState } from 'react';
import { Dashboard } from './Dashboard';
import { GoalTimeline } from './GoalTimeline';
import { GoalCalendar } from './GoalCalendar';
import { LayoutDashboard, CalendarRange, CalendarDays } from 'lucide-react';
import type { FinalGoal, Milestone } from '../types';

interface GoalsHubViewProps {
  initialSubTab?: 'dashboard' | 'timeline' | 'calendar';
  selectedGoalId: string | null;
  setSelectedGoalId: (id: string | null) => void;
  openCreateGoalModal: () => void;
  openCreateMilestoneModal: (parentId?: string) => void;
  openEditGoalModal: (goal: FinalGoal) => void;
  openEditMilestoneModal: (milestone: Milestone) => void;
}

export const GoalsHubView: React.FC<GoalsHubViewProps> = ({
  initialSubTab = 'dashboard',
  selectedGoalId,
  setSelectedGoalId,
  openCreateGoalModal,
  openCreateMilestoneModal,
  openEditGoalModal,
  openEditMilestoneModal
}) => {
  const [subTab, setSubTab] = useState<'dashboard' | 'timeline' | 'calendar'>(initialSubTab);

  return (
    <div className="goals-hub-container animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Segmented Control */}
      <div 
        className="glass"
        style={{
          display: 'inline-flex',
          alignSelf: 'flex-start',
          borderRadius: '50px',
          padding: '4px',
          gap: '4px',
          border: '1px solid var(--border-color)',
          maxWidth: '100%',
          overflowX: 'auto'
        }}
      >
        <button
          onClick={() => setSubTab('dashboard')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: '50px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'var(--transition-fast)',
            backgroundColor: subTab === 'dashboard' ? 'var(--accent-primary)' : 'transparent',
            color: subTab === 'dashboard' ? '#ffffff' : 'var(--text-med)',
            boxShadow: subTab === 'dashboard' ? 'var(--shadow-neon-primary)' : 'none',
            whiteSpace: 'nowrap'
          }}
        >
          <LayoutDashboard size={16} />
          <span>Vue d'ensemble</span>
        </button>

        <button
          onClick={() => setSubTab('timeline')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: '50px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'var(--transition-fast)',
            backgroundColor: subTab === 'timeline' ? 'var(--accent-primary)' : 'transparent',
            color: subTab === 'timeline' ? '#ffffff' : 'var(--text-med)',
            boxShadow: subTab === 'timeline' ? 'var(--shadow-neon-primary)' : 'none',
            whiteSpace: 'nowrap'
          }}
        >
          <CalendarRange size={16} />
          <span>Chronologie (Timeline)</span>
        </button>

        <button
          onClick={() => setSubTab('calendar')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: '50px',
            border: 'none',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'var(--transition-fast)',
            backgroundColor: subTab === 'calendar' ? 'var(--accent-primary)' : 'transparent',
            color: subTab === 'calendar' ? '#ffffff' : 'var(--text-med)',
            boxShadow: subTab === 'calendar' ? 'var(--shadow-neon-primary)' : 'none',
            whiteSpace: 'nowrap'
          }}
        >
          <CalendarDays size={16} />
          <span>Calendrier</span>
        </button>
      </div>

      {/* View Content */}
      {subTab === 'dashboard' && (
        <Dashboard
          setActiveTab={() => setSubTab('timeline')}
          setSelectedGoalId={setSelectedGoalId}
          openCreateModal={(type, parentId) => {
            if (type === 'goal') openCreateGoalModal();
            else openCreateMilestoneModal(parentId);
          }}
          openEditModal={openEditGoalModal}
        />
      )}

      {subTab === 'timeline' && (
        <GoalTimeline
          selectedGoalId={selectedGoalId}
          setSelectedGoalId={setSelectedGoalId}
          openCreateModal={(type, parentId) => {
            if (type === 'goal') openCreateGoalModal();
            else openCreateMilestoneModal(parentId);
          }}
          openEditMilestoneModal={openEditMilestoneModal}
        />
      )}

      {subTab === 'calendar' && (
        <GoalCalendar />
      )}
    </div>
  );
};
