import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Infinity as InfinityIcon, Lock, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const SLIDES = [
  {
    title: 'Some questions are easier to ask a stranger.',
    body: 'Ask about uncertainty, heartbreak, ambition, or quiet doubts without carrying your public identity into the room.',
    note: 'Anonymous participation · No follower counts or profiles',
    icon: Lock,
  },
  {
    title: "Your identity isn't the point. Your experience is.",
    body: 'What matters here is lived honesty. Share what you learned the hard way, without performing for likes or attention.',
    note: 'Respectful communication · Thoughtful perspectives',
    icon: Sparkles,
  },
  {
    title: 'Give someone the words you once needed.',
    body: 'Somewhere tonight, someone is facing a crossroads you already survived. Your quiet experience can steady them.',
    note: 'Community safety · Moderated with care',
    icon: ShieldCheck,
  },
  {
    title: 'Ask. Listen. Understand.',
    body: 'Step into a calmer human space built for reflection, saved wisdom, and genuine understanding.',
    note: 'Private library synced across your devices',
    icon: InfinityIcon,
  },
];

export function SplashScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#070B19] text-slate-100 flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <img
          src="/src/assets/images/onboarding_sanctuary_1795241588374.jpg"
          alt=""
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#070B19] via-[#070B19]/75 to-[#070B19]/60" />
      </div>

      <div className="relative z-10 max-w-md w-full text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-500/25 to-violet-500/25 border border-cyan-400/35 text-cyan-300 shadow-lg shadow-cyan-500/10">
          <InfinityIcon className="h-8 w-8" />
        </div>

        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
            Stranger’s Wisdom
          </h1>
          <p className="font-wisdom text-lg text-slate-300 text-balance">
            Sometimes the right words come from someone you’ve never met.
          </p>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/onboarding')}
            className="w-full sm:w-auto min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-6 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer"
          >
            Begin Quietly
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="w-full sm:w-auto min-h-[46px] rounded-xl border border-indigo-800 px-6 py-3 text-sm font-medium text-slate-200 hover:bg-indigo-950/60 transition-colors cursor-pointer"
          >
            Explore Questions
          </button>
        </div>
      </div>
    </div>
  );
}

export function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { continueAnonymously } = useAuth();
  const slide = SLIDES[step];
  const Icon = slide.icon;

  const handleGuestExplore = async () => {
    setBusy(true);
    try {
      await continueAnonymously();
      navigate('/home');
    } catch {
      navigate('/home');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070B19] text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-4xl rounded-3xl border border-slate-200/80 dark:border-indigo-950 bg-white dark:bg-[#0D1326] overflow-hidden shadow-2xl grid grid-cols-1 lg:grid-cols-2">
        <div className="relative min-h-[260px] lg:min-h-[540px] bg-[#090F22]">
          <img
            src="/src/assets/images/onboarding_sanctuary_1795241588374.jpg"
            alt="Quiet twilight mountains overlooking misty valleys"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#070B19] via-[#070B19]/35 to-transparent" />
          <div className="absolute bottom-6 left-6 right-6 text-slate-100">
            <p className="text-xs font-medium text-cyan-300">
              Stranger’s Wisdom
            </p>
            <p className="mt-1 text-sm text-slate-300">
              Real People. Real Perspectives.
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-10 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-tabular text-xs font-medium text-slate-500 dark:text-slate-400">
              0{step + 1} / 0{SLIDES.length}
            </span>
            <button
              type="button"
              onClick={() => navigate('/home')}
              className="min-h-[40px] px-3 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
            >
              Skip to explore
            </button>
          </div>

          <div className="py-8 space-y-5">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/12 text-cyan-600 dark:text-cyan-400">
              <Icon className="h-6 w-6" />
            </div>

            <h1 className="font-wisdom text-2xl sm:text-3xl font-medium leading-tight text-slate-900 dark:text-white text-balance">
              {slide.title}
            </h1>

            <p className="text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300">
              {slide.body}
            </p>

            <p className="text-xs text-teal-700 dark:text-teal-300 pt-1">
              {slide.note}
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              {SLIDES.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  aria-label={`Go to step ${idx + 1}`}
                  onClick={() => setStep(idx)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    idx === step
                      ? 'w-8 bg-cyan-500'
                      : 'w-2 bg-slate-300 dark:bg-indigo-900'
                  }`}
                />
              ))}
            </div>

            {step < SLIDES.length - 1 ? (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep((s) => s + 1)}
                  className="flex-1 min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 dark:bg-cyan-500 px-5 py-3 text-sm font-semibold text-white dark:text-slate-950 hover:bg-cyan-500 transition-colors cursor-pointer"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => navigate('/signup')}
                  className="w-full min-h-[46px] rounded-xl bg-cyan-600 dark:bg-cyan-500 px-5 py-3 text-sm font-semibold text-white dark:text-slate-950 hover:bg-cyan-500 transition-colors cursor-pointer"
                >
                  Create Private Account
                </button>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleGuestExplore}
                    className="min-h-[44px] rounded-xl border border-slate-300 dark:border-indigo-800 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-indigo-950/60 cursor-pointer"
                  >
                    {busy ? 'Starting...' : 'Enter Anonymously'}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/signin')}
                    className="min-h-[44px] rounded-xl border border-slate-300 dark:border-indigo-800 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-indigo-950/60 cursor-pointer"
                  >
                    Sign In
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
