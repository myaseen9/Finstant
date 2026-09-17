import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from './SearchModal.module.css'; // Reusing search modal styles for consistency

export default function ArchiveModal({ isOpen, onClose, archivedChats, onUnarchive }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.searchHeader}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.searchIcon}>
            <polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line>
          </svg>
          <div style={{ flex: 1, fontSize: '1rem', fontWeight: '500', color: 'var(--color-text)' }}>
            Archived Chats
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Close (Esc)">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div className={styles.resultsList}>
          {archivedChats.length === 0 ? (
            <div className={styles.noResults}>No archived chats.</div>
          ) : (
            archivedChats.map(chat => (
              <div key={chat.id} className={styles.resultItem} style={{ cursor: 'default' }}>
                <div className={styles.resultLeft}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.bubbleIcon}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                  <div className={styles.resultTitle}>{chat.title}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div className={styles.resultDate}>
                    {chat.created_at ? new Date(chat.created_at).toLocaleDateString() : ''}
                  </div>
                  <button 
                    onClick={() => onUnarchive(chat.id)}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--color-border)',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      color: 'var(--color-text)',
                      cursor: 'pointer',
                      fontSize: '0.8rem'
                    }}
                  >
                    Unarchive
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
