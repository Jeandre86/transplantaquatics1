import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import HomePage from './pages/HomePage';
import RankingsPage from './pages/RankingsPage';
import AthletesPage from './pages/AthletesPage';
import AthleteProfilePage from './pages/AthleteProfilePage';
import ResultsPage from './pages/ResultsPage';
import RecordsPage from './pages/RecordsPage';
import CountriesPage from './pages/CountriesPage';
import FromThePoolDeckPage from './pages/FromThePoolDeckPage';
import ArticlePage from './pages/ArticlePage';
import SearchPage from './pages/SearchPage';
import JoinPage from './pages/JoinPage';
import CalendarPage from './pages/CalendarPage';
import MeetPage from './pages/MeetPage';
import ClubsPage from './pages/ClubsPage';
import ClubPage from './pages/ClubPage';
import ComparePage from './pages/ComparePage';
import SubmitResultPage from './pages/SubmitResultPage';
import WTGPage from './pages/WTGPage';
import NotFoundPage from './pages/NotFoundPage';
// Full-page (no main nav) layouts
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
