
import React, { useState } from 'react';
import { ToolName } from '../types';

interface OnboardingTourProps {
  onComplete: () => void;
}

interface TourStep {
  title: ToolName;
  icon: string;
  description: string;
}

const tourSteps: TourStep[] = [
  {
    title: ToolName.STUDY_ROUTINE,
    icon: '🎒',
    description: "Struggling to plan your study time? This tool crafts a personalized daily routine, balancing your subjects, available hours, and even adjusts if you miss a day. Say goodbye to overwhelm and hello to organized study!",
  },
  {
    title: ToolName.NOTES_CLEANER,
    icon: '📝',
    description: "Drowning in unorganized notes? Paste anything from lecture dumps to screenshots, and SLS will magically transform them into concise, exam-ready notes, bullet points, or revision sheets. Focus on learning, not endless retyping!",
  },
  {
    title: ToolName.HOMEWORK_CHECKER,
    icon: '📚',
    description: "Unsure if your answer is perfect? Submit your homework questions and your attempts, and this tool will evaluate correctness, highlight mistakes, and even provide a perfect answer if you want one. Learn from your errors and ace your assignments!",
  },
  {
    title: ToolName.DEADLINE_PRESSURE,
    icon: '⏳',
    description: "Deadlines piling up? Input your tasks and get a real-time Pressure Score, a 7-day stress forecast, and a prioritized plan. Avoid burnout by knowing exactly what to tackle next!",
  },
  {
    title: ToolName.MOOD_STRESS,
    icon: '😌',
    description: "Feeling overwhelmed, stressed, or just plain down? Talk to SLS! It listens with empathy, offers quick calming techniques, and gives friendly advice to boost your productivity and motivation. You're not alone!",
  },
  {
    title: ToolName.DECISION_HELPER,
    icon: '✔️',
    description: "Stuck between 'sleep or study' or 'buy or save'? This helper provides clear yes/no answers, quick reasoning, and a balanced list of pros and cons, helping you make smart choices in seconds. Conquer decision paralysis!",
  },
  {
    title: ToolName.PREDICT_MY_GRADE,
    icon: '💯',
    description: "Curious about your potential? Predict your grade based on your study habits, notes, homework, and even motivation levels. Get a personalized explanation and actionable steps to boost your score!",
  }
];

const OnboardingTour: React.FC<OnboardingTourProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const currentTourStep = tourSteps[currentStep];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-8 relative flex flex-col items-center text-center border-4 border-purple-100 animate-fade-in">
        
        <h2 className="text-3xl sm:text-4xl font-extrabold mb-6 drop-shadow-sm bg-clip-text text-transparent bg-gradient-to-r from-purple-700 to-pink-500">
          Welcome to Student Life Solver!
        </h2>
        <div className="text-7xl mb-4 p-4 rounded-full bg-indigo-50 shadow-xl animate-bounce-in">{currentTourStep.icon}</div>
        <h3 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-3">{currentTourStep.title}</h3>
        <p className="text-base sm:text-lg text-gray-600 mb-8 leading-relaxed max-w-md">
          {currentTourStep.description}
        </p>

        <div className="text-sm font-medium text-gray-500 mb-2">
          Step {currentStep + 1} of {tourSteps.length}
        </div>
        <p className="text-xs text-gray-400 mb-6">
          Complete the tour or skip to access all tools.
        </p>

        <div className="flex justify-between w-full max-w-md gap-4">
          <button
            onClick={handleSkip}
            className="px-6 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl transition-all duration-300 hover:bg-gray-200 hover:text-gray-900 shadow-sm hover:shadow-md"
            aria-label="Skip tour"
          >
            Skip
          </button>
          
          <button
            onClick={handleNext}
            className={`
              px-8 py-3 font-bold rounded-xl transition-all duration-300 transform hover:scale-105
              ${currentStep === tourSteps.length - 1
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xl hover:from-purple-700 hover:to-indigo-700 hover:shadow-2xl'
                : 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md hover:from-indigo-600 hover:to-purple-600 hover:shadow-lg'
              }
            `}
            aria-label={currentStep === tourSteps.length - 1 ? "Get Started" : "Next tool"}
          >
            {currentStep === tourSteps.length - 1 ? 'Get Started!' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingTour;
