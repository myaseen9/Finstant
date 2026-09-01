import { authenticatedFetch } from '../../api/auth';
import { useState, useEffect, useRef, useContext } from 'react';
import { AppContext } from '@/pages/_app';
import styles from './AdminPanel.module.css';

export default function AdminPanel() {
  const { showHUD } = useContext(AppContext);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState({ type: '', text: '' });
  const [history, setHistory] = useState([]);
  const [pendingUpload, setPendingUpload] = useState(null);
  const [showMasterMenu, setShowMasterMenu] = useState(false);
  const [showLiveFilesModal, setShowLiveFilesModal] = useState(false);
  const [liveFilesData, setLiveFilesData] = useState(null);
  const [loadingLiveFiles, setLoadingLiveFiles] = useState(false);
  const fileInputRef = useRef(null);

  const fetchHistory = () => {
    authenticatedFetch('http://127.0.0.1:8000/uploads')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setHistory(data);
      })
      .catch(err => console.error("Failed to fetch upload history:", err));
  };

  const fetchLiveFiles = async () => {
    setShowMasterMenu(false);
    setLoadingLiveFiles(true);
    setShowLiveFilesModal(true);
    try {
      const res = await authenticatedFetch('http://127.0.0.1:8000/live-files');
      if (res.ok) {
        const data = await res.json();
        setLiveFilesData(data);
      }
    } catch (err) {
      console.error("Failed to fetch live files:", err);
    } finally {
      setLoadingLiveFiles(false);
    }
  };

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(() => {
      fetchHistory();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const processUpload = async (file, replaceTarget = null) => {
    setUploading(true);
    setUploadMessage({ type: 'info', text: 'Analyzing file contents... This may take a moment.' });
    setPendingUpload(null);

    const tempId = 'temp_' + Date.now();
    const optimisticFile = {
      id: tempId,
      filename: file.name,
      size_bytes: file.size,
      status: 'Uploading',
      progress: 0,
      created_at: new Date().toISOString()
    };
    setHistory(prev => [optimisticFile, ...prev]);

    const formData = new FormData();
    formData.append('file', file);

    const url = replaceTarget 
      ? `http://127.0.0.1:8000/upload?replace_target=${encodeURIComponent(replaceTarget)}`
      : 'http://127.0.0.1:8000/upload';

    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('finstant_token') : null;
      const result = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            setHistory(prev => prev.map(f => f.id === tempId ? { ...f, progress: percentComplete } : f));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch (err) {
              resolve({ status: 'success' });
            }
          } else {
            try {
              reject(JSON.parse(xhr.responseText));
            } catch (err) {
              reject({ error: 'Upload failed' });
            }
          }
        };

        xhr.onerror = () => reject({ error: 'Network error' });
        xhr.send(formData);
      });

      if (result.status === 'requires_confirmation') {
        setPendingUpload({
          file: file,
          replace_target: result.target_file,
          message: result.message
        });
        setUploadMessage({ type: '', text: '' });
        setHistory(prev => prev.filter(f => f.id !== tempId));
        return;
      }

      setUploadMessage({ type: 'success', text: 'File successfully processed and ingested!' });
      if (showHUD) {
        showHUD({
          title: 'Master File Ingested',
          subtitle: 'All financial datasets synchronized',
          type: 'success'
        });
      }
      fetchHistory();
    } catch (err) {
      setUploadMessage({ type: 'error', text: err.detail || err.error || 'Failed to upload and ingest file.' });
      setHistory(prev => prev.map(f => f.id === tempId ? { ...f, status: 'Error' } : f));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = null;
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx')) {
      setUploadMessage({ type: 'error', text: 'Only .xlsx files are supported.' });
      return;
    }

    processUpload(file);
  };

  const handleWipeAll = async () => {
    setShowMasterMenu(false);
    if (!window.confirm("CRITICAL WARNING: This will permanently delete ALL uploaded files and completely wipe the Knowledge Base database. Are you absolutely sure?")) return;
    
    try {
      const res = await authenticatedFetch('http://127.0.0.1:8000/wipe-knowledge-base', { method: 'DELETE' });
      if (res.ok) {
        fetchHistory();
        if (showHUD) {
          showHUD({
            title: 'Database Wiped',
            subtitle: 'Knowledge base reset to clean state',
            type: 'warning'
          });
        }
        alert("Knowledge Base has been completely wiped.");
      } else {
        alert("Failed to wipe database.");
      }
    } catch (err) {
      alert("Network error.");
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm("Are you sure you want to clear the upload history log? This will reset the history list without deleting active database tables.")) return;
    try {
      const res = await authenticatedFetch('http://127.0.0.1:8000/clear-upload-history', { method: 'DELETE' });
      if (res.ok) {
        setHistory([]);
        if (showHUD) {
          showHUD({
            title: 'History Cleared',
            subtitle: 'Upload history log reset',
            type: 'info'
          });
        }
      } else {
        alert("Failed to clear upload history.");
      }
    } catch (err) {
      alert("Network error.");
    }
  };


  const confirmReplace = () => {
    if (pendingUpload) {
      processUpload(pendingUpload.file, pendingUpload.replace_target);
    }
  };

  const cancelReplace = () => {
    setPendingUpload(null);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = null;
  };

  const formatSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className={styles.container}>
      {pendingUpload && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalIcon}>⚠️</div>
            <h3>Update Detected</h3>
            <p>{pendingUpload.message}</p>
            <div className={styles.modalActions}>
              <button onClick={cancelReplace} className={styles.btnCancel}>Cancel</button>
              <button onClick={confirmReplace} className={styles.btnReplace}>Replace Existing Data</button>
            </div>
          </div>
        </div>
      )}

      {/* Live Files in Database Modal */}
      {showLiveFilesModal && (
        <div className={styles.modalOverlay} onClick={() => setShowLiveFilesModal(false)}>
          <div className={styles.liveModalCard} onClick={e => e.stopPropagation()}>
            <div className={styles.liveModalHeader}>
              <div className={styles.liveModalTitleGroup}>
                <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color: '#10b981'}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                <h3>Active Files in Database</h3>
              </div>
              <button className={styles.liveModalCloseBtn} onClick={() => setShowLiveFilesModal(false)}>✕</button>
            </div>

            <div className={styles.liveModalBody}>
              {loadingLiveFiles ? (
                <p style={{textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem 0'}}>Checking active database records...</p>
              ) : !liveFilesData || liveFilesData.live_files.length === 0 ? (
                <div style={{textAlign: 'center', padding: '2rem 1rem'}}>
                  <div style={{fontSize: '2.5rem', marginBottom: '0.75rem'}}>📂</div>
                  <h4 style={{margin: '0 0 0.5rem 0', color: 'var(--color-text)'}}>No Active Files in Database</h4>
                  <p style={{margin: 0, color: 'var(--color-text-muted)', fontSize: '0.9rem'}}>The knowledge base is currently clean. Upload an Excel workbook to populate financial tables.</p>
                </div>
              ) : (
                <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                  {liveFilesData.live_files.map((file, idx) => (
                    <div key={idx} style={{background: 'var(--color-surface-hover, rgba(0,0,0,0.03))', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '1rem'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                          <span style={{fontSize: '1.2rem'}}>📊</span>
                          <span style={{fontWeight: '600', color: 'var(--color-text)', fontSize: '0.95rem'}}>{file.filename}</span>
                        </div>
                        <span style={{background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600'}}>
                          ● Live in DB
                        </span>
                      </div>
                      {file.sheets && file.sheets.length > 0 && (
                        <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.4rem'}}>
                          {file.sheets.map((sheet, sIdx) => (
                            <span key={sIdx} style={{background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '6px', padding: '2px 8px', fontSize: '0.8rem', color: 'var(--color-text-muted)'}}>
                              {sheet}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem'}}>
              <button onClick={() => setShowLiveFilesModal(false)} className={styles.btnCancel} style={{padding: '0.5rem 1.25rem'}}>Close</button>
            </div>
          </div>
        </div>
      )}

      <h1 className={styles.title}>Data Management</h1>
      
      <div className={styles.uploadSection}>
        <div className={styles.uploadHeader}>
          <p>Upload a new Excel (.xlsx) file to append data to the financial engine.</p>
        </div>
        
        <label className={`${styles.uploadDropzone} ${uploading ? styles.uploading : ''}`}>
          <input 
            type="file" 
            accept=".xlsx" 
            onChange={handleFileUpload} 
            disabled={uploading}
            className={styles.fileInput}
            ref={fileInputRef}
          />
          <div className={styles.uploadContent}>
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.uploadIcon}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            <span>{uploading ? 'Processing Upload...' : 'Click or Drag & Drop Excel File'}</span>
          </div>
        </label>
        
        {uploadMessage.text && (
          <div className={`${styles.uploadMessage} ${styles[uploadMessage.type]}`}>
            {uploadMessage.text}
          </div>
        )}
      </div>

      <div className={styles.masterFileSection}>
        <div className={styles.masterFileInfo}>
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          <div>
            <h3>Master Financial Dataset.xlsx</h3>
            <p>The fully compiled dataset containing all appended records.</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <a href="http://127.0.0.1:8000/download-master" className={styles.downloadMasterBtn}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Master File
          </a>
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setShowMasterMenu(!showMasterMenu)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', color: '#6b7280', borderRadius: '4px' }}
              title="More options"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
            </button>
            {showMasterMenu && (
              <div style={{ position: 'absolute', top: '100%', right: '0', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '4px', zIndex: 10, minWidth: '160px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' }}>
                <button 
                  onClick={fetchLiveFiles}
                  style={{ width: '100%', background: 'none', border: 'none', color: 'var(--color-text)', padding: '8px 12px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '4px', fontSize: '0.875rem' }}
                  onMouseEnter={(e) => e.target.style.background = 'var(--color-surface-hover, rgba(0,0,0,0.05))'}
                  onMouseLeave={(e) => e.target.style.background = 'none'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                  Live Files
                </button>
                <button 
                  onClick={handleWipeAll}
                  style={{ width: '100%', background: 'none', border: 'none', color: '#ef4444', padding: '8px 12px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '4px', fontSize: '0.875rem' }}
                  onMouseEnter={(e) => e.target.style.background = 'rgba(239, 68, 68, 0.1)'}
                  onMouseLeave={(e) => e.target.style.background = 'none'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  Wipe Database
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.historySection}>
        <div className={styles.historyHeader}>
          <h2>Upload History</h2>
          {history.length > 0 && (
            <button 
              onClick={handleClearHistory}
              className={styles.btnClearHistory}
              title="Clear upload history log"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Clear History
            </button>
          )}
        </div>
        {history.length === 0 ? (

          <p className={styles.noHistory}>No files uploaded yet.</p>
        ) : (
          <div className={styles.historyList}>
            {history.map(file => (
              <div key={file.id} className={styles.historyItem}>
                <div className={styles.fileDetails}>
                  <div className={styles.fileName}>{file.filename}</div>
                  <div className={styles.fileMeta}>
                    <span>{formatSize(file.size_bytes)}</span>
                    <span>•</span>
                    <span>{formatDate(file.created_at)}</span>
                  </div>
                </div>
                
                <div className={styles.fileStatus}>
                  {file.status === 'Uploading' ? (
                    <div className={styles.progressContainer}>
                      <span className={styles.statusTextIngesting}>Uploading {file.progress || 0}%...</span>
                      <div className={styles.progressBar}>
                        <div className={styles.progressFillIngesting} style={{ width: `${file.progress || 0}%`, animation: 'none' }}></div>
                      </div>
                    </div>
                  ) : file.status === 'Ingesting' ? (
                    <div className={styles.progressContainer}>
                      <span className={styles.statusTextIngesting}>Ingesting...</span>
                      <div className={styles.progressBar}>
                        <div className={styles.progressFillIngesting}></div>
                      </div>
                    </div>
                  ) : file.status === 'Error' ? (
                    <span className={styles.statusTextError}>Failed</span>
                  ) : file.status === 'Replaced' ? (
                    <span className={styles.statusTextReplaced} style={{color: '#9ca3af', fontSize: '0.8rem', fontStyle: 'italic'}}>Replaced</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
