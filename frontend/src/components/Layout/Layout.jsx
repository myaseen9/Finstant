import { useState, useContext, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
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
  const router = useRouter();
  const { chats, setChats, activeChatId, setActiveChatId } = useContext(AppContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);

  return (
    <div className={styles.container}>
      <div className={styles.mobileHeader}>
        <button className={styles.menuBtn} onClick={() => setIsSidebarOpen(true)}>
          <MenuIcon />
        </button>
        <div className={styles.mobileBrand}>
          <div className={styles.mobileBrandBadge}>
            <img src="/logo.svg" alt="FINSTΛNT Logo" className={styles.mobileBrandImg} />
          </div>
          <span className={styles.mobileTitle}>FINST<span className={styles.lambda}>Λ</span>NT</span>
        </div>
      </div>

      {isSidebarOpen && (
        <div className={styles.overlay} onClick={() => setIsSidebarOpen(false)} />
      )}

      <div 
        className={`${styles.sidebarWrapper} ${isSidebarOpen ? styles.open : ''} ${isDesktopCollapsed ? styles.collapsed : ''}`}
      >
        <Sidebar 
          chats={chats} 
          setChats={setChats} 
          activeChatId={activeChatId} 
          isCollapsed={isSidebarOpen ? false : isDesktopCollapsed}
          onToggleCollapse={() => {
            setIsDesktopCollapsed(prev => !prev);
          }}
          setActiveChatId={(id) => {
            setActiveChatId(id);
            setIsSidebarOpen(false); // Auto close on mobile
          }} 
        />
      </div>

      <main className={`${styles.mainContent} ${isDesktopCollapsed ? styles.contentCollapsed : ''}`}>
        <div key={router.pathname} className={styles.pageTransitionWrapper}>
          {children}
        </div>
      </main>
    </div>
  );
}
