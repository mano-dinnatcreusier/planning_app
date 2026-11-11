-- Retour arrière de 20261111_rls_strict.sql : remet les politiques d'origine (permissives) de Planning App.
-- À n'utiliser que si quelque chose ne marche plus après la migration. Ne touche à aucune donnée.
BEGIN;
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' AND policyname = 'own_rows'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;
DROP POLICY IF EXISTS "Users can manage their own final goals" ON public.final_goals;
CREATE POLICY "Users can manage their own final goals" ON public.final_goals FOR ALL USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can manage their own milestones" ON public.milestones;
CREATE POLICY "Users can manage their own milestones" ON public.milestones FOR ALL USING (
    EXISTS (SELECT 1 FROM public.final_goals WHERE id = milestones.final_goal_id AND (user_id = auth.uid() OR user_id IS NULL))
    OR NOT EXISTS (SELECT 1 FROM public.final_goals WHERE id = milestones.final_goal_id)
) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can manage their own subtasks" ON public.subtasks;
CREATE POLICY "Users can manage their own subtasks" ON public.subtasks FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can manage their own habits" ON public.habits;
CREATE POLICY "Users can manage their own habits" ON public.habits FOR ALL USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can manage their own habit logs" ON public.habit_logs;
CREATE POLICY "Users can manage their own habit logs" ON public.habit_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can manage their own trackers" ON public.trackers;
CREATE POLICY "Users can manage their own trackers" ON public.trackers FOR ALL USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can manage their own tracker logs" ON public.tracker_logs;
CREATE POLICY "Users can manage their own tracker logs" ON public.tracker_logs FOR ALL USING (
    EXISTS (SELECT 1 FROM public.trackers WHERE id = tracker_logs.tracker_id AND (user_id = auth.uid() OR user_id IS NULL))
    OR NOT EXISTS (SELECT 1 FROM public.trackers WHERE id = tracker_logs.tracker_id)
) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can manage their own strong exercises" ON public.strong_exercises;
CREATE POLICY "Users can manage their own strong exercises" ON public.strong_exercises FOR ALL USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can manage their own strong workouts" ON public.strong_workouts;
CREATE POLICY "Users can manage their own strong workouts" ON public.strong_workouts FOR ALL USING (auth.uid() = user_id OR user_id IS NULL) WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

DROP POLICY IF EXISTS "Users can manage their own strong workout sets" ON public.strong_workout_sets;
CREATE POLICY "Users can manage their own strong workout sets" ON public.strong_workout_sets FOR ALL USING (
    EXISTS (SELECT 1 FROM public.strong_workouts WHERE id = strong_workout_sets.workout_id AND (user_id = auth.uid() OR user_id IS NULL))
    OR NOT EXISTS (SELECT 1 FROM public.strong_workouts WHERE id = strong_workout_sets.workout_id)
) WITH CHECK (true);
COMMIT;
