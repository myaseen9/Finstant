import { useContext, useState, useEffect, useRef } from 'react';
import { AppContext } from '@/pages/_app';
import styles from './ProfileMenu.module.css';
import SettingsModal from './SettingsModal';

export default function ProfileMenu({ 
  isCollapsed = false, 
  onCollapsedClick, 
  autoOpen = false, 
  onCloseAutoOpen 
}) {
  const { theme, toggleTheme, user, setUser } = useContext(AppContext);
  const [isOpen, setIsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (autoOpen && !isCollapsed) {
      setIsOpen(true);
      if (onCloseAutoOpen) onCloseAutoOpen();
    }
  }, [autoOpen, isCollapsed, onCloseAutoOpen]);

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

  const handleProfileClick = () => {
    if (isCollapsed && onCollapsedClick) {
      onCollapsedClick();
    } else {
      setIsOpen(prev => !prev);
    }
  };

  const userName = user?.first_name || user?.firstName
    ? `${user.first_name || user.firstName} ${user.last_name || user.lastName || ''}`.trim()
    : user?.username || 'User';

  // Compute 2-letter initials (e.g. "MY" for Muhammad Yaseen)
  const getInitials = (u) => {
    if (!u) return 'U';
    const first = (u.first_name || u.firstName || '').trim();
    const last = (u.last_name || u.lastName || '').trim();
    if (first && last) {
      return `${first[0]}${last[0]}`.toUpperCase();
    }
    if (first) {
      return first.slice(0, 2).toUpperCase();
    }
    if (u.username) {
      const clean = u.username.replace(/[^a-zA-Z0-9]/g, '');
      return clean.slice(0, 2).toUpperCase() || 'U';
    }
    return 'U';
  };

  const userInitials = getInitials(user);

  return (
    <div className={styles.container} ref={menuRef}>
      {isOpen && (
        <div className={isCollapsed ? styles.dropdownMenuCollapsed : styles.dropdownMenu}>
          <div className={styles.dropdownHeader}>
            <div className={styles.avatarCircle}>
              {userInitials}
            </div>
            <div className={styles.headerText}>
              <span className={styles.headerName}>{userName}</span>
              <span className={styles.headerRole}>{user?.role || 'Member'}</span>
            </div>
          </div>

          <div className={styles.menuDivider}></div>

          <button className={styles.menuItem} onClick={toggleTheme}>
            <span className={styles.menuIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
            </span>
            {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
          </button>

          <button className={styles.menuItem} onClick={() => {
            setIsOpen(false);
            setIsSettingsOpen(true);
          }}>
            <span className={styles.menuIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            </span>
            Settings
          </button>

          <div className={styles.menuDivider}></div>

          <button className={styles.menuItem} onClick={() => setUser(null)}>
            <span className={styles.menuIcon}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </span>
            Log out
          </button>
        </div>
      )}

      {isCollapsed ? (
        <button 
          className={styles.profileBtnCollapsed} 
          onClick={handleProfileClick}
          aria-expanded={isOpen}
          title={userName}
        >
          <div className={styles.avatarCircle}>
            {userInitials}
          </div>
        </button>
      ) : (
        <button 
          className={styles.profileBtn} 
          onClick={handleProfileClick}
          aria-expanded={isOpen}
        >
          <div className={styles.userInfo}>
            <div className={styles.avatarCircle}>
              {userInitials}
            </div>
            <div className={styles.userDetails}>
              <span className={styles.username}>{userName}</span>
              <span className={styles.role}>{user?.role || 'Member'}</span>
            </div>
          </div>
        </button>
      )}

      
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
