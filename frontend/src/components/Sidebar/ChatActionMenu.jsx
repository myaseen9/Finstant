import { useEffect, useRef, useState, useContext } from 'react';
import styles from './ChatActionMenu.module.css';
import { AppContext } from '@/pages/_app';

export default function ChatActionMenu({ isOpen, onClose, onPin, onDelete, onRename, onArchive, isPinned, buttonRef }) {
  const menuRef = useRef(null);
  const { showHUD } = useContext(AppContext);
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    if (isOpen && buttonRef?.current) {
      const updatePosition = () => {
        const rect = buttonRef.current.getBoundingClientRect();
        const menuWidth = 175;
        const menuHeight = 175;

        // Vertical positioning: default below button, flip above if overflowing bottom
        let top = rect.bottom + 4;
        if (top + menuHeight > window.innerHeight) {
          top = Math.max(8, rect.top - menuHeight - 4);
        }

        // Horizontal positioning: align right edge with button, keep inside viewport
        let left = rect.right - menuWidth;
        if (left < 8) left = 8;
        if (left + menuWidth > window.innerWidth) {
          left = window.innerWidth - menuWidth - 8;
        }

        setCoords({ top, left });
      };

      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);

      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }
  }, [isOpen, buttonRef]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target) &&
        buttonRef?.current &&
        !buttonRef.current.contains(event.target)
      ) {
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, buttonRef]);

  if (!isOpen || !coords) return null;

  return (
    <div 
      className={styles.menuContainer} 
      ref={menuRef} 
      style={{
        position: 'fixed',
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        zIndex: 99999
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <button className={styles.menuItem} onClick={onRename}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
        Rename
      </button>
      <button className={styles.menuItem} onClick={onPin}>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="16" 
          height="16" 
          viewBox="0 0 24 24" 
          fill={isPinned ? "currentColor" : "none"} 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <ellipse cx="12" cy="4" rx="5" ry="1.5" />
          <path d="M9 4.5v5.5c0 .6-.3 1.2-.8 1.6C7.2 12.4 6 13.6 6 15c0 .6.4 1 1 1h10c.6 0 1-.4 1-1 0-1.4-1.2-2.6-2.2-3.4-.5-.4-.8-1-.8-1.6V4.5" />
          <line x1="12" y1="16" x2="12" y2="22" strokeWidth="2.2" />
        </svg>
        {isPinned ? 'Unpin chat' : 'Pin chat'}
      </button>
      <button className={styles.menuItem} onClick={onArchive}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>
        Archive
      </button>
      <button className={`${styles.menuItem} ${styles.danger}`} onClick={onDelete}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        Delete
      </button>
    </div>
  );
}
