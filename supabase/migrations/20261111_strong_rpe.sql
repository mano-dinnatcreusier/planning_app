-- Note d'effort facultative (0 à 10) par série Strong.
-- Migration additive : ajoute une colonne nullable, ne modifie ni ne supprime aucune ligne existante.
-- Sans risque à rejouer (IF NOT EXISTS). À exécuter une fois dans Supabase > SQL Editor.
ALTER TABLE public.strong_workout_sets
  ADD COLUMN IF NOT EXISTS rpe NUMERIC(3,1) CHECK (rpe >= 0 AND rpe <= 10);

-- Recharge le cache de schéma de l'API REST (sinon la colonne peut rester invisible quelques minutes).
NOTIFY pgrst, 'reload schema';
