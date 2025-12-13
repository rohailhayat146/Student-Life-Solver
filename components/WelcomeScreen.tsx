import React, { useState, FormEvent, useEffect } from 'react';

interface WelcomeScreenProps {
  onComplete: (name: string) => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onComplete }) => {
  const [name, setName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onComplete(name.trim());
    } else {
      setError("Please enter your name to continue!");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full p-8 relative flex flex-col items-center text-center border-4 border-purple-100 animate-fade-in">
        <div className="text-8xl mb-6 p-4 rounded-full bg-purple-50 shadow-xl animate-float">🚀</div>
        <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 drop-shadow-sm bg-clip-text text-transparent bg-gradient-to-r from-purple-700 to-pink-500">
          Welcome to Student Life Solver!
        </h2>
        <p className="text-lg sm:text-xl text-gray-700 mb-8 leading-relaxed max-w-md">
          Before we begin, let's get to know you a bit. What should I call you?
        </p>

        <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
          <div>
            <label htmlFor="user-name" className="sr-only">Your Name</label>
            <input
              type="text"
              id="user-name"
              className="w-full p-4 border-2 border-purple-400 bg-purple-50 rounded-3xl focus:outline-none focus:ring-4 focus:ring-opacity-50 focus:ring-purple-300 focus:border-purple-600 transition-all duration-300 text-gray-900 placeholder-purple-600 shadow-md hover:scale-[1.01] hover:shadow-xl font-bold text-center text-xl"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null); // Clear error on input
              }}
              aria-label="Your name"
              maxLength={30}
            />
            {error && <p className="mt-2 text-red-600 text-sm font-medium">{error}</p>}
          </div>
          <button
            type="submit"
            className="w-full px-8 py-4 font-bold rounded-xl transition-all duration-300 transform hover:scale-105 bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-xl hover:from-purple-700 hover:to-indigo-700 hover:shadow-2xl focus:ring-4 focus:ring-purple-300 focus:outline-none"
            aria-label="Continue to the app"
          >
            Continue to SLS!
          </button>
        </form>
      </div>
    </div>
  );
};

export default WelcomeScreen;