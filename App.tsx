

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ToolName, SavedItem, ActionType, DailyAchievementState, XpState, AchievementType, Achievement, AudioFx } from './types';
import Navbar from './components/Navbar';
import StudyRoutineFixer from './components/StudyRoutineFixer';
import NotesCleanerSummarizer from './components/NotesCleanerSummarizer';
import HomeworkChecker from './components/HomeworkChecker';
import MoodStressManager from './components/MoodStressManager';
import InstantDecisionHelper from './components/InstantDecisionHelper';
import Loader from './components/Loader';
import OnboardingTour from './components/OnboardingTour';
import WelcomeScreen from './components/WelcomeScreen'; // Import the new WelcomeScreen component
import SavedWorkModal from './components/SavedWorkModal'; // Import new SavedWorkModal
import XpProgressMeter from './components/XpProgressMeter'; // Renamed from FireLevelMeter
import PredictMyGrade from './components/PredictMyGrade'; // Import new PredictMyGrade
import DailyAchievementDashboard from './components/DailyAchievementDashboard'; // New Daily Achievement Dashboard
import BadgeCelebrationOverlay from './components/BadgeCelebrationOverlay'; // New Badge Celebration Overlay
import DeadlinePressureMeter from './components/DeadlinePressureMeter'; // Import new DeadlinePressureMeter

import {
  loadSavedItems, saveItems, generateUniqueId,
  loadDailyAchievementState, saveDailyAchievementState,
  loadSoundEnabled, saveSoundEnabled, // Import new sound preferences
} from './utils/localStorageService'; // Import local storage utilities
import { playAudioFx } from './utils/audioService'; // Import audio service

// XP levels configuration: XP required to reach that level
const XP_LEVELS = [0, 100, 250, 500, 1000, 2000, 3500, 5000, 7500, 10000]; // Max level 9 for 10000 XP

// Base XP awards for actions
const XP_AWARDS: Record<ActionType, number> = {
  [ActionType.STUDY_PLAN_GENERATED]: 15,
  [ActionType.NOTES_SUMMARIZED]: 20,
  [ActionType.HOMEWORK_CHECKED]: 30,
  [ActionType.MOOD_UPDATED]: 10,
  [ActionType.DECISION_MADE]: 5,
  [ActionType.GRADE_PREDICTED]: 5,
  [ActionType.PRESSURE_CALCULATED]: 10, // Award for pressure calculation
};

// Achievement definitions
const ALL_ACHIEVEMENTS: Record<AchievementType, Omit<Achievement, 'unlockedAt'>> = {
  [AchievementType.FIRE_MASTER]: {
    id: AchievementType.FIRE_MASTER,
    name: 'Fire Master',
    description: 'Generate study plans for 3 consecutive days.',
    icon: '🔥',
  },
  [AchievementType.NOTES_HERO]: {
    id: AchievementType.NOTES_HERO,
    name: 'Notes Hero',
    description: 'Create 5 unique notes summaries in a day.',
    icon: '📝',
  },
  [AchievementType.HOMEWORK_LEGEND]: {
    id: AchievementType.HOMEWORK_LEGEND,
    name: 'Homework Legend',
    description: 'Complete 5 unique homework checks in a day.',
    icon: '📚',
  },
  [AchievementType.FOCUS_BEAST]: {
    id: AchievementType.FOCUS_BEAST,
    name: 'Focus Beast',
    description: 'Generate a study plan of 2+ hours.',
    icon: '🧠',
  },
  [AchievementType.CONSISTENCY_KING_QUEEN]: {
    id: AchievementType.CONSISTENCY_KING_QUEEN,
    name: 'Consistency King/Queen',
    description: 'Maintain a 7-day app usage streak.',
    icon: '👑',
  },
};

// Helper to get today's date in YYYY-MM-DD format
const getTodayDateString = () => {
  return new Date().toISOString().split('T')[0];
};

// Pure helper function to check and unlock a badge logic
// This function does NOT call setDailyAchievementState or other side effects.
// It just computes the next state and whether a badge was newly unlocked.
const getUpdatedStateAfterBadgeCheck = (
  currentDailyAchievementState: DailyAchievementState,
  badgeType: AchievementType,
  allAchievements: Record<AchievementType, Omit<Achievement, 'unlockedAt'>>
): { updatedState: DailyAchievementState; unlockedBadge: Achievement | null; didUnlock: boolean } => {
  if (!currentDailyAchievementState.unlockedBadges.includes(badgeType)) {
    const badgeDetails = allAchievements[badgeType];
    const newBadge: Achievement = { ...badgeDetails, unlockedAt: new Date().toISOString() };

    const updatedBadges = [...currentDailyAchievementState.unlockedBadges, badgeType];
    const newDailyAchievementState = {
      ...currentDailyAchievementState,
      unlockedBadges: updatedBadges,
    };
    return { updatedState: newDailyAchievementState, unlockedBadge: newBadge, didUnlock: true };
  }
  return { updatedState: currentDailyAchievementState, unlockedBadge: null, didUnlock: false };
};


const App: React.FC = () => {
  const [activeTool, setActiveTool] = useState<ToolName>(ToolName.DAILY_ACHIEVEMENTS); // Set initial active tool to Daily Achievements
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [showWelcomeScreen, setShowWelcomeScreen] = useState<boolean>(true);

  const [savedItems, setSavedItems] = useState<SavedItem[]>([]);
  const [showSavedWorkModal, setShowSavedWorkModal] = useState<boolean>(false);

  // Gamification states
  const [dailyAchievementState, setDailyAchievementState] = useState<DailyAchievementState>(() => loadDailyAchievementState());
  const [showBadgeCelebration, setShowBadgeCelebration] = useState<boolean>(false);
  const [newlyUnlockedBadge, setNewlyUnlockedBadge] = useState<Achievement | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => loadSoundEnabled()); // New state for sound preference

  // Derive XP, level, streak from dailyAchievementState
  const { xpState, unlockedBadges, currentStreak, lastActivityDate, dailyActionCounts } = dailyAchievementState;
  const { xp, level } = xpState;

  // Calculate XP needed for the next level
  const xpForNextLevel = XP_LEVELS[level + 1] || XP_LEVELS[XP_LEVELS.length - 1]; // Max XP for last level

  // Helper to calculate level from total XP
  const calculateLevelFromXp = (currentXp: number): number => {
    let currentLevel = 0;
    for (let i = 0; i < XP_LEVELS.length; i++) {
      if (currentXp >= XP_LEVELS[i]) {
        currentLevel = i;
      } else {
        break;
      }
    }
    return currentLevel;
  };

  // Memoize today's action counts for passing to dashboard
  const today = getTodayDateString();
  const todayActionCounts = useMemo(() => {
    return dailyActionCounts[today] || {
      studyPlansGenerated: 0,
      notesSummarized: 0,
      homeworkChecked: 0,
      moodUpdates: 0,
      decisionsMade: 0,
      gradesPredicted: 0,
      focusBeastEligibleToday: false,
    };
  }, [dailyActionCounts, today]);

  // Calculate current study streak for display and badge progress (Fire Master)
  const studyStreak = useMemo(() => {
    let streak = 0;
    // Check consecutive days backwards from yesterday to see existing banked streak
    // Then add 1 if today has a study plan
    const todayDate = new Date();
    
    // Check today first
    if ((dailyActionCounts[today]?.studyPlansGenerated || 0) > 0) {
      streak = 1;
    }

    // Check yesterday and backwards
    for (let i = 1; i < 7; i++) {
       const d = new Date(todayDate);
       d.setDate(todayDate.getDate() - i);
       const dateStr = d.toISOString().split('T')[0];
       if ((dailyActionCounts[dateStr]?.studyPlansGenerated || 0) > 0) {
         streak++;
       } else {
         break;
       }
    }
    return streak;
  }, [dailyActionCounts, today]);


  // Initialize and manage streak/daily counts and Consistency King/Queen badge
  useEffect(() => {
    const todayStr = getTodayDateString();
    const lastActivity = dailyAchievementState.lastActivityDate;

    let xpGainSoundPlayed = false;
    let streakMaintainSoundPlayed = false;
    let unlockedNewBadge: Achievement | null = null;
    let playedBadgeSound = false;

    setDailyAchievementState(prevState => {
      let newStreak = prevState.currentStreak;
      let newLastActivityDate = todayStr;
      const newDailyCounts = { ...prevState.dailyActionCounts };

      // Initialize today's counts if not present
      if (!newDailyCounts[todayStr]) {
        newDailyCounts[todayStr] = {
          studyPlansGenerated: 0,
          notesSummarized: 0,
          homeworkChecked: 0,
          moodUpdates: 0,
          decisionsMade: 0,
          gradesPredicted: 0,
          focusBeastEligibleToday: false,
        };
      }

      let currentWorkingState = prevState; // Start with prevState for progressive updates

      if (lastActivity) {
        const lastActivityDateObj = new Date(lastActivity);
        const todayDateObj = new Date(todayStr);
        const oneDay = 24 * 60 * 60 * 1000;
        const diffDays = Math.round(Math.abs((todayDateObj.getTime() - lastActivityDateObj.getTime()) / oneDay));

        if (diffDays === 1) {
          // Continuous streak
          newStreak = prevState.currentStreak + 1;
          if (newStreak > prevState.currentStreak) { // Check if streak actually increased
            streakMaintainSoundPlayed = true;
          }
        } else if (diffDays > 1) {
          // Streak broken
          newStreak = 1;
        } else {
          // Same day, streak doesn't change
          newStreak = prevState.currentStreak;
          newLastActivityDate = prevState.lastActivityDate; // Don't update lastActivityDate if it's the same day
        }
      } else {
        // First ever activity
        newStreak = 1;
      }

      // Apply streak updates to working state
      currentWorkingState = {
        ...currentWorkingState,
        currentStreak: newStreak,
        lastActivityDate: newLastActivityDate,
        dailyActionCounts: newDailyCounts,
      };

      // Check Consistency King/Queen achievement
      if (newStreak >= 7) {
        const { updatedState, unlockedBadge, didUnlock } = getUpdatedStateAfterBadgeCheck(
          currentWorkingState,
          AchievementType.CONSISTENCY_KING_QUEEN,
          ALL_ACHIEVEMENTS
        );
        currentWorkingState = updatedState; // Apply state changes from badge check
        if (didUnlock) {
          unlockedNewBadge = unlockedBadge;
          playedBadgeSound = true; // Flag to play sound after state update
        }
      }

      const finalUpdatedState = currentWorkingState; // This is the state to be returned

      // Side effects to be triggered after the state update
      if (streakMaintainSoundPlayed && soundEnabled) {
        playAudioFx(AudioFx.STREAK_MAINTAIN);
      }
      if (unlockedNewBadge) {
        setNewlyUnlockedBadge(unlockedNewBadge);
        setShowBadgeCelebration(true);
        if (soundEnabled && playedBadgeSound) {
          playAudioFx(AudioFx.BADGE_UNLOCK);
        }
        setTimeout(() => setShowBadgeCelebration(false), 5000);
      }
      
      saveDailyAchievementState(finalUpdatedState);
      return finalUpdatedState;
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dailyAchievementState.lastActivityDate, soundEnabled]); // Only re-run when lastActivityDate might change, or sound setting changes

  useEffect(() => {
    const storedUserName = localStorage.getItem('slsUserName');
    if (storedUserName) {
      setUserName(storedUserName);
      setShowWelcomeScreen(false);
    } else {
      setShowWelcomeScreen(true);
    }

    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (storedUserName && !hasSeenOnboarding) {
      setShowOnboarding(true);
    }

    setSavedItems(loadSavedItems());
    setSoundEnabled(loadSoundEnabled()); // Load sound preference
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false);
    localStorage.setItem('hasSeenOnboarding', 'true');
  }, []);

  const handleWelcomeComplete = useCallback((name: string) => {
    setUserName(name);
    localStorage.setItem('slsUserName', name);
    setShowWelcomeScreen(false);
    const hasSeenOnboarding = localStorage.getItem('hasSeenOnboarding');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }
  }, []);

  const handleSaveItem = useCallback((item: Omit<SavedItem, 'id' | 'timestamp'>) => {
    const newItem: SavedItem = {
      ...item,
      id: generateUniqueId(),
      timestamp: new Date().toISOString(),
    };
    setSavedItems((prevItems) => {
      const updatedItems = [...prevItems, newItem];
      saveItems(updatedItems);
      return updatedItems;
    });
  }, []);

  const handleDeleteItem = useCallback((id: string) => {
    setSavedItems((prevItems) => {
      const updatedItems = prevItems.filter((item) => item.id !== id);
      saveItems(updatedItems);
      return updatedItems;
    });
  }, []);

  const handleAction = useCallback((action: ActionType, data?: Record<string, any>) => {
    let xpEarned = 0;
    let unlockedNewBadge: Achievement | null = null;
    let playedBadgeSound = false; // Flag to indicate if badge sound should be played

    setDailyAchievementState(prevState => {
      const todayStr = getTodayDateString();
      const currentDayCounts = { // Ensure we always work with a fresh copy for the current day
        ...(prevState.dailyActionCounts[todayStr] || {
          studyPlansGenerated: 0,
          notesSummarized: 0,
          homeworkChecked: 0,
          moodUpdates: 0,
          decisionsMade: 0,
          gradesPredicted: 0,
          focusBeastEligibleToday: false,
        })
      };

      let currentWorkingState = prevState; // Start with prevState for progressive updates

      // 1. Determine XP to award and update daily counts
      switch (action) {
        case ActionType.STUDY_PLAN_GENERATED:
          if (currentDayCounts.studyPlansGenerated === 0) { // Only award XP once per day for this action
            xpEarned = XP_AWARDS[action];
            currentDayCounts.studyPlansGenerated = 1;
          }
          // Check Focus Beast badge condition using the pure helper
          if (data?.hoursPerDay >= 2) {
            const { updatedState, unlockedBadge, didUnlock } = getUpdatedStateAfterBadgeCheck(
              currentWorkingState,
              AchievementType.FOCUS_BEAST,
              ALL_ACHIEVEMENTS
            );
            currentWorkingState = updatedState; // Apply state changes from badge check
            if (didUnlock) {
              unlockedNewBadge = unlockedBadge;
              playedBadgeSound = true;
            }
          }
          break;
        case ActionType.NOTES_SUMMARIZED:
          xpEarned = XP_AWARDS[action];
          currentDayCounts.notesSummarized += 1;
          
          // Check Notes Hero badge (Required: 5)
          if (currentDayCounts.notesSummarized >= 5) {
            const { updatedState: notesHeroState, unlockedBadge: notesHeroBadge, didUnlock: notesHeroDidUnlock } = getUpdatedStateAfterBadgeCheck(
              currentWorkingState,
              AchievementType.NOTES_HERO,
              ALL_ACHIEVEMENTS
            );
            currentWorkingState = notesHeroState;
            if (notesHeroDidUnlock) {
              unlockedNewBadge = notesHeroBadge;
              playedBadgeSound = true;
            }
          }
          break;
        case ActionType.HOMEWORK_CHECKED:
          xpEarned = XP_AWARDS[action];
          currentDayCounts.homeworkChecked += 1;
          
          // Check Homework Legend badge (Required: 5)
          if (currentDayCounts.homeworkChecked >= 5) {
            const { updatedState: homeworkLegendState, unlockedBadge: homeworkLegendBadge, didUnlock: homeworkLegendDidUnlock } = getUpdatedStateAfterBadgeCheck(
              currentWorkingState,
              AchievementType.HOMEWORK_LEGEND,
              ALL_ACHIEVEMENTS
            );
            currentWorkingState = homeworkLegendState;
            if (homeworkLegendDidUnlock) {
              unlockedNewBadge = homeworkLegendBadge;
              playedBadgeSound = true;
            }
          }
          break;
        case ActionType.MOOD_UPDATED:
          xpEarned = XP_AWARDS[action]; // Can earn multiple times a day
          currentDayCounts.moodUpdates += 1;
          break;
        case ActionType.DECISION_MADE:
          xpEarned = XP_AWARDS[action];
          currentDayCounts.decisionsMade += 1;
          break;
        case ActionType.GRADE_PREDICTED:
          xpEarned = XP_AWARDS[action];
          currentDayCounts.gradesPredicted += 1;
          break;
        case ActionType.PRESSURE_CALCULATED:
          xpEarned = XP_AWARDS[action];
          break;
        default:
          break;
      }

      // Calculate new XP and Level from the potentially updated `currentWorkingState`
      const newXp = currentWorkingState.xpState.xp + xpEarned;
      const newLevel = calculateLevelFromXp(newXp);

      // Construct the final updated state to be returned
      const finalUpdatedState: DailyAchievementState = {
        ...currentWorkingState, // This ensures any badge unlocks are already in `unlockedBadges`
        xpState: { xp: newXp, level: newLevel },
        lastActivityDate: todayStr, // Update last activity date on any action
        dailyActionCounts: {
          ...currentWorkingState.dailyActionCounts, // Keep any counts from previous days
          [todayStr]: currentDayCounts, // Update current day's specific action counts
        },
      };

      // Trigger side effects (sounds, celebration) AFTER the state update logic for
      // `setDailyAchievementState` is determined. These effects will be run after
      // `setDailyAchievementState` returns and potentially causes a re-render.
      if (xpEarned > 0 && soundEnabled) {
        playAudioFx(AudioFx.XP_GAIN);
      }
      if (newLevel > prevState.xpState.level && soundEnabled) { // Compare against prevState's level
        playAudioFx(AudioFx.LEVEL_UP);
      }
      if (unlockedNewBadge) {
        setNewlyUnlockedBadge(unlockedNewBadge);
        setShowBadgeCelebration(true);
        if (soundEnabled && playedBadgeSound) { // Only play sound if it was a new unlock and sound is enabled
          playAudioFx(AudioFx.BADGE_UNLOCK);
        }
        setTimeout(() => setShowBadgeCelebration(false), 5000);
      }
      
      saveDailyAchievementState(finalUpdatedState); // Save the state to local storage
      return finalUpdatedState;
    });
  }, [soundEnabled, calculateLevelFromXp]);


  // Check Fire Master achievement (3 consecutive study days)
  useEffect(() => {
    // Only attempt to unlock if we have 3 or more consecutive study days
    if (studyStreak >= 3) {
      setDailyAchievementState(prevState => {
        const { updatedState, unlockedBadge, didUnlock } = getUpdatedStateAfterBadgeCheck(
          prevState,
          AchievementType.FIRE_MASTER,
          ALL_ACHIEVEMENTS
        );
        if (didUnlock) {
          setNewlyUnlockedBadge(unlockedBadge);
          setShowBadgeCelebration(true);
          if (soundEnabled) { // Play sound if newly unlocked and sound enabled
            playAudioFx(AudioFx.BADGE_UNLOCK);
          }
          setTimeout(() => setShowBadgeCelebration(false), 5000);
        }
        saveDailyAchievementState(updatedState);
        return updatedState;
      });
    }
  }, [studyStreak, soundEnabled]); // Depend on calculated studyStreak

  const toggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      saveSoundEnabled(!prev);
      return !prev;
    });
  }, []);

  if (showWelcomeScreen || !userName) {
    return <WelcomeScreen onComplete={handleWelcomeComplete} />;
  }

  if (showOnboarding) {
    return <OnboardingTour onComplete={handleOnboardingComplete} />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar
        activeTool={activeTool}
        onToolSelect={setActiveTool}
        onOpenSavedWork={() => setShowSavedWorkModal(true)}
      />
      <main className="flex-grow container mx-auto px-4 py-8 sm:px-6 lg:px-8 max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-5xl font-extrabold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-cyan-500 drop-shadow-sm">
            Ready to Spark Your Success, {userName}!
          </h1>
          <p className="text-lg sm:text-xl text-gray-700 max-w-2xl mx-auto">
            Welcome back, {userName}! Let's get started with your daily dose of brilliance.
          </p>
        </div>

        {/* Conditional rendering for Daily Achievement Dashboard and other tools */}
        {activeTool === ToolName.DAILY_ACHIEVEMENTS && (
          <DailyAchievementDashboard
            xpState={xpState}
            xpForNextLevel={xpForNextLevel}
            currentStreak={currentStreak}
            unlockedBadges={unlockedBadges}
            allAchievements={ALL_ACHIEVEMENTS}
            userName={userName}
            onAction={handleAction}
            soundEnabled={soundEnabled} // Pass sound preference
            toggleSound={toggleSound}    // Pass toggle function
            todayActionCounts={todayActionCounts} // Pass engagement data
            studyStreak={studyStreak} // Pass specific streak data
          />
        )}
        {activeTool === ToolName.STUDY_ROUTINE && <StudyRoutineFixer onSaveItem={handleSaveItem} onAction={handleAction} />}
        {activeTool === ToolName.NOTES_CLEANER && <NotesCleanerSummarizer onSaveItem={handleSaveItem} onAction={handleAction} />}
        {activeTool === ToolName.HOMEWORK_CHECKER && <HomeworkChecker onSaveItem={handleSaveItem} onAction={handleAction} />}
        {activeTool === ToolName.MOOD_STRESS && <MoodStressManager onAction={handleAction} />}
        {activeTool === ToolName.DECISION_HELPER && <InstantDecisionHelper onAction={handleAction} />}
        {activeTool === ToolName.PREDICT_MY_GRADE && <PredictMyGrade onAction={handleAction} />}
        {activeTool === ToolName.DEADLINE_PRESSURE && <DeadlinePressureMeter onAction={handleAction} />}
      </main>

      {showSavedWorkModal && (
        <SavedWorkModal
          savedItems={savedItems}
          onDelete={handleDeleteItem}
          onClose={() => setShowSavedWorkModal(false)}
        />
      )}

      {showBadgeCelebration && newlyUnlockedBadge && (
        <BadgeCelebrationOverlay badge={newlyUnlockedBadge} onClose={() => setShowBadgeCelebration(false)} />
      )}
    </div>
  );
};

export default App;