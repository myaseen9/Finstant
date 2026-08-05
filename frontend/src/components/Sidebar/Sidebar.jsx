import { useContext, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import styles from './Sidebar.module.css';
import { AppContext } from '@/pages/_app';
import ProfileMenu from '../ProfileMenu/ProfileMenu';
import SearchModal from './SearchModal';
import ArchiveModal from './ArchiveModal';
import ChatActionMenu from './ChatActionMenu';

const PinIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="12" y1="17" x2="12" y2="22"></line>
    <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>
  </svg>
);

const TrashIcon = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>
);

export default function Sidebar({ chats = [], setChats, activeChatId, setActiveChatId, onToggleCollapse }) {
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

  const chatListContent = (
    <div className={styles.chatList}>
      {chats.length > 0 && (
        <div>
          <div className={styles.sectionHeaderRow}>
            <span className={styles.sectionHeader}>Recents</span>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              {archivedChats.length > 0 && (
                <button className={styles.iconBtn} onClick={() => setIsArchiveOpen(true)} title="Archived chats">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
                </button>
              )}
              <button className={styles.iconBtn} onClick={() => setIsSearchOpen(true)} title="Search chats">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              </button>
            </div>
          </div>
          {activeChats.map(chat => (
            <div 
              key={chat.id} 
              className={`${styles.chatItem} ${activeChatId === chat.id ? styles.active : ''}`}
              onClick={() => setActiveChatId(chat.id)}
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
                      if (e.key === 'Escape') {
                        e.stopPropagation();
                        setEditingChatId(null);
                      }
                    }}
                    onBlur={(e) => handleRenameSubmit(chat.id, e)}
                    autoFocus
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--color-border)',
                      color: 'var(--color-text)',
                      borderRadius: '4px',
                      padding: '2px 4px',
                      width: '100%',
                      outline: 'none',
                      fontSize: 'inherit'
                    }}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(openMenuId === chat.id ? null : chat.id);
                    }} 
                    title="More options"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                  </button>
                  <ChatActionMenu 
                    isOpen={openMenuId === chat.id} 
                    onClose={() => setOpenMenuId(null)}
                    onPin={(e) => {
                      handlePin(chat.id, e);
                      setOpenMenuId(null);
                    }}
                    onRename={(e) => {
                      handleRenameStart(chat, e);
                      setOpenMenuId(null);
                    }}
                    onArchive={(e) => {
                      handleArchive(chat.id, e);
                      setOpenMenuId(null);
                    }}
                    onDelete={(e) => {
                      handleDelete(chat.id, e);
                      setOpenMenuId(null);
                    }}
                    isPinned={chat.pinned}
                    buttonRef={{ current: menuBtnRefs.current[chat.id] }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <aside className={styles.sidebar}>
      <button className={`${styles.iconBtn} ${styles.collapseSidebarBtn}`} onClick={onToggleCollapse} title="Close sidebar">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
      </button>

      <div className={styles.brandBanner}>
        <div className={styles.bannerLogoWrapper}>
          <img src="/logo.svg" alt="Finstant Logo" className={styles.bannerLogo} />
        </div>
        <span className={styles.bannerText}>FINSTΛNT</span>
      </div>
      
      <div className={styles.newChatSection}>
        <button className={styles.newChatBtn} onClick={handleNewChat}>
          <span>New chat</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </button>
      </div>

      <div className={styles.navMenu}>
        <button className={styles.navMenuItem} onClick={() => alert("Files coming soon!")}>
          <span>Files</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
        </button>
      </div>
      
      <div className={styles.adminChatsWrapper}>
        {chatListContent}
      </div>

      <div className={styles.footer}>
        {(user?.role === 'admin' || user?.role === 'superadmin') && (
          <>
            <button 
              className={styles.adminNavBtn} 
              onClick={() => router.push('/admin')}
            >
              <span>Data Management</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M3 5V19A9 3 0 0 0 21 19V5"></path><path d="M3 12A9 3 0 0 0 21 12"></path></svg>
            </button>
            <button 
              className={styles.adminNavBtn} 
              onClick={() => router.push('/users')}
            >
              <span>User Management</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
            </button>
          </>
        )}
        <ProfileMenu />
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
