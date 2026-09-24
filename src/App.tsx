import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';

const HomePage = lazy(() => import('./pages/HomePage'));
const RankingsPage = lazy(() => import('./pages/RankingsPage'));
const AthletesPage = lazy(() => import('./pages/AthletesPage'));
const AthleteProfilePage = lazy(() => import('./pages/AthleteProfilePage'));
const ResultsPage = lazy(() => import('./pages/ResultsPage'));
const RecordsPage = lazy(() => import('./pages/RecordsPage'));
const CountriesPage = lazy(() => import('./pages/CountriesPage'));
const FromThePoolDeckPage = lazy(() => import('./pages/FromThePoolDeckPage'));
const ArticlePage = lazy(() => import('./pages/ArticlePage'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const JoinPage = lazy(() => import('./pages/JoinPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const MeetPage = lazy(() => import('./pages/MeetPage'));
const ClubsPage = lazy(() => import('./pages/ClubsPage'));
const ClubPage = lazy(() => import('./pages/ClubPage'));
const ComparePage = lazy(() => import('./pages/ComparePage'));
const SubmitResultPage = lazy(() => import('./pages/SubmitResultPage'));
const WTGPage = lazy(() => import('./pages/WTGPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="min-h-screen bg-[var(--paper)]" aria-busy="true" />}>
        <Routes>
          <Route path="/" element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route path="rankings" element={<RankingsPage />} />
          <Route path="athletes" element={<AthletesPage />} />
          <Route path="athletes/:id" element={<AthleteProfilePage />} />
          <Route path="results" element={<ResultsPage />} />
          <Route path="records" element={<RecordsPage />} />
          <Route path="countries" element={<CountriesPage />} />
          <Route path="from-the-pool-deck" element={<FromThePoolDeckPage />} />
          <Route path="from-the-pool-deck/:slug" element={<ArticlePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="join" element={<JoinPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="meets/:id" element={<MeetPage />} />
          <Route path="clubs" element={<ClubsPage />} />
          <Route path="clubs/:id" element={<ClubPage />} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="submit" element={<SubmitResultPage />} />
          <Route path="games" element={<WTGPage />} />
          <Route path="*" element={<NotFoundPage />} />
          </Route>
          {/* Full-page routes — no main nav */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
