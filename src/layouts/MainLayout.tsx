import { useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useKeyboardSearch } from '../hooks/useKeyboardSearch';

export default function MainLayout() {
  const navigate = useNavigate();

  const goToSearch = useCallback(() => {
    navigate('/search');
  }, [navigate]);

  useKeyboardSearch(goToSearch);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--navy)' }}>
      <Header />
      <main className="flex-1 pt-14">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
