import { Suspense, useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useKeyboardSearch } from '../hooks/useKeyboardSearch';
import PageLoading from '../components/PageLoading';

export default function MainLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminArea = location.pathname.startsWith('/admin');

  const goToSearch = useCallback(() => {
    navigate('/search');
  }, [navigate]);

  useKeyboardSearch(goToSearch);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--navy)' }}>
      {!isAdminArea && <Header />}
      <main className={`flex-1 ${isAdminArea ? '' : 'pt-14'}`}>
        <Suspense fallback={<PageLoading />}>
          <Outlet />
        </Suspense>
      </main>
      {!isAdminArea && <Footer />}
    </div>
  );
}
