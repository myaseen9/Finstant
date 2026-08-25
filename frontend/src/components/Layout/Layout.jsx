import { useState, useContext, useEffect, useRef } from 'react';
import Sidebar from '../Sidebar/Sidebar';
import styles from './Layout.module.css';
import { AppContext } from '@/pages/_app';

const MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12"></line>
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <line x1="3" y1="18" x2="21" y2="18"></line>
  </svg>
);

export default function Layout({ children }) {
  const { chats, setChats, activeChatId, setActiveChatId } = useContext(AppContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const idleTimerRef = useRef(null);

  // Auto-dock timer (10 seconds of idle inactivity outside sidebar for quick testing)
  const startIdleTimer = () => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setIsDesktopCollapsed(true);
    }, 10000);
  };

  const clearIdleTimer = () => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  };

  useEffect(() => {
    startIdleTimer();
    return () => clearIdleTimer();
  }, []);

  const handleSidebarMouseEnter = () => {
    clearIdleTimer();
  };

  const handleSidebarMouseLeave = () => {
    startIdleTimer();
  };

  return (
    <div className={styles.container}>
      <div className={styles.mobileHeader}>
        <button className={styles.menuBtn} onClick={() => setIsSidebarOpen(true)}>
          <MenuIcon />
        </button>
        <span className={styles.mobileTitle}>Finstant</span>
      </div>

      {isSidebarOpen && (
        <div className={styles.overlay} onClick={() => setIsSidebarOpen(false)} />
      )}

      <div 
        className={`${styles.sidebarWrapper} ${isSidebarOpen ? styles.open : ''} ${isDesktopCollapsed ? styles.collapsed : ''}`}
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
      >
        <Sidebar 
          chats={chats} 
          setChats={setChats} 
          activeChatId={activeChatId} 
          isCollapsed={isSidebarOpen ? false : isDesktopCollapsed}
          onToggleCollapse={() => {
            clearIdleTimer();
            setIsDesktopCollapsed(prev => !prev);
          }}
          setActiveChatId={(id) => {
            setActiveChatId(id);
            setIsSidebarOpen(false); // Auto close on mobile
          }} 
        />
      </div>

      <main className={`${styles.mainContent} ${isDesktopCollapsed ? styles.contentCollapsed : ''}`}>
        {children}
      </main>
    </div>
  );
}
