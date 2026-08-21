import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar from '../Sidebar/Sidebar';
import styles from './Layout.module.css';

const MenuIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="12" x2="21" y2="12"/>
    <line x1="3" y1="6" x2="21" y2="6"/>
    <line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
);

export default function Layout({ children, chats = [], setChats = () => {}, activeChatId, setActiveChatId = () => {} }) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={styles.container}>
      {/* ── Mobile header ─────────────────────────────────── */}
      <div className={styles.mobileHeader}>
        <button className={styles.menuBtn} onClick={() => setIsMobileSidebarOpen(true)}>
          <MenuIcon />
        </button>
        <span className={styles.mobileTitle}>FINSTΛNT</span>
      </div>

      {/* ── Mobile overlay ────────────────────────────────── */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <motion.div
            className={styles.overlay}
            onClick={() => setIsMobileSidebarOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar wrapper (desktop: animated width) ─────── */}
      <motion.div
        className={`${styles.sidebarWrapper} ${isMobileSidebarOpen ? styles.open : ''}`}
        animate={{ width: isCollapsed ? 60 : 248 }}
        transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      >
        <Sidebar
          chats={chats}
          setChats={setChats}
          activeChatId={activeChatId}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(prev => !prev)}
          setActiveChatId={(id) => {
            setActiveChatId(id);
            setIsMobileSidebarOpen(false);
          }}
        />
      </motion.div>

      {/* ── Main content ──────────────────────────────────── */}
      <main className={styles.mainContent}>
        {children}
      </main>
    </div>
  );
}
