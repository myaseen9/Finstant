import { authenticatedFetch } from '../api/auth';
import { createContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { getMe } from '@/api/auth';
import { API_BASE } from '@/lib/api';
import { useThemeMode, useFontMode } from '@/lib/theme';
import '@/styles/globals.css';

import ActionHUD from '@/components/Common/ActionHUD';

export const AppContext = createContext();

function RouteGuard({ children, user, isLoaded }) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;

    const path = router.pathname;

    if (!user && path !== '/login' && path !== '/' && path !== '/landing') {
      setAuthorized(false);
      router.push('/login');
    } else if (user && path === '/login') {
      setAuthorized(true);
      router.push('/');
    } else if (user && (path === '/admin' || path === '/users') && user.role !== 'admin' && user.role !== 'superadmin') {
      setAuthorized(false);
      router.push('/');
    } else {
      setAuthorized(true);
    }
  }, [user, router.pathname, isLoaded]);

  return authorized ? children : null;
}

export default function App({ Component, pageProps }) {
  const [user, setUser] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [hud, setHud] = useState(null);

  const showHUD = ({ title, subtitle, type = 'success', duration = 1800 }) => {
    setHud({ title, subtitle, type, duration, key: Date.now() });
  };

  const { theme, themeMode, setThemeMode, toggleTheme } = useThemeMode();
  const { font, setFont, fontOptions } = useFontMode();

  useEffect(() => {
    const checkSession = async () => {
      try {
        const userData = await getMe();
        if (userData) setUser(userData);
      } catch {
        // Not logged in
      }
      setIsLoaded(true);
    };
    checkSession();
  }, []);

  // Load the chat list once there is a user to load it for.
  useEffect(() => {
    if (!user) {
      setChats([]);
      setActiveChatId(null);
      return;
    }

    let cancelled = false;

    authenticatedFetch(`${API_BASE}/chats`)
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => {
        if (cancelled || !Array.isArray(rows)) return;
        setChats(
          rows.map((row) => ({
            id: String(row.id),
            title: row.title || 'Untitled chat',
            createdAt: row.created_at,
            pinned: false,
            archived: false,
          })),
        );
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [user]);

  const contextValue = useMemo(
    () => ({
      theme,
      themeMode,
      setThemeMode,
      toggleTheme,
      font,
      setFont,
      fontOptions,
      user,
      setUser,
      chats,
      setChats,
      activeChatId,
      setActiveChatId,
      showHUD,
    }),
    [theme, themeMode, setThemeMode, toggleTheme, font, setFont, fontOptions, user, chats, activeChatId],
  );

  return (
    <AppContext.Provider value={contextValue}>
      <div className="relative">
        {isLoaded && (
          <RouteGuard user={user} isLoaded={isLoaded}>
            <Component {...pageProps} />
          </RouteGuard>
        )}
      </div>

      {hud && (
        <ActionHUD
          key={hud.key}
          title={hud.title}
          subtitle={hud.subtitle}
          type={hud.type}
          duration={hud.duration}
          onClose={() => setHud(null)}
        />
      )}
    </AppContext.Provider>
  );
}
