import { authenticatedFetch } from '../../api/auth';
import { useState, useEffect, useRef } from 'react';
import styles from './SearchModal.module.css'; // Reusing search modal styles for consistency

export default function FilesModal({ isOpen, onClose, onSelectReport }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      authenticatedFetch('/reports')
        .then(res => res.json())
        .then(data => {
          setReports(data);
          setLoading(false);
        })
        .catch(err => {
          console.error("Failed to fetch reports:", err);
          setLoading(false);
        });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      if (inputRef.current) {
        inputRef.current.focus();
      }
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getLogicalTitle = (content, fallbackTitle) => {
    // Extract the first markdown heading (e.g., "# Report Name" or "## Report Name")
    const match = content.match(/^#+\s+(.*)$/m);
    if (match) {
      // Remove any markdown bold/italic syntax that might be in the heading
      return match[1].replace(/[*_]/g, '').trim();
    }
    return fallbackTitle;
  };

  const filteredReports = reports.filter(report => {
    const logicalTitle = getLogicalTitle(report.content, report.chat_title);
    return logicalTitle.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.searchHeader}>
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.searchIcon}>
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline>
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search your saved reports..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
          <button className={styles.closeBtn} onClick={onClose} title="Close (Esc)">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div className={styles.resultsList}>
          {loading ? (
            <div className={styles.noResults}>Loading reports...</div>
          ) : filteredReports.length === 0 ? (
            <div className={styles.noResults}>No saved reports found.</div>
          ) : (
            filteredReports.map(report => {
              const logicalTitle = getLogicalTitle(report.content, report.chat_title);
              return (
                <button 
                  key={report.id} 
                  className={styles.resultItem}
                  onClick={() => {
                    onSelectReport({...report, logicalTitle});
                    onClose();
                  }}
                >
                  <div className={styles.resultLeft}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.bubbleIcon}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    <div className={styles.resultTitle}>{logicalTitle}</div>
                  </div>
                  <div className={styles.resultDate}>
                    {new Date(report.created_at).toLocaleDateString()}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
