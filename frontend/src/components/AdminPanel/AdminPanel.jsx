import { authenticatedFetch } from '../../api/auth';
import { useState, useEffect, useRef, useContext } from 'react';
import { AppContext } from '@/pages/_app';
import styles from './AdminPanel.module.css';

export default function AdminPanel() {
  const { showHUD } = useContext(AppContext);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState({ type: '', text: '' });
  const [history, setHistory] = useState([]);
  const [pendingUpload, setPendingUpload] = useState(null); // { file, replace_target, message }
  const [showMasterMenu, setShowMasterMenu] = useState(false);
  const fileInputRef = useRef(null);

  const fetchHistory = () => {
    authenticatedFetch('http://127.0.0.1:8000/uploads')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setHistory(data);
      })
      .catch(err => console.error("Failed to fetch upload history:", err));
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

    // Optimistic UI update: instantly show in history
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
            setHistory(prev => prev.map(f => 
              f.id === tempId ? { ...f, progress: percentComplete } : f
            ));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            let errorMsg = 'Upload failed';
            try {
              const errData = JSON.parse(xhr.responseText);
              errorMsg = errData.detail || errData.error || errData.message || errorMsg;
            } catch (e) {}
            reject(new Error(errorMsg));
          }
        };

        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(formData);
      });

      if (result.status === 'needs_confirmation') {
        setUploading(false);
        setHistory(prev => prev.filter(f => f.id !== tempId)); // Remove optimistic item
        setPendingUpload({
          file,
          replace_target: result.replace_target,
          message: result.message
        });
        setUploadMessage({ type: '', text: '' });
        return;
      }

      fetchHistory(); // This will replace the optimistic item with the real database record

      if (result.status === 'success' && !result.error) {
        setUploadMessage({ type: 'success', text: result.message || 'File uploaded successfully! Data is being ingested.' });
        if (showHUD) {
          showHUD({
            title: replaceTarget ? 'File Replaced' : 'File Ingested',
            subtitle: replaceTarget ? 'Dataset updated and synced live' : 'Tables created in database',
            type: 'success'
          });
        }
      } else {
        setHistory(prev => prev.filter(f => f.id !== tempId)); // Remove if failed
        setUploadMessage({ type: 'error', text: result.error || 'Failed to upload file.' });
      }
    } catch (err) {
      setHistory(prev => prev.filter(f => f.id !== tempId)); // Remove if failed
      setUploadMessage({ type: 'error', text: 'Network error. Could not connect to the ingestion engine.' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = null;
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.xlsx')) {
      setUploadMessage({ type: 'error', text: 'Please upload a valid .xlsx file.' });
      return;
    }
    processUpload(file);
  };

  const handleDeleteFile = async (id, filename) => {
    if (!window.confirm(`Are you sure you want to permanently delete ${filename} and all its appended data?`)) return;
    
    try {
      const res = await authenticatedFetch(`http://127.0.0.1:8000/upload/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (showHUD) {
          showHUD({
            title: 'Dataset Deleted',
            subtitle: `${filename} removed from system`,
            type: 'success'
          });
        }
        fetchHistory();
      } else {
        alert("Failed to delete file.");
      }
    } catch (err) {
      alert("Network error.");
    }
  };

  const handleWipeAll = async () => {
    setShowMasterMenu(false);
    if (!window.confirm("CRITICAL WARNING: This will permanently delete ALL uploaded files and completely wipe the Knowledge Base database. Are you absolutely sure?")) return;
    
    try {
      const res = await authenticatedFetch('http://127.0.0.1:8000/wipe-knowledge-base', { method: 'DELETE' });
      if (res.ok) {
        fetchHistory();
        alert("Knowledge Base has been completely wiped.");
      } else {
        alert("Failed to wipe database.");
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
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
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
              <div style={{ position: 'absolute', top: '100%', right: '0', background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', padding: '4px', zIndex: 10, minWidth: '150px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
                <button 
                  onClick={handleWipeAll}
                  style={{ width: '100%', background: 'none', border: 'none', color: '#ef4444', padding: '8px 12px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '4px', fontSize: '0.875rem' }}
                  onMouseEnter={(e) => e.target.style.background = '#374151'}
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
        <h2>Upload History</h2>
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
                  ) : (
                    <span className={styles.statusTextCompleted}>Live in database</span>
                  )}
                </div>

                <div className={styles.fileAction} style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => handleDeleteFile(file.id, file.filename)} title="Delete File & Data" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
