import React, { useState, useEffect, useCallback } from 'react';
import XpProgressMeter from './XpProgressMeter';
import AchievementBadge from './AchievementBadge';
import { Achievement, AchievementType, XpState, OnActionProps, DailyActivityCounts } from '../types';
import { callGeminiApi } from '../services/geminiService';
import Loader from './Loader';

interface DailyAchievementDashboardProps extends OnActionProps {
  xpState: XpState;
  xpForNextLevel: number;
  currentStreak: number;
  unlockedBadges: AchievementType[];
  allAchievements: Record<AchievementType, Omit<Achievement, 'unlockedAt'>>;
  userName: string | null;
  soundEnabled: boolean;
  toggleSound: () => void;
  todayActionCounts: DailyActivityCounts;
  studyStreak: number;
}

const MOTIVATIONAL_MESSAGE_SYSTEM_INSTRUCTION = `You are a motivating AI assistant for a student productivity app called "Student Life Solver (SLS)". Your task is to generate short, encouraging, and personalized motivational messages.

The message should be 1-2 sentences long.
It should be positive, uplifting, and celebrate the user's progress or recent activity.
Use a friendly, casual, and supportive tone.
You can use emojis sparingly to add a touch of fun.

When generating a message, consider the following context:
- User's current level (e.g., Level 3)
- User's current XP (e.g., 350 XP)
- XP required for the next level (e.g., 500 XP)
- User's current app usage streak (e.g., 5 days)
- Recently unlocked badges (if any, will be provided as 'NEW_BADGE: [Badge Name]')
- The action that just occurred (e.g., 'STUDY_PLAN_GENERATED', 'NOTES_SUMMARIZED')

Prioritize messages related to new achievements or level ups. If no specific achievement, focus on consistency or recent activity.`;

const DailyAchievementDashboard: React.FC<DailyAchievementDashboardProps> = ({
  xpState,
  xpForNextLevel,
  currentStreak,
  unlockedBadges,
  allAchievements,
  userName,
  onAction,
  soundEnabled,
  toggleSound,
  todayActionCounts,
  studyStreak,
}) => {
  const { xp, level } = xpState;
  const [motivationalMessage, setMotivationalMessage] = useState<string>('');
  const [loadingMessage, setLoadingMessage] = useState<boolean>(false);

  const getMotivationalMessage = useCallback(async (context: string) => {
    setLoadingMessage(true);
    try {
      const prompt = `Generate a motivational message for ${userName || 'our user'} with the following context:
      Level: ${level}, XP: ${xp}/${xpForNextLevel}.
      Streak: ${currentStreak} days.
      Last activity: ${context}.
      `;
      const message = await callGeminiApi(
        prompt,
        'gemini-2.5-flash',
        { systemInstruction: MOTIVATIONAL_MESSAGE_SYSTEM_INSTRUCTION, temperature: 0.9 }
      );
      setMotivationalMessage(message);
    } catch (error) {
      console.error("Error generating motivational message:", error);
      setMotivationalMessage("Keep up the great work! You're making awesome progress! ✨");
    } finally {
      setLoadingMessage(false);
    }
  }, [level, xp, xpForNextLevel, currentStreak, userName]);

  useEffect(() => {
    getMotivationalMessage('App opened.');
  }, [getMotivationalMessage]);

  const getBadgeProgress = (badgeId: AchievementType) => {
    switch (badgeId) {
      case AchievementType.FIRE_MASTER:
        return { current: studyStreak, total: 3 };
      case AchievementType.NOTES_HERO:
        return { current: todayActionCounts.notesSummarized, total: 5 };
      case AchievementType.HOMEWORK_LEGEND:
        return { current: todayActionCounts.homeworkChecked, total: 5 };
      case AchievementType.CONSISTENCY_KING_QUEEN:
        return { current: currentStreak, total: 7 };
      default:
        return undefined;
    }
  };

  const allBadgeDetails = Object.values(allAchievements).map((badge: Omit<Achievement, 'unlockedAt'>) => ({
    ...badge,
    isUnlocked: unlockedBadges.includes(badge.id),
    progress: !unlockedBadges.includes(badge.id) ? getBadgeProgress(badge.id) : undefined,
  }));

  const unlockedBadgeDetails = allBadgeDetails.filter(badge => badge.isUnlocked);
  const lockedBadgeDetails = allBadgeDetails.filter(badge => !badge.isUnlocked);

  return (
    <div className="daily-achievement-dashboard p-4 mb-8 bg-gradient-to-br from-violet-50 to-pink-100 rounded-3xl shadow-xl border border-purple-200 animate-fade-in">
      <h2 className="text-3xl font-extrabold mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-purple-700 to-indigo-500">
        🌟 Daily Achievements
      </h2>

      <div className="flex items-center justify-center mb-6">
        <label htmlFor="sound-toggle" className="flex items-center cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              id="sound-toggle"
              className="sr-only"
              checked={soundEnabled}
              onChange={toggleSound}
            />
            <div className="block bg-gray-300 w-14 h-8 rounded-full"></div>
            <div
              className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform duration-300 ease-in-out ${
                soundEnabled ? 'translate-x-full bg-gradient-to-r from-purple-500 to-pink-500' : ''
              }`}
            ></div>
          </div>
          <div className="ml-3 text-gray-700 font-medium">
            Sound Effects {soundEnabled ? 'On' : 'Off'} {soundEnabled ? '🔊' : '🔇'}
          </div>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-5 rounded-2xl shadow-md border border-gray-100 flex flex-col justify-between">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            🚀 XP & Level Progress
          </h3>
          <XpProgressMeter
            currentXp={xp}
            level={level}
            xpToNextLevel={xpForNextLevel}
          />
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-md border border-gray-100 flex flex-col justify-between items-center text-center">
          <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            🔥 Daily Streak
          </h3>
          <div className="text-6xl font-extrabold text-red-500 leading-none drop-shadow-lg">
            {currentStreak}
          </div>
          <p className="text-lg text-gray-700 font-semibold mt-2">
            {currentStreak === 0 ? "Start your streak today!" : `Day${currentStreak > 1 ? 's' : ''} in a row!`}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Keep coming back to grow your streak!
          </p>
        </div>
      </div>

      <div className="bg-white p-5 mt-6 rounded-2xl shadow-md border border-gray-100 text-center">
        <h3 className="text-xl font-bold text-gray-800 mb-3 flex items-center justify-center gap-2">
          ✨ Your Daily Boost
        </h3>
        {loadingMessage ? (
          <Loader message="SLS is generating motivation..." />
        ) : (
          <p className="text-lg text-gray-700 font-medium italic animate-fade-in">
            "{motivationalMessage}"
          </p>
        )}
      </div>

      <div className="bg-white p-5 mt-6 rounded-2xl shadow-md border border-gray-100">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          🏆 Your Achievements
        </h3>
        {/* Changed from Grid to Flex to handle odd number of items centered (Consistency King) on mobile */}
        <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
          {unlockedBadgeDetails.length > 0 && unlockedBadgeDetails.map(badge => (
            <div key={badge.id} className="w-[47%] sm:w-[30%] lg:w-[18%] flex-grow-0">
               <AchievementBadge badge={badge} isUnlocked={true} />
            </div>
          ))}
          {lockedBadgeDetails.map(badge => (
            <div key={badge.id} className="w-[47%] sm:w-[30%] lg:w-[18%] flex-grow-0">
               <AchievementBadge badge={badge} isUnlocked={false} progress={badge.progress} />
            </div>
          ))}
        </div>
        {allBadgeDetails.length === 0 && (
          <p className="text-gray-600 text-center py-4">No achievements defined yet. Keep an eye out!</p>
        )}
      </div>
    </div>
  );
};

export default DailyAchievementDashboard;