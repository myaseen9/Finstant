import { useState, useEffect, createContext } from 'react';
/* eslint-disable react-hooks/set-state-in-effect */
import { useRouter } from 'next/router';
import { getMe } from '@/api/auth';
import '@/styles/globals.css';

export const AppContext = createContext();

function RouteGuard({ children, user, isLoaded }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    
    const path = router.pathname;
    
    if (!user && path !== '/login') {
      setAuthorized(false);
      router.push('/login');
    } else if (user && path === '/login') {
      setAuthorized(true);
      router.push('/');
    } else if (user && path === '/admin' && user.role !== 'admin' && user.role !== 'superadmin') {
      setAuthorized(false);
      router.push('/');
    } else {
      setAuthorized(true);
    }
  }, [user, router, router.pathname, isLoaded]);

  return authorized ? children : null;
}

export default function App({ Component, pageProps }) {
  const [theme, setTheme] = useState('light');
  const [user, setUser] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Check session via httponly cookie — replaces sessionStorage
    const checkSession = async () => {
      try {
        const userData = await getMe();
        if (userData) {
          setUser(userData);
        }
      } catch (err) {
        // Not logged in, that's fine
      }
      setIsLoaded(true);
    };
    checkSession();
    
    const storedTheme = localStorage.getItem('finance_engine_theme');
    if (storedTheme) setTheme(storedTheme);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (isLoaded) {
      localStorage.setItem('finance_engine_theme', theme);
    }
  }, [theme, isLoaded]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <AppContext.Provider value={{ theme, toggleTheme, user, setUser }}>
      <main className="font-sans relative">
        {isLoaded && (
          <RouteGuard user={user} isLoaded={isLoaded}>
            <Component {...pageProps} />
          </RouteGuard>
        )}
      </main>
    </AppContext.Provider>
  );
}
