import { useContext, useState, useRef, useEffect } from 'react';
import { authenticatedFetch } from '../../api/auth';
import { useRouter } from 'next/router';
import styles from './Sidebar.module.css';
import { AppContext } from '@/pages/_app';
import ProfileMenu from '../ProfileMenu/ProfileMenu';
import SearchModal from './SearchModal';
import ArchiveModal from './ArchiveModal';
import ChatActionMenu from './ChatActionMenu';
import FilesModal from './FilesModal';
import ReportViewerModal from './ReportViewerModal';

const PinIcon = ({ className, isPinned = false }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="14" 
    height="14" 
    viewBox="0 0 24 24" 
    fill={isPinned ? "currentColor" : "none"} 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <ellipse cx="12" cy="4" rx="5" ry="1.5" />
    <path d="M9 4.5v5.5c0 .6-.3 1.2-.8 1.6C7.2 12.4 6 13.6 6 15c0 .6.4 1 1 1h10c.6 0 1-.4 1-1 0-1.4-1.2-2.6-2.2-3.4-.5-.4-.8-1-.8-1.6V4.5" />
    <line x1="12" y1="16" x2="12" y2="22" strokeWidth="2.2" />
  </svg>
);

export default function Sidebar({ 
  chats = [], 
  setChats = () => {}, 
  activeChatId, 
  setActiveChatId = () => {}, 
  isCollapsed = false,
  onToggleCollapse = () => {} 
}) {
  const { user, showHUD } = useContext(AppContext);
  const router = useRouter();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isFilesOpen, setIsFilesOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  
  // Files and Recents collapsible states (hidden by default)
  const [isFilesDropdownOpen, setIsFilesDropdownOpen] = useState(false);
  const [sidebarReports, setSidebarReports] = useState([]);
  const [isRecentsOpen, setIsRecentsOpen] = useState(false);
  const [autoOpenProfile, setAutoOpenProfile] = useState(false);
  
  const [openMenuId, setOpenMenuId] = useState(null);
  const [editingChatId, setEditingChatId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const menuBtnRefs = useRef({});

  // Fetch saved reports on mount & when Files dropdown opens
  useEffect(() => {
    authenticatedFetch('/reports')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setSidebarReports(data);
      })
      .catch(err => console.error("Sidebar reports error:", err));
  }, [isFilesDropdownOpen]);

  const getReportLogicalTitle = (content, fallbackTitle) => {
    if (!content) return fallbackTitle || 'Financial Report';
    const match = content.match(/^#+\s+(.*)$/m);
    if (match) {
      return match[1].replace(/[*_]/g, '').trim();
    }
    return fallbackTitle || 'Financial Report';
  };

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

  const handleDelete = async (id, e) => {
    if (e) e.stopPropagation();
    setChats(prev => prev.filter(c => c.id !== id));
    if (activeChatId === id) setActiveChatId(null);
    setSidebarReports(prev => prev.filter(r => r.session_id !== id));

    if (showHUD) {
      showHUD({
        title: 'Chat Deleted',
        subtitle: 'Chat and generated files permanently removed',
        type: 'success'
      });
    }

    try {
      let res = await authenticatedFetch(`/chats/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        res = await authenticatedFetch(`/api/chats/${id}`, { method: 'DELETE' });
      }
      const reportsRes = await authenticatedFetch('/reports');
      if (reportsRes.ok) {
        const data = await reportsRes.json();
        if (Array.isArray(data)) setSidebarReports(data);
      }
    } catch (err) {
      console.error("Failed to delete chat:", err);
    }
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

  // When clicking Recents in collapsed mini-rail:
  const handleRecentsInCollapsed = () => {
    onToggleCollapse();
    setIsRecentsOpen(true);
  };

  // -------------------------------------------------------------------------
  // 1. MINI COLLAPSED RAIL VIEW (When Hidden/Collapsed)
  // -------------------------------------------------------------------------
  if (isCollapsed) {
    return (
      <aside className={`${styles.sidebarContainer} ${styles.collapsed}`}>
        <button className={styles.miniLogoBtn} onClick={onToggleCollapse} title="Click to expand sidebar" aria-label="Expand sidebar">
          <div className={styles.brandExecBadgeMini}>
            <img src="/logo.svg" alt="FINSTΛNT Owl Logo" className={styles.brandExecImgMini} />
          </div>
        </button>

        <div className={styles.railDivider} />

        <div className={styles.railList}>
          {/* New Chat */}
          <button className={styles.railPrimaryBtn} onClick={handleNewChat} title="New Chat">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>

          {/* Files */}
          <button 
            className={styles.railIconBtn} 
            onClick={() => {
              onToggleCollapse();
              setIsFilesDropdownOpen(true);
            }} 
            title="Files & Reports"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path></svg>
          </button>

          {/* Recents */}
          <button className={styles.railIconBtn} onClick={handleRecentsInCollapsed} title="Open Recents">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
              <path d="M3 3v5h5"></path>
              <path d="M12 7v5l4 2"></path>
            </svg>
          </button>

          {/* Admin Items (Openly in collapsed rail) */}
          {(user?.role === 'admin' || user?.role === 'superadmin') && (
            <>
              {/* User Management */}
              <button 
                className={`${styles.railIconBtn} ${router.pathname === '/users' ? styles.activeRail : ''}`}
                onClick={() => router.push('/users')} 
                title="User Management"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              </button>

              {/* Data Management */}
              <button 
                className={`${styles.railIconBtn} ${router.pathname === '/admin' ? styles.activeRail : ''}`}
                onClick={() => router.push('/admin')} 
                title="Data Management"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M3 5V19A9 3 0 0 0 21 19V5"></path><path d="M3 12A9 3 0 0 0 21 12"></path></svg>
              </button>

              {/* Dashboard */}
              <button 
                className={`${styles.railIconBtn} ${router.pathname === '/dashboard' ? styles.activeRail : ''}`}
                onClick={() => router.push('/dashboard')} 
                title="Dashboard"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
              </button>
            </>
          )}
        </div>

        {/* Profile (Expands sidebar & opens menu on click) */}
        <div className={styles.footer} style={{ border: 'none', paddingTop: 0 }}>
          <ProfileMenu 
            isCollapsed={true} 
            onCollapsedClick={() => {
              onToggleCollapse();
              setAutoOpenProfile(true);
            }}
          />
        </div>

        <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} chats={chats} onSelectChat={setActiveChatId} />
        <ArchiveModal isOpen={isArchiveOpen} onClose={() => setIsArchiveOpen(false)} archivedChats={archivedChats} onUnarchive={handleUnarchive} />
        <FilesModal isOpen={isFilesOpen} onClose={() => setIsFilesOpen(false)} onSelectReport={(r) => setSelectedReport(r)} />
        <ReportViewerModal isOpen={!!selectedReport} onClose={() => setSelectedReport(null)} report={selectedReport} />
      </aside>
    );
  }

  // -------------------------------------------------------------------------
  // 2. EXPANDED VIEW WITH EXACT REQUESTED ORDER
  // -------------------------------------------------------------------------
  return (
    <aside className={`${styles.sidebarContainer} ${styles.expanded}`}>
      {/* 1. Sab sy oper: LOGO And Name Horizontally + Minimal Sidebar Toggle Icon */}
      <div className={styles.brandRow}>
        <div className={styles.brandLogoTitle}>
          <div className={styles.brandExecBadge}>
            <img src="/logo.svg" alt="FINSTΛNT Owl Logo" className={styles.brandExecImg} />
          </div>
          <span className={styles.brandTitle}>FINST<span className={styles.lambda}>Λ</span>NT</span>
        </div>

        <button 
          type="button" 
          className={styles.sidebarToggleBtn} 
          onClick={onToggleCollapse} 
          title="Collapse sidebar"
          aria-label="Collapse sidebar"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="9" y1="3" x2="9" y2="21"/>
          </svg>
        </button>
      </div>

      <div className={styles.expandedScrollBody}>
        {/* 2. New Chat */}
        <button className={styles.newChatBtn} onClick={handleNewChat}>
          <span>New chat</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>

        {/* 3. Files (Collapsible Dropdown — Matching Reference Image) */}
        <div className={styles.recentsDropdownSection}>
          <div 
            className={`${styles.recentsAccordionHeader} ${isFilesDropdownOpen ? styles.activeHeader : ''}`}
            onClick={() => {
              setIsFilesDropdownOpen(!isFilesDropdownOpen);
            }}
          >
            <div className={styles.navItemLeft}>
              {/* Folder Icon */}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path>
              </svg>
              <span>Files</span>
            </div>
            
            <div className={styles.recentsHeaderActions}>
              {isFilesDropdownOpen && (
                <button 
                  className={styles.iconBtn} 
                  onClick={(e) => { e.stopPropagation(); setIsFilesOpen(true); }} 
                  title="View all files & reports"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </button>
              )}
              <span className={styles.recentsCollapseIndicator}>
                {isFilesDropdownOpen ? '▵' : '▿'}
              </span>
            </div>
          </div>

          {/* Files List when Dropdown is Open */}
          {isFilesDropdownOpen && (
            <div className={styles.recentsListContainer}>
              <div className={styles.treeGuideLine} />

              {sidebarReports.length > 0 ? (
                sidebarReports.map(report => {
                  const title = getReportLogicalTitle(report.content, report.chat_title);
                  const isSelected = selectedReport?.id === report.id;
                  return (
                    <div 
                      key={report.id} 
                      className={`${styles.chatItem} ${isSelected ? styles.active : ''}`}
                      onClick={() => setSelectedReport({ ...report, logicalTitle: title })}
                    >
                      <div className={styles.chatTitleContainer}>
                        <div className={styles.itemFolderIcon}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                          </svg>
                        </div>
                        <span className={styles.chatTitle} title={title}>{title}</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: '0.5rem 0.65rem', color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
                  No saved files yet.
                </div>
              )}
            </div>
          )}
        </div>

        {/* 4. Recents (Collapsible Dropdown — Matching Reference Image) */}
        <div className={styles.recentsDropdownSection}>
          <div 
            className={`${styles.recentsAccordionHeader} ${isRecentsOpen ? styles.activeHeader : ''}`}
            onClick={() => {
              setIsRecentsOpen(!isRecentsOpen);
            }}
          >
            <div className={styles.navItemLeft}>
              {/* Clock with Counter-Clockwise Arrow History Icon */}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                <path d="M3 3v5h5"></path>
                <path d="M12 7v5l4 2"></path>
              </svg>
              <span>Recents</span>
            </div>
            
            <div className={styles.recentsHeaderActions}>
              {isRecentsOpen && (
                <>
                  <button 
                    className={styles.iconBtn} 
                    onClick={(e) => { e.stopPropagation(); setIsSearchOpen(true); }} 
                    title="Search recents"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  </button>
                  {archivedChats.length > 0 && (
                    <button 
                      className={styles.iconBtn} 
                      onClick={(e) => { e.stopPropagation(); setIsArchiveOpen(true); }} 
                      title="Archived chats"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
                    </button>
                  )}
                </>
              )}
              <span className={styles.recentsCollapseIndicator}>
                {isRecentsOpen ? '▵' : '▿'}
              </span>
            </div>
          </div>

          {/* Recents Chat List when Dropdown is Open */}
          {isRecentsOpen && (
            <div className={styles.recentsListContainer}>
              {activeChats.length > 0 && <div className={styles.treeGuideLine} />}

              {activeChats.map(chat => (
                <div 
                  key={chat.id} 
                  className={`${styles.chatItem} ${activeChatId === chat.id && router.pathname === '/' ? styles.active : ''} ${openMenuId === chat.id ? styles.menuOpen : ''}`}
                  onClick={() => {
                    setActiveChatId(chat.id);
                    if (router.pathname !== '/') router.push('/');
                  }}
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
                      <button className={styles.iconBtn} onClick={(e) => handlePin(chat.id, e)} title={chat.pinned ? "Unpin chat" : "Pin chat"}>
                        <PinIcon className={`${styles.pinBtn} ${chat.pinned ? styles.pinned : ''}`} isPinned={chat.pinned} />
                      </button>
                    )}
                    
                    <div>
                      <button 
                        ref={el => { menuBtnRefs.current[chat.id] = el; }}
                        className={styles.iconBtn} 
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === chat.id ? null : chat.id);
                        }} 
                        title="More options"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {activeChats.length === 0 && (
                <div style={{ padding: '0.6rem 0.5rem', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                  No recent chats yet.
                </div>
              )}
            </div>
          )}
        </div>

        {/* 5. User Management (Admin / Superadmin) */}
        {(user?.role === 'admin' || user?.role === 'superadmin') && (
          <button 
            className={`${styles.navItemBtn} ${router.pathname === '/users' ? styles.navItemActive : ''}`}
            onClick={() => router.push('/users')}
          >
            <div className={styles.navItemLeft}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
              <span>User Management</span>
            </div>
          </button>
        )}

        {/* 6. Data Management (Admin / Superadmin) */}
        {(user?.role === 'admin' || user?.role === 'superadmin') && (
          <button 
            className={`${styles.navItemBtn} ${router.pathname === '/admin' ? styles.navItemActive : ''}`}
            onClick={() => router.push('/admin')}
          >
            <div className={styles.navItemLeft}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M3 5V19A9 3 0 0 0 21 19V5"></path><path d="M3 12A9 3 0 0 0 21 12"></path></svg>
              <span>Data Management</span>
            </div>
          </button>
        )}

        {/* 7. Dashboard (Admin / Superadmin) */}
        {(user?.role === 'admin' || user?.role === 'superadmin') && (
          <button 
            className={`${styles.navItemBtn} ${router.pathname === '/dashboard' ? styles.navItemActive : ''}`}
            onClick={() => router.push('/dashboard')}
          >
            <div className={styles.navItemLeft}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="3" y1="9" x2="21" y2="9"></line><line x1="9" y1="21" x2="9" y2="9"></line></svg>
              <span>Dashboard</span>
            </div>
          </button>
        )}
      </div>

      {/* 8. Last mai Profile */}
      <div className={styles.footer}>
        <ProfileMenu 
          isCollapsed={false}
          autoOpen={autoOpenProfile}
          onCloseAutoOpen={() => setAutoOpenProfile(false)}
        />
      </div>

      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} chats={chats} onSelectChat={setActiveChatId} />
      <ArchiveModal isOpen={isArchiveOpen} onClose={() => setIsArchiveOpen(false)} archivedChats={archivedChats} onUnarchive={handleUnarchive} />
      <FilesModal isOpen={isFilesOpen} onClose={() => setIsFilesOpen(false)} onSelectReport={(r) => setSelectedReport(r)} />
      <ReportViewerModal isOpen={!!selectedReport} onClose={() => setSelectedReport(null)} report={selectedReport} />

      {/* 3-Dot More Options Dropdown rendered OUTSIDE the scroller container */}
      {openMenuId && chats.find(c => c.id === openMenuId) && (() => {
        const activeMenuChat = chats.find(c => c.id === openMenuId);
        return (
          <ChatActionMenu 
            isOpen={true} 
            onClose={() => setOpenMenuId(null)}
            onPin={(e) => { handlePin(activeMenuChat.id, e); setOpenMenuId(null); }}
            onRename={(e) => { handleRenameStart(activeMenuChat, e); setOpenMenuId(null); }}
            onArchive={(e) => { handleArchive(activeMenuChat.id, e); setOpenMenuId(null); }}
            onDelete={(e) => { handleDelete(activeMenuChat.id, e); setOpenMenuId(null); }}
            isPinned={activeMenuChat.pinned}
            buttonRef={{ current: menuBtnRefs.current[activeMenuChat.id] }}
          />
        );
      })()}
    </aside>
  );
}
