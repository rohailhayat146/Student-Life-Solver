
import { SavedItem, StudyRoutineInputs, NotesSummarizerInputs, HomeworkCheckerInputs, DifficultyLevel, NoteFormat, DailyAchievementState, DeadlinePressureInputs } from '../types';

const SAVED_ITEMS_KEY = 'slsSavedItems';
const XP_KEY = 'slsXp'; // Renamed from FIRE_LEVEL_KEY
const STUDY_ROUTINE_INPUTS_KEY = 'slsStudyRoutineInputs';
const NOTES_SUMMARIZER_INPUTS_KEY = 'slsNotesSummarizerInputs';
const HOMEWORK_CHECKER_INPUTS_KEY = 'slsHomeworkCheckerInputs';
const DEADLINE_PRESSURE_INPUTS_KEY = 'slsDeadlinePressureInputs'; // New key
const DAILY_ACHIEVEMENT_STATE_KEY = 'slsDailyAchievementState'; // New key for gamification state
const SOUND_ENABLED_KEY = 'slsSoundEnabled'; // New key for sound preference

/**
 * Loads saved items from local storage.
 * @returns An array of SavedItem.
 */
export const loadSavedItems = (): SavedItem[] => {
  try {
    const serializedItems = localStorage.getItem(SAVED_ITEMS_KEY);
    if (serializedItems === null) {
      return [];
    }
    return JSON.parse(serializedItems) as SavedItem[];
  } catch (error) {
    console.error("Error loading saved items from localStorage:", error);
    return [];
  }
};

/**
 * Saves items to local storage.
 * @param items The array of SavedItem to save.
 */
export const saveItems = (items: SavedItem[]): void => {
  try {
    const serializedItems = JSON.stringify(items);
    localStorage.setItem(SAVED_ITEMS_KEY, serializedItems);
  } catch (error) {
    console.error("Error saving items to localStorage:", error);
  }
};

/**
 * Loads XP from local storage.
 * @returns The current XP, defaults to 0 if not found.
 */
export const loadXp = (): number => {
  try {
    const serializedLevel = localStorage.getItem(XP_KEY);
    if (serializedLevel === null) {
      return 0; // Default to 0 if no level is saved
    }
    return parseInt(serializedLevel, 10);
  } catch (error) {
    console.error("Error loading XP from localStorage:", error);
    return 0;
  }
};

/**
 * Saves XP to local storage.
 * @param xp The XP to save.
 */
export const saveXp = (xp: number): void => {
  try {
    localStorage.setItem(XP_KEY, xp.toString());
  } catch (error) {
    console.error("Error saving XP to localStorage:", error);
  }
};

/**
 * Loads the full daily achievement state from local storage.
 * @returns The DailyAchievementState, or a default initial state if not found.
 */
export const loadDailyAchievementState = (): DailyAchievementState => {
  try {
    const serializedState = localStorage.getItem(DAILY_ACHIEVEMENT_STATE_KEY);
    if (serializedState === null) {
      return {
        xpState: { xp: 0, level: 0 },
        unlockedBadges: [],
        currentStreak: 0,
        lastActivityDate: null,
        dailyActionCounts: {},
      };
    }
    const state = JSON.parse(serializedState) as DailyAchievementState;
    // Ensure dailyActionCounts is always an object, not null/undefined if partially saved
    if (!state.dailyActionCounts) {
      state.dailyActionCounts = {};
    }
    return state;
  } catch (error) {
    console.error("Error loading daily achievement state from localStorage:", error);
    return {
      xpState: { xp: 0, level: 0 },
      unlockedBadges: [],
      currentStreak: 0,
      lastActivityDate: null,
      dailyActionCounts: {},
    };
  }
};

/**
 * Saves the full daily achievement state to local storage.
 * @param state The DailyAchievementState to save.
 */
export const saveDailyAchievementState = (state: DailyAchievementState): void => {
  try {
    const serializedState = JSON.stringify(state);
    localStorage.setItem(DAILY_ACHIEVEMENT_STATE_KEY, serializedState);
  } catch (error) {
    console.error("Error saving daily achievement state to localStorage:", error);
  }
};

/**
 * Loads sound enabled preference from local storage.
 * @returns boolean, defaults to true.
 */
export const loadSoundEnabled = (): boolean => {
  try {
    const serialized = localStorage.getItem(SOUND_ENABLED_KEY);
    if (serialized === null) {
      return true; // Default to sound enabled
    }
    return JSON.parse(serialized);
  } catch (error) {
    console.error("Error loading sound enabled preference from localStorage:", error);
    return true; // Default to true on error
  }
};

/**
 * Saves sound enabled preference to local storage.
 * @param enabled The boolean state to save.
 */
export const saveSoundEnabled = (enabled: boolean): void => {
  try {
    localStorage.setItem(SOUND_ENABLED_KEY, JSON.stringify(enabled));
  } catch (error) {
    console.error("Error saving sound enabled preference to localStorage:", error);
  }
};

/**
 * Loads study routine inputs from local storage.
 * @returns The latest study routine inputs, or defaults if not found.
 */
export const loadStudyRoutineInputs = (): StudyRoutineInputs => {
  try {
    const serializedInputs = localStorage.getItem(STUDY_ROUTINE_INPUTS_KEY);
    if (serializedInputs === null) {
      return { subjects: '', hoursPerDay: 3, difficulty: 'medium' };
    }
    return JSON.parse(serializedInputs) as StudyRoutineInputs;
  } catch (error) {
    console.error("Error loading study routine inputs from localStorage:", error);
    return { subjects: '', hoursPerDay: 3, difficulty: 'medium' };
  }
};

/**
 * Saves study routine inputs to local storage.
 * @param inputs The study routine inputs to save.
 */
export const saveStudyRoutineInputs = (inputs: StudyRoutineInputs): void => {
  try {
    const serializedInputs = JSON.stringify(inputs);
    localStorage.setItem(STUDY_ROUTINE_INPUTS_KEY, serializedInputs);
  } catch (error) {
    console.error("Error saving study routine inputs to localStorage:", error);
  }
};

/**
 * Loads notes summarizer inputs from local storage.
 * @returns The latest notes summarizer inputs, or defaults if not found.
 */
export const loadNotesSummarizerInputs = (): NotesSummarizerInputs => {
  try {
    const serializedInputs = localStorage.getItem(NOTES_SUMMARIZER_INPUTS_KEY);
    if (serializedInputs === null) {
      return { notesInput: '', format: 'bullet-points' };
    }
    return JSON.parse(serializedInputs) as NotesSummarizerInputs;
  } catch (error) {
    console.error("Error loading notes summarizer inputs from localStorage:", error);
    return { notesInput: '', format: 'bullet-points' };
  }
};

/**
 * Saves notes summarizer inputs to local storage.
 * @param inputs The notes summarizer inputs to save.
 */
export const saveNotesSummarizerInputs = (inputs: NotesSummarizerInputs): void => {
  try {
    const serializedInputs = JSON.stringify(inputs);
    localStorage.setItem(NOTES_SUMMARIZER_INPUTS_KEY, serializedInputs);
  } catch (error) {
    console.error("Error saving notes summarizer inputs to localStorage:", error);
  }
};

/**
 * Loads homework checker inputs from local storage.
 * @returns The latest homework checker inputs, or defaults if not found.
 */
export const loadHomeworkCheckerInputs = (): HomeworkCheckerInputs => {
  try {
    const serializedInputs = localStorage.getItem(HOMEWORK_CHECKER_INPUTS_KEY);
    if (serializedInputs === null) {
      return { question: '', userAnswer: '', rewriteRequested: false };
    }
    return JSON.parse(serializedInputs) as HomeworkCheckerInputs;
  } catch (error) {
    console.error("Error loading homework checker inputs from localStorage:", error);
    return { question: '', userAnswer: '', rewriteRequested: false };
  }
};

/**
 * Saves homework checker inputs to local storage.
 * @param inputs The homework checker inputs to save.
 */
export const saveHomeworkCheckerInputs = (inputs: HomeworkCheckerInputs): void => {
  try {
    const serializedInputs = JSON.stringify(inputs);
    localStorage.setItem(HOMEWORK_CHECKER_INPUTS_KEY, serializedInputs);
  } catch (error) {
    console.error("Error saving homework checker inputs to localStorage:", error);
  }
};

/**
 * Loads deadline pressure inputs from local storage.
 * @returns The latest deadline pressure inputs, or defaults if not found.
 */
export const loadDeadlinePressureInputs = (): DeadlinePressureInputs => {
  try {
    const serializedInputs = localStorage.getItem(DEADLINE_PRESSURE_INPUTS_KEY);
    if (serializedInputs === null) {
      return { tasksInput: '' };
    }
    return JSON.parse(serializedInputs) as DeadlinePressureInputs;
  } catch (error) {
    console.error("Error loading deadline inputs:", error);
    return { tasksInput: '' };
  }
};

/**
 * Saves deadline pressure inputs to local storage.
 * @param inputs The deadline pressure inputs to save.
 */
export const saveDeadlinePressureInputs = (inputs: DeadlinePressureInputs): void => {
  try {
    const serializedInputs = JSON.stringify(inputs);
    localStorage.setItem(DEADLINE_PRESSURE_INPUTS_KEY, serializedInputs);
  } catch (error) {
    console.error("Error saving deadline inputs to localStorage:", error);
  }
};

/**
 * Generates a simple unique ID.
 * @returns A unique string ID.
 */
export const generateUniqueId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
};