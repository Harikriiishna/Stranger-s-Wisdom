import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import { AppErrorBoundary } from './components/StateViews';
import { AuthProvider } from './contexts/AuthContext';
import { RealtimeProvider } from './contexts/RealtimeContext';
import { ApiError } from './lib/api';
import { AskQuestionPage } from './pages/AskQuestionPage';
import {
  ForgotPasswordPage,
  SignInPage,
  SignUpPage,
} from './pages/AuthPages';
import { ExplorePage, SearchPage } from './pages/ExploreAndSearch';
import { HomePage } from './pages/HomePage';
import { ModerationDashboardPage } from './pages/ModerationDashboardPage';
import { MyWisdomPage } from './pages/MyWisdomPage';
import {
  HelpSupportPage,
  NotificationsPage,
  PrivacySafetyPage,
  ProfilePage,
  ReportContentPage,
  SettingsPage,
} from './pages/NotificationsAndProfilePages';
import { OnboardingScreen, SplashScreen } from './pages/OnboardingAndSplash';
import { OneVoicePage, PerspectivePage } from './pages/OneVoiceAndPerspectivePages';
import { QuestionDetailsPage } from './pages/QuestionDetailsPage';
import { SavedAndCollectionsPage } from './pages/SavedAndCollectionsPage';
import { SemgrepWorkbenchPage } from './pages/SemgrepWorkbenchPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      networkMode: 'always',
      retry: (failureCount, error) => {
        if (
          error instanceof ApiError &&
          (error.status === 0 || error.status === 408)
        ) {
          return false;
        }
        return failureCount < 2;
      },
      staleTime: 15000,
      refetchOnWindowFocus: true,
    },
  },
});

export default function App() {
  return (
    <AppErrorBoundary>
      <MotionConfig reducedMotion="user">
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <RealtimeProvider>
              <BrowserRouter>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/splash" element={<SplashScreen />} />
                <Route path="/onboarding" element={<OnboardingScreen />} />
                <Route path="/signup" element={<SignUpPage />} />
                <Route path="/signin" element={<SignInPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/home" element={<HomePage />} />
                <Route path="/explore" element={<ExplorePage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/ask" element={<AskQuestionPage />} />
                <Route path="/questions/:id" element={<QuestionDetailsPage />} />
                <Route
                  path="/questions/:id/answer"
                  element={<QuestionDetailsPage openEditorByDefault />}
                />
                <Route path="/my-questions" element={<MyWisdomPage defaultTab="questions" />} />
                <Route path="/my-wisdom" element={<MyWisdomPage defaultTab="answers" />} />
                <Route path="/my-wisdom/questions" element={<MyWisdomPage defaultTab="questions" />} />
                <Route path="/my-wisdom/answers" element={<MyWisdomPage defaultTab="answers" />} />
                <Route path="/my-wisdom/drafts" element={<MyWisdomPage defaultTab="drafts" />} />
                <Route path="/saved" element={<SavedAndCollectionsPage defaultView="saved" />} />
                <Route path="/collections" element={<SavedAndCollectionsPage defaultView="collections" />} />
                <Route path="/one-voice" element={<OneVoicePage />} />
                <Route path="/perspective" element={<PerspectivePage />} />
                <Route path="/notifications" element={<NotificationsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/privacy-safety" element={<PrivacySafetyPage />} />
                <Route path="/report" element={<ReportContentPage />} />
                <Route path="/help" element={<HelpSupportPage />} />
                <Route path="/moderation" element={<ModerationDashboardPage />} />
                <Route path="/security" element={<SemgrepWorkbenchPage />} />
                <Route path="*" element={<Navigate to="/home" replace />} />
              </Routes>
              </BrowserRouter>
            </RealtimeProvider>
          </AuthProvider>
        </QueryClientProvider>
      </MotionConfig>
    </AppErrorBoundary>
  );
}
