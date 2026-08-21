import { useContext, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './Sidebar.module.css';
import { AppContext } from '@/pages/_app';
import ProfileMenu from '../ProfileMenu/ProfileMenu';
import SearchModal from './SearchModal';
import ArchiveModal from './ArchiveModal';
import ChatActionMenu from './ChatActionMenu';

/* ─── Icon helpers ─────────────────────────────────────── */
const NewChatIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
  </svg>
);

const FilesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
    <polyline points="13 2 13 9 20 9"/>
  </svg>
);

const DatabaseIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <ellipse cx="12" cy="5" rx="9" ry="3"/>
    <path d="M3 5V19A9 3 0 0 0 21 19V5"/>
    <path d="M3 12A9 3 0 0 0 21 12"/>
  </svg>
);

const UsersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const PinIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="12" y1="17" x2="12" y2="22"/>
    <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>
  </svg>
);

/* ─── Tooltip wrapper for collapsed state ───────────────── */
function Tooltip({ label, children, show }) {
  if (!show) return children;
  return (
    <div className={styles.tooltipWrapper}>
      {children}
      <span className={styles.tooltip}>{label}</span>
    </div>
  );
}

export default function Sidebar({ chats = [], setChats, activeChatId, setActiveChatId, isCollapsed, onToggleCollapse }) {
  const { user } = useContext(AppContext);
  const router = useRouter();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingChatId, setEditingChatId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const menuBtnRefs = useRef({});

  const activeChats = chats.filter(c => !c.archived);
  const archivedChats = chats.filter(c => c.archived);

  const handleNewChat = () => {
    if (router.pathname !== '/') {
      router.push('/');
    } else {
      setActiveChatId(null);
    }
  };

  const handlePin = (id, e) => {
    e.stopPropagation();
    setChats(prev => prev.map(c =>
      c.id === id ? { ...c, pinned: !c.pinned } : c
    ).sort((a, b) => b.pinned - a.pinned));
  };

  const handleDelete = (id, e) => {
    e.stopPropagation();
    setChats(prev => prev.filter(c => c.id !== id));
    if (activeChatId === id) setActiveChatId(null);
  };

  const handleRenameStart = (chat, e) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditTitle(chat.title);
  };

  const handleRenameSubmit = (id, e) => {
    if (e) e.stopPropagation();
    if (editTitle.trim()) {
      setChats(prev => prev.map(c =>
        c.id === id ? { ...c, title: editTitle.trim() } : c
      ));
    }
    setEditingChatId(null);
  };

  const handleArchive = (id, e) => {
    if (e) e.stopPropagation();
    setChats(prev => prev.map(c =>
      c.id === id ? { ...c, archived: true, pinned: false } : c
    ));
    if (activeChatId === id) setActiveChatId(null);
  };

  const handleUnarchive = (id) => {
    setChats(prev => prev.map(c =>
      c.id === id ? { ...c, archived: false } : c
    ));
  };

  return (
    <aside className={`${styles.sidebar} ${isCollapsed ? styles.sidebarCollapsed : ''}`}>

      {/* ── Logo / Toggle ───────────────────────────────── */}
      <div className={styles.brandBanner}>
        <button
          className={styles.logoToggleBtn}
          onClick={onToggleCollapse}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Finstant Logo" className={styles.bannerLogo} />
        </button>
        <AnimatePresence>
          {!isCollapsed && (
            <motion.span
              className={styles.bannerText}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.18 }}
            >
              FINSTΛNT
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* ── New Chat ────────────────────────────────────── */}
      <div className={styles.newChatSection}>
        <Tooltip label="New chat" show={isCollapsed}>
          <motion.button
            className={`${styles.newChatBtn} ${isCollapsed ? styles.newChatBtnCollapsed : ''}`}
            onClick={handleNewChat}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            title="New chat"
          >
            <NewChatIcon />
            <AnimatePresence>
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.18 }}
                  style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
                >
                  New chat
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </Tooltip>
      </div>

      {/* ── Nav Menu ────────────────────────────────────── */}
      <div className={styles.navMenu}>
        <Tooltip label="Files" show={isCollapsed}>
          <motion.button
            className={`${styles.navMenuItem} ${isCollapsed ? styles.navMenuItemCollapsed : ''}`}
            onClick={() => alert('Files coming soon!')}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            title="Files"
          >
            <FilesIcon />
            <AnimatePresence>
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.18 }}
                  style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
                >
                  Files
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </Tooltip>
      </div>

      {/* ── Chat History (only expanded) ────────────────── */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            className={styles.adminChatsWrapper}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <div className={styles.chatList}>
              {chats.length > 0 && (
                <motion.div layout>
                  <div className={styles.sectionHeaderRow}>
                    <span className={styles.sectionHeader}>Recents</span>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      {archivedChats.length > 0 && (
                        <button className={styles.iconBtn} onClick={() => setIsArchiveOpen(true)} title="Archived chats">
                          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                        </button>
                      )}
                      <button className={styles.iconBtn} onClick={() => setIsSearchOpen(true)} title="Search chats">
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                      </button>
                    </div>
                  </div>
                  <AnimatePresence>
                    {activeChats.map(chat => (
                      <motion.div
                        key={chat.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.18 }}
                        className={`${styles.chatItem} ${activeChatId === chat.id ? styles.active : ''}`}
                        onClick={() => setActiveChatId(chat.id)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className={styles.chatTitleContainer}>
                          {editingChatId === chat.id ? (
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRenameSubmit(chat.id, e);
                                if (e.key === 'Escape') { e.stopPropagation(); setEditingChatId(null); }
                              }}
                              onBlur={(e) => handleRenameSubmit(chat.id, e)}
                              autoFocus
                              style={{ background: 'transparent', border: 'none', color: 'inherit', width: '100%', outline: 'none', fontSize: 'inherit', borderBottom: '1px solid var(--color-primary)' }}
                            />
                          ) : (
                            <span className={styles.chatTitle}>{chat.title}</span>
                          )}
                        </div>
                        <div className={`${styles.actions} ${chat.pinned ? styles.pinnedActions : ''}`}>
                          {(chat.pinned || activeChatId === chat.id || openMenuId === chat.id) && (
                            <button className={styles.iconBtn} onClick={(e) => handlePin(chat.id, e)} title="Pin chat">
                              <PinIcon className={`${styles.pinBtn} ${chat.pinned ? styles.pinned : ''}`} />
                            </button>
                          )}
                          <div className={styles.relative}>
                            <button
                              ref={el => menuBtnRefs.current[chat.id] = el}
                              className={styles.iconBtn}
                              onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === chat.id ? null : chat.id); }}
                              title="More options"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                            </button>
                            <ChatActionMenu
                              isOpen={openMenuId === chat.id}
                              onClose={() => setOpenMenuId(null)}
                              onPin={(e) => { handlePin(chat.id, e); setOpenMenuId(null); }}
                              onRename={(e) => { handleRenameStart(chat, e); setOpenMenuId(null); }}
                              onArchive={(e) => { handleArchive(chat.id, e); setOpenMenuId(null); }}
                              onDelete={(e) => { handleDelete(chat.id, e); setOpenMenuId(null); }}
                              isPinned={chat.pinned}
                              getButtonElement={() => menuBtnRefs.current[chat.id]}
                            />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Footer (admin + profile) ─────────────────────── */}
      <div className={styles.footer}>
        {(user?.role === 'admin' || user?.role === 'superadmin') && (
          <>
            <Tooltip label="Data Management" show={isCollapsed}>
              <motion.button
                className={`${styles.adminNavBtn} ${isCollapsed ? styles.adminNavBtnCollapsed : ''}`}
                onClick={() => router.push('/admin')}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                title="Data Management"
              >
                <DatabaseIcon />
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.18 }}
                      style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
                    >
                      Data Management
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </Tooltip>

            <Tooltip label="User Management" show={isCollapsed}>
              <motion.button
                className={`${styles.adminNavBtn} ${isCollapsed ? styles.adminNavBtnCollapsed : ''}`}
                onClick={() => router.push('/users')}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                title="User Management"
              >
                <UsersIcon />
                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      transition={{ duration: 0.18 }}
                      style={{ overflow: 'hidden', whiteSpace: 'nowrap' }}
                    >
                      User Management
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            </Tooltip>
          </>
        )}

        {/* ProfileMenu gets isCollapsed so it can render icon-only */}
        <ProfileMenu isCollapsed={isCollapsed} />
      </div>

      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        chats={chats}
        onSelectChat={setActiveChatId}
      />
      <ArchiveModal
        isOpen={isArchiveOpen}
        onClose={() => setIsArchiveOpen(false)}
        archivedChats={archivedChats}
        onUnarchive={handleUnarchive}
      />
    </aside>
  );
}
