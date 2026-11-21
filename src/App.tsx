import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppErrorBoundary } from './components/StateViews';
import { AuthProvider } from './contexts/AuthContext';
import { RealtimeProvider } from './contexts/RealtimeContext';
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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 15000,
      refetchOnWindowFocus: true,
    },
  },
});

export default function App() {
  return (
    <AppErrorBoundary>
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
                <Route path="*" element={<Navigate to="/home" replace />} />
              </Routes>
            </BrowserRouter>
          </RealtimeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
