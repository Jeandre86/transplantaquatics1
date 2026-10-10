import { lazy, Suspense, useLayoutEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate, useParams } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import PageLoading from './components/PageLoading';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import { useAuth } from './contexts/AuthContext';
import AdSenseLoader from './components/AdSenseLoader';
import GoogleAnalytics from './components/GoogleAnalytics';

function ScrollToTop() {
  const { key } = useLocation();

  useLayoutEffect(() => {
    window.history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
  }, [key]);

  return null;
}

const HomePage = lazy(() => import('./pages/HomePage'));
const RankingsPage = lazy(() => import('./pages/RankingsPage'));
const GenderRankingsPage = lazy(() => import('./pages/GenderRankingsPage'));
const TransplantTypeRankingsPage = lazy(() => import('./pages/TransplantTypeRankingsPage'));
const AthletesPage = lazy(() => import('./pages/AthletesPage'));
const AthleteProfilePage = lazy(() => import('./pages/AthleteProfilePage'));
const ResultsPage = lazy(() => import('./pages/ResultsPage'));
const GenderResultsPage = lazy(() => import('./pages/GenderResultsPage'));
const RecordsPage = lazy(() => import('./pages/RecordsPage'));
const CountriesPage = lazy(() => import('./pages/CountriesPage'));
const CountryPage = lazy(() => import('./pages/CountryPage'));
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
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const CoachClubPage = lazy(() => import('./pages/CoachClubPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const WriterPage = lazy(() => import('./pages/WriterPage'));

function HomeRoute() {
  const auth = useAuth();

  if (auth.isLoading) return <PageLoading />;

  return (
    <Suspense fallback={<PageLoading />}>
      {auth.isLoggedIn ? <DashboardPage /> : <HomePage />}
    </Suspense>
  );
}

function AdminRoute() {
  const auth = useAuth();

  if (auth.isLoading) return <PageLoading />;

  return (
    <Suspense fallback={<PageLoading />}>
      {auth.isLoggedIn ? <AdminPage /> : <LoginPage adminMode />}
    </Suspense>
  );
}

function AdminLegacyRoute() {
  const { legacySection = '' } = useParams();
  const oldTab: Record<string, string> = {
    'results-imports': 'new', 'historical-archive': 'archive', 'profile-claims': 'claims',
    'article-review': 'article-review', 'article-library': 'articles', 'write-article': 'editor',
    'about-page': 'pages', 'ads-and-campaigns': 'campaigns', writers: 'team',
    'data-queries': 'quality',
  };
  return <Navigate replace to={`/admin?tab=${oldTab[legacySection] ?? 'overview'}`} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AdSenseLoader />
      <GoogleAnalytics />
      <ScrollToTop />
      <RouteErrorBoundary>
        <Routes>
          <Route path="/" element={<MainLayout />}>
          <Route index element={<HomeRoute />} />
          <Route path="rankings" element={<RankingsPage />} />
          <Route path="rankings/transplant-type" element={<TransplantTypeRankingsPage />} />
          <Route path="rankings/:gender" element={<GenderRankingsPage />} />
          <Route path="athletes" element={<AthletesPage />} />
          <Route path="athletes/:id" element={<AthleteProfilePage />} />
          <Route path="results" element={<ResultsPage />} />
          <Route path="results/:gender" element={<GenderResultsPage />} />
          <Route path="records" element={<RecordsPage />} />
          <Route path="countries" element={<CountriesPage />} />
          <Route path="countries/:code" element={<CountryPage />} />
          <Route path="from-the-pool-deck" element={<FromThePoolDeckPage />} />
          <Route path="from-the-pool-deck/:slug" element={<ArticlePage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="about/:section" element={<AboutPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="join" element={<JoinPage />} />
          <Route path="dashboard" element={<Suspense fallback={<PageLoading />}><DashboardPage /></Suspense>} />
          <Route path="profile" element={<Suspense fallback={<PageLoading />}><ProfilePage /></Suspense>} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="meets/:id" element={<MeetPage />} />
          <Route path="clubs" element={<ClubsPage />} />
          <Route path="clubs/:id" element={<ClubPage />} />
          <Route path="coach/club" element={<Suspense fallback={<PageLoading />}><CoachClubPage /></Suspense>} />
          <Route path="admin" element={<AdminRoute />} />
          <Route path="admin/:legacySection" element={<AdminLegacyRoute />} />
          <Route path="writer" element={<Suspense fallback={<PageLoading />}><WriterPage /></Suspense>} />
          <Route path="compare" element={<ComparePage />} />
          <Route path="submit" element={<SubmitResultPage />} />
          <Route path="games" element={<WTGPage />} />
          <Route path="*" element={<NotFoundPage />} />
          </Route>
          {/* Standalone auth route — no main nav */}
          <Route path="/login" element={<Suspense fallback={<PageLoading />}><LoginPage /></Suspense>} />
          <Route path="/writer/login" element={<Suspense fallback={<PageLoading />}><LoginPage writerMode /></Suspense>} />
        </Routes>
      </RouteErrorBoundary>
    </BrowserRouter>
  );
}
