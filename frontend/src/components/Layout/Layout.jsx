import { useState } from 'react';
import Sidebar from '../Sidebar/Sidebar';
import styles from './Layout.module.css';

const MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12"></line>
    <line x1="3" y1="6" x2="21" y2="6"></line>
    <line x1="3" y1="18" x2="21" y2="18"></line>
  </svg>
);

export default function Layout({ children, chats = [], setChats = () => {}, activeChatId, setActiveChatId = () => {} }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);

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

      <div className={`${styles.sidebarWrapper} ${isSidebarOpen ? styles.open : ''} ${isDesktopCollapsed ? styles.collapsed : ''}`}>
        <Sidebar 
          chats={chats} 
          setChats={setChats} 
          activeChatId={activeChatId} 
          onToggleCollapse={() => setIsDesktopCollapsed(true)}
          setActiveChatId={(id) => {
            setActiveChatId(id);
            setIsSidebarOpen(false); // Auto close on mobile
          }} 
        />
      </div>

      {isDesktopCollapsed && (
        <button 
          className={styles.desktopExpandBtn} 
          onClick={() => setIsDesktopCollapsed(false)}
          title="Open sidebar"
        >
          <MenuIcon />
        </button>
      )}

      <main className={`${styles.mainContent} ${isDesktopCollapsed ? styles.contentCollapsed : ''}`}>
        {children}
      </main>
    </div>
  );
}
