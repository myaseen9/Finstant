import { useContext, useState, useEffect, useRef } from 'react';
import { AppContext } from '@/pages/_app';
import styles from './ProfileMenu.module.css';
import SettingsModal from './SettingsModal';

export default function ProfileMenu({ isCollapsed = false }) {
  const { theme, toggleTheme, user, setUser } = useContext(AppContext);
  const [isOpen, setIsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const userName = user?.firstName || user?.first_name
    ? `${user.firstName || user.first_name} ${user.lastName || user.last_name || ''}`.trim()
    : user?.username || 'Guest';
  const userInitials = user?.firstName?.charAt(0).toUpperCase()
    || user?.first_name?.charAt(0).toUpperCase()
    || user?.username?.charAt(0).toUpperCase()
    || 'U';

  return (
    <div className={`${styles.container} ${isCollapsed ? styles.containerCollapsed : ''}`} ref={menuRef}>
      {isOpen && (
        <div className={`${styles.dropdownMenu} ${isCollapsed ? styles.dropdownMenuCollapsed : ''}`}>
          <div className={styles.dropdownHeader}>
            <div className={styles.avatarLarge}>
              {user?.profile_picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.profile_picture} alt="Profile" className={styles.avatarImg} />
              ) : (
                userInitials
              )}
            </div>
            <div className={styles.headerText}>
              <span className={styles.headerName}>{userName}</span>
            </div>
            <div className={styles.chevron}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </div>
          </div>

          <div className={styles.menuDivider}></div>

          <button className={styles.menuItem} onClick={toggleTheme}>
            <span className={styles.menuIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
            </span>
            {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          </button>

          <button className={styles.menuItem} onClick={() => { setIsOpen(false); setIsSettingsOpen(true); }}>
            <span className={styles.menuIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </span>
            Settings
          </button>

          <div className={styles.menuDivider}></div>

          <button className={styles.menuItem} onClick={() => setUser(null)}>
            <span className={styles.menuIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </span>
            Log out
          </button>
        </div>
      )}

      <button
        className={`${styles.profileBtn} ${isCollapsed ? styles.profileBtnCollapsed : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        title={userName}
      >
        <div className={styles.avatar}>
          {user?.profile_picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.profile_picture} alt="Profile" className={styles.avatarImg} />
          ) : (
            userInitials
          )}
        </div>
        {!isCollapsed && (
          <div className={styles.userDetails}>
            <span className={styles.username}>{userName}</span>
          </div>
        )}
      </button>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
