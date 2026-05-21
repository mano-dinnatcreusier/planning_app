import type { AiConfig } from '../types';

export const getAiConfig = (): AiConfig => {
  const url = localStorage.getItem('fg_ai_url') || 'https://api.deepseek.com/v1';
  const apiKey = localStorage.getItem('fg_ai_key') || '';
  const model = localStorage.getItem('fg_ai_model') || 'deepseek-chat';
  return { url, apiKey, model };
};

export const saveAiConfigInStorage = (config: AiConfig) => {
  localStorage.setItem('fg_ai_url', config.url);
  localStorage.setItem('fg_ai_key', config.apiKey);
  localStorage.setItem('fg_ai_model', config.model);
};

interface AiEvaluationResult {
  coeff_public: number;
  coeff_personal: number;
  explanation_public: string;
  explanation_personal: string;
  suggested_hours: number;
}

export const evaluateGoalViaAi = async (
  title: string,
  description: string,
  estHours: number,
  perceivedDifficulty: number,
  userStartContext: string,
  config: AiConfig
): Promise<AiEvaluationResult> => {
  if (!config.apiKey) {
    throw new Error("Clé API manquante pour l'évaluation IA.");
  }

  const prompt = `Contexte de départ de l'utilisateur : "${userStartContext}"
Défi à évaluer :
- Titre : "${title}"
- Description : "${description}"
- Heures estimées par l'utilisateur : ${estHours}
- Difficulté perçue par l'utilisateur : ${perceivedDifficulty} / 5

Calcule de manière réaliste et cohérente :
1. "coeff_public" (nombre décimal entre 1.0 et 3.0) : Estimation globale de la rareté mondiale et l'effort objectif du défi (ex: marathon sub-2h30 = 3.0, MVP SaaS solo = 2.0, lire un livre = 1.0).
2. "coeff_personal" (nombre décimal entre 0.2 et 3.0) : Ajustement en fonction de la situation de départ. Si l'utilisateur a un fort niveau préexistant, ce coeff doit être bas (ex: < 0.6). S'il commence avec des difficultés/désavantages, ce coeff doit être haut (ex: > 1.5).
3. "suggested_hours" (nombre entier positif) : Estime de manière réaliste et objective le nombre total d'heures nécessaires pour qu'un utilisateur moyen accomplisse cet objectif. N'hésite pas à réajuster significativement la valeur initiale de l'utilisateur ("${estHours}" heures) si elle semble sous-estimée ou surestimée.

Format de sortie strict en JSON valide uniquement, sans Markdown, sans enrobage, sans commentaires. Exemple :
{"coeff_public": 1.5, "coeff_personal": 1.0, "explanation_public": "explication", "explanation_personal": "explication", "suggested_hours": 45}`;

  const response = await fetch(`${config.url}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: 'Tu es un assistant expert en productivité et en calibrage mathématique de défis. Réponds uniquement en format JSON valide.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erreur API IA (${response.status}) : ${errorText}`);
  }

  const responseData = await response.json();
  const rawText = responseData.choices?.[0]?.message?.content?.trim() || '{}';
  
  // Clean potential markdown wrap
  const cleanedJson = rawText.replace(/```json/i, '').replace(/```/g, '').trim();
  
  try {
    const parsed = JSON.parse(cleanedJson);
    return {
      coeff_public: Number(parsed.coeff_public) || 1.5,
      coeff_personal: Number(parsed.coeff_personal) || 1.0,
      explanation_public: parsed.explanation_public || "Évaluation standard.",
      explanation_personal: parsed.explanation_personal || "Ajustement standard.",
      suggested_hours: Number(parsed.suggested_hours) || estHours
    };
  } catch (err) {
    console.error("Format de réponse IA incorrect :", rawText);
    throw new Error("L'IA a renvoyé un format de réponse invalide. Veuillez réessayer.");
  }
};

export const suggestSubtasksViaAi = async (
  title: string,
  description: string,
  config: AiConfig
): Promise<string[]> => {
  if (!config.apiKey) {
    throw new Error("Clé API manquante pour les suggestions IA.");
  }

  const prompt = `Propose une décomposition de 3 à 5 sous-tâches concrètes, actionnables et claires pour l'étape suivante :
Titre : "${title}"
Description : "${description}"

Format de sortie STRICT en JSON représentant un tableau de chaînes de caractères. Ne mets aucun texte en dehors du JSON. Exemple :
["Première sous-tâche", "Deuxième sous-tâche"]`;

  const response = await fetch(`${config.url}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: 'Tu es un assistant de planification expert. Réponds uniquement en format JSON représentant un tableau de chaînes.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erreur API IA (${response.status}) : ${errorText}`);
  }

  const responseData = await response.json();
  const rawText = responseData.choices?.[0]?.message?.content?.trim() || '[]';
  const cleanedJson = rawText.replace(/```json/i, '').replace(/```/g, '').trim();

  try {
    const parsed = JSON.parse(cleanedJson);
    if (Array.isArray(parsed)) {
      return parsed.map(item => String(item).trim());
    }
    return [];
  } catch (err) {
    console.error("Format de réponse de tâches IA incorrect :", rawText);
    throw new Error("L'IA a renvoyé des suggestions de tâches invalides.");
  }
};

export interface HabitSuggestionResult {
  title: string;
  description: string;
  frequency_type: 'daily' | 'weekly' | 'custom';
  custom_days_per_week?: number;
  explanation: string;
}

export const suggestHabitViaAi = async (
  goalTitles: string[],
  frequencyPref: string,
  config: AiConfig
): Promise<HabitSuggestionResult> => {
  if (!config.apiKey) {
    throw new Error("Clé API manquante pour les suggestions d'habitudes.");
  }

  const prompt = `Objectifs liés : ${goalTitles.map(t => `"${t}"`).join(', ')}
Préférence de fréquence : "${frequencyPref}" (si la préférence est "IA", choisis la fréquence idéale entre 'daily', 'weekly', 'custom').

Propose une habitude concrète, réaliste et extrêmement bénéfique pour aider à atteindre ces objectifs.
Format de sortie strict en JSON valide uniquement, sans Markdown, sans enrobage, sans commentaires. Exemple :
{"title": "Courir 20 minutes", "description": "Faire un footing matinal pour travailler l'endurance fondamentale.", "frequency_type": "daily", "custom_days_per_week": null, "explanation": "Cette habitude permet de créer une routine cardiovasculaire essentielle pour courir un marathon."}`;

  const response = await fetch(`${config.url}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: 'Tu es un coach en habitude expert en productivité. Réponds uniquement en format JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Erreur API IA (${response.status}) : ${errorText}`);
  }

  const responseData = await response.json();
  const rawText = responseData.choices?.[0]?.message?.content?.trim() || '{}';
  const cleanedJson = rawText.replace(/```json/i, '').replace(/```/g, '').trim();

  try {
    const parsed = JSON.parse(cleanedJson);
    return {
      title: parsed.title || "Nouvelle habitude",
      description: parsed.description || "",
      frequency_type: parsed.frequency_type || 'daily',
      custom_days_per_week: parsed.custom_days_per_week ? Number(parsed.custom_days_per_week) : undefined,
      explanation: parsed.explanation || "Routine suggérée pour soutenir vos objectifs."
    };
  } catch (err) {
    console.error("Format de réponse de suggestion IA incorrect :", rawText);
    throw new Error("L'IA a renvoyé une suggestion invalide. Veuillez réessayer.");
  }
};
