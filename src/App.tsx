import React, { useState } from 'react';
import { GoalProvider } from './context/GoalContext';
import { Sidebar } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { Dashboard } from './components/Dashboard';
import { GoalTimeline } from './components/GoalTimeline';
import { GoalCalendar } from './components/GoalCalendar';
import { HabitsView } from './components/HabitsView';
import { SettingsModal } from './components/SettingsModal';
import { GoalFormModal } from './components/GoalFormModal';
import type { FinalGoal, Milestone } from './types';

// Core component wrapped in provider
const MainApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'timeline' | 'calendar' | 'habits'>('dashboard');
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  
  // Modals visibility states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  // Form settings configuration
  const [formType, setFormType] = useState<'goal' | 'milestone'>('goal');
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [goalToEdit, setGoalToEdit] = useState<FinalGoal | null>(null);
  const [milestoneToEdit, setMilestoneToEdit] = useState<Milestone | null>(null);
  const [formParentId, setFormParentId] = useState<string | null>(null);

  // Modal opening wrappers
  const openCreateGoalModal = () => {
    setFormType('goal');
    setFormMode('create');
    setFormParentId(null);
    setGoalToEdit(null);
    setMilestoneToEdit(null);
    setIsFormOpen(true);
  };

  const openCreateMilestoneModal = (parentId?: string) => {
    setFormType('milestone');
    setFormMode('create');
    setFormParentId(parentId || null);
    setGoalToEdit(null);
    setMilestoneToEdit(null);
    setIsFormOpen(true);
  };

  const openEditGoalModal = (goal: FinalGoal) => {
    setFormType('goal');
    setFormMode('edit');
    setGoalToEdit(goal);
    setMilestoneToEdit(null);
    setFormParentId(null);
    setIsFormOpen(true);
  };

  const openEditMilestoneModal = (milestone: Milestone) => {
    setFormType('milestone');
    setFormMode('edit');
    setMilestoneToEdit(milestone);
    setGoalToEdit(null);
    setFormParentId(null);
    setIsFormOpen(true);
  };

  return (
    <div className="app-container">
      {/* 1. Sidebar desktop navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedGoalId={selectedGoalId}
        setSelectedGoalId={setSelectedGoalId}
        openSettings={() => setIsSettingsOpen(true)}
      />

      {/* 2. Floating Mobile Nav */}
      <MobileNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        openSettings={() => setIsSettingsOpen(true)}
      />

      {/* 3. Main Dashboard / Timelines Content views */}
      <main className="main-content">
        {activeTab === 'dashboard' ? (
          <Dashboard
            setActiveTab={setActiveTab}
            setSelectedGoalId={setSelectedGoalId}
            openCreateModal={(type, parentId) => {
              if (type === 'goal') openCreateGoalModal();
              else openCreateMilestoneModal(parentId);
            }}
            openEditModal={openEditGoalModal}
          />
        ) : activeTab === 'timeline' ? (
          <GoalTimeline
            selectedGoalId={selectedGoalId}
            setSelectedGoalId={setSelectedGoalId}
            openCreateModal={(type, parentId) => {
              if (type === 'goal') openCreateGoalModal();
              else openCreateMilestoneModal(parentId);
            }}
            openEditMilestoneModal={openEditMilestoneModal}
          />
        ) : activeTab === 'calendar' ? (
          <GoalCalendar />
        ) : (
          <HabitsView />
        )}
      </main>

      {/* 4. Global Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* 5. Global Goal / Milestone CRUD Form Modal */}
      <GoalFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        type={formType}
        mode={formMode}
        goalToEdit={goalToEdit}
        milestoneToEdit={milestoneToEdit}
        parentId={formParentId}
      />
    </div>
  );
};

// Main Export wrapping with context provider
function App() {
  return (
    <GoalProvider>
      <MainApp />
    </GoalProvider>
  );
}

export default App;
