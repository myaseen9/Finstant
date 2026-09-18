import { authenticatedFetch } from '../../api/auth';
import { API_BASE } from '../../lib/api';
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
  const [activeFileMenu, setActiveFileMenu] = useState(null);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [deletingFile, setDeletingFile] = useState(false);
  const [targetReplaceFilename, setTargetReplaceFilename] = useState(null);
  const [pendingReplaceFile, setPendingReplaceFile] = useState(null);
  const [downloadingMaster, setDownloadingMaster] = useState(false);
  const [masterDownloaded, setMasterDownloaded] = useState(false);
  const fileInputRef = useRef(null);
  const replaceFileInputRef = useRef(null);
  const targetReplaceFileRef = useRef(null);
  const masterMenuRef = useRef(null);
  const masterTimerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (masterMenuRef.current && !masterMenuRef.current.contains(e.target)) {
        setShowMasterMenu(false);
      }
      if (!e.target.closest(`.${styles.liveFileActions}`)) {
        setActiveFileMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchHistory = () => {
    authenticatedFetch('/uploads')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setHistory(data);
      })
      .catch(err => console.error("Failed to fetch upload history:", err));
  };

  const fetchLiveFiles = async (showModal = true) => {
    setShowMasterMenu(false);
    setLoadingLiveFiles(true);
    if (showModal) setShowLiveFilesModal(true);
    try {
      const res = await authenticatedFetch('/live-files');
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

  const handleTriggerReplace = (filename) => {
    targetReplaceFileRef.current = filename;
    setTargetReplaceFilename(filename);
    setTimeout(() => {
      if (replaceFileInputRef.current) {
        replaceFileInputRef.current.value = null;
        replaceFileInputRef.current.click();
      }
    }, 50);
  };

  const handleReplaceFileSelected = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx')) {
      if (showHUD) {
        showHUD({ title: 'Invalid File', subtitle: 'Only .xlsx files are supported.', type: 'error' });
      }
      return;
    }

    const targetName = targetReplaceFileRef.current || targetReplaceFilename;
    setPendingReplaceFile({
      targetFilename: targetName,
      newFile: file
    });
  };

  const confirmReplaceLiveFile = () => {
    if (!pendingReplaceFile) return;
    const { newFile, targetFilename } = pendingReplaceFile;
    setPendingReplaceFile(null);
    setShowLiveFilesModal(false);
    processUpload(newFile, targetFilename);
  };

  const confirmDeleteLiveFile = async (filename) => {
    setDeletingFile(true);
    try {
      const res = await authenticatedFetch(`/delete-live-file?filename=${encodeURIComponent(filename)}`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.status === 'success') {
        if (showHUD) {
          showHUD({
            title: 'File Data Deleted',
            subtitle: `Data for "${filename}" removed from database`,
            type: 'success'
          });
        }
        await fetchLiveFiles(false);
        fetchHistory();
      } else {
        if (showHUD) {
          showHUD({
            title: 'Delete Failed',
            subtitle: data.error || data.detail || 'Could not delete file records',
            type: 'error'
          });
        }
      }
    } catch (err) {
      if (showHUD) {
        showHUD({
          title: 'Error',
          subtitle: err.message || 'Network error during file deletion',
          type: 'error'
        });
      }
    } finally {
      setDeletingFile(false);
      setFileToDelete(null);
    }
  };

  const handleDownloadMaster = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (downloadingMaster) return;
    setDownloadingMaster(true);

    try {
      const res = await authenticatedFetch('/download-master');
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      const rawBlob = await res.blob();
      // Explicit MIME type ensures Chrome/Edge native top-right download tray catches and animates
      const excelBlob = new Blob([rawBlob], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const downloadUrl = window.URL.createObjectURL(excelBlob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'Master_Financial_Dataset.xlsx';
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        window.URL.revokeObjectURL(downloadUrl);
        if (link.parentNode) link.parentNode.removeChild(link);
      }, 3000);

      setMasterDownloaded(true);
      if (masterTimerRef.current) clearTimeout(masterTimerRef.current);
      masterTimerRef.current = setTimeout(() => {
        setMasterDownloaded(false);
      }, 2600);

      if (showHUD) showHUD('Master Dataset downloaded successfully!', 'success');
    } catch (err) {
      console.error('Download Master error:', err);
      if (showHUD) showHUD('Failed to download Master File: ' + err.message, 'error');
    } finally {
      setDownloadingMaster(false);
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

    const base = API_BASE ? API_BASE : '';
    const url = replaceTarget 
      ? `${base}/upload?replace_target=${encodeURIComponent(replaceTarget)}`
      : `${base}/upload`;

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
      fetchLiveFiles(false);
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

  const [showWipeModal, setShowWipeModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

  const handleWipeAll = () => {
    setShowMasterMenu(false);
    setShowWipeModal(true);
  };

  const confirmWipeAll = async () => {
    setShowWipeModal(false);
    try {
      const res = await authenticatedFetch('/wipe-knowledge-base', { method: 'DELETE' });
      if (res.ok) {
        fetchHistory();
        if (showHUD) {
          showHUD({
            title: 'Database Wiped',
            subtitle: 'Knowledge base reset to clean state',
            type: 'warning'
          });
        }
      } else {
        if (showHUD) {
          showHUD({
            title: 'Wipe Failed',
            subtitle: 'Could not wipe knowledge base tables',
            type: 'error'
          });
        }
      }
    } catch (err) {
      if (showHUD) {
        showHUD({
          title: 'Network Error',
          subtitle: 'Connection lost during database wipe',
          type: 'error'
        });
      }
    }
  };

  const handleClearHistory = () => {
    setShowClearModal(true);
  };

  const confirmClearHistory = async () => {
    setShowClearModal(false);
    try {
      const res = await authenticatedFetch('/clear-upload-history', { method: 'DELETE' });
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
        if (showHUD) {
          showHUD({
            title: 'Clear Failed',
            subtitle: 'Could not reset upload history',
            type: 'error'
          });
        }
      }
    } catch (err) {
      if (showHUD) {
        showHUD({
          title: 'Network Error',
          subtitle: 'Connection lost during history clear',
          type: 'error'
        });
      }
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

      {/* Hidden file input for Replace File action */}
      <input 
        type="file" 
        accept=".xlsx" 
        ref={replaceFileInputRef}
        onChange={handleReplaceFileSelected}
        style={{ display: 'none' }} 
      />

      {/* Delete Specific Live File Confirmation Modal */}
      {fileToDelete && (
        <div className={styles.modalOverlay} style={{ zIndex: 1100 }} onClick={() => !deletingFile && setFileToDelete(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', color: '#ef4444', margin: '0 0 1rem 0' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
              <span>Delete File Records?</span>
            </h3>
            <p>
              Are you sure you want to delete all financial data originating from <strong>"{fileToDelete.filename}"</strong>?
              {fileToDelete.sheets && fileToDelete.sheets.length > 0 && (
                <span style={{ display: 'block', marginTop: '0.6rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                  This will remove records across {fileToDelete.sheets.length} sheet{fileToDelete.sheets.length > 1 ? 's' : ''} ({fileToDelete.sheets.join(', ')}). Other files will remain completely unaffected.
                </span>
              )}
            </p>
            <div className={styles.modalActions}>
              <button 
                type="button"
                onClick={() => setFileToDelete(null)} 
                className={styles.btnCancel}
                disabled={deletingFile}
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={() => confirmDeleteLiveFile(fileToDelete.filename)} 
                className={styles.btnDanger}
                disabled={deletingFile}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {deletingFile ? (
                  <>
                    <div style={{
                      width: 14,
                      height: 14,
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite'
                    }} />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete File Data</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Replace Live File Confirmation Modal */}
      {pendingReplaceFile && (
        <div className={styles.modalOverlay} style={{ zIndex: 1100 }} onClick={() => setPendingReplaceFile(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', color: '#f59e0b', margin: '0 0 1rem 0' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
              </svg>
              <span>Replace File Data</span>
            </h3>
            <p>
              Replace all existing financial records from <strong>"{pendingReplaceFile.targetFilename}"</strong> with updated workbook <strong>"{pendingReplaceFile.newFile.name}"</strong>?
              <span style={{ display: 'block', marginTop: '0.6rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                Old data for this file will be wiped and the new workbook will be ingested into the knowledge base.
              </span>
            </p>
            <div className={styles.modalActions}>
              <button 
                type="button"
                onClick={() => setPendingReplaceFile(null)} 
                className={styles.btnCancel}
              >
                Cancel
              </button>
              <button 
                type="button"
                onClick={confirmReplaceLiveFile} 
                className={styles.btnReplace}
              >
                Confirm & Replace
              </button>
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
                    <div key={idx} className={styles.liveFileCard}>
                      <div className={styles.liveFileHeader}>
                        <div className={styles.liveFileName}>{file.filename}</div>
                        <div className={styles.liveFileActions}>
                          <span className={styles.liveBadge}>● Live in DB</span>
                          <div style={{ position: 'relative' }}>
                            <button
                              type="button"
                              className={styles.liveFileMenuBtn}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveFileMenu(activeFileMenu === file.filename ? null : file.filename);
                              }}
                              title="File actions"
                              aria-label="File actions"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="1"></circle>
                                <circle cx="12" cy="5" r="1"></circle>
                                <circle cx="12" cy="19" r="1"></circle>
                              </svg>
                            </button>

                            {activeFileMenu === file.filename && (
                              <div 
                                className={styles.liveFileDropdown} 
                                onMouseDown={(e) => e.stopPropagation()} 
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  className={styles.liveFileDropdownItem}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveFileMenu(null);
                                    handleTriggerReplace(file.filename);
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                                  </svg>
                                  <span>Replace File</span>
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.liveFileDropdownItem} ${styles.liveFileDropdownDanger}`}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveFileMenu(null);
                                    setFileToDelete(file);
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                  </svg>
                                  <span>Delete File</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {file.sheets && file.sheets.length > 0 && (
                        <div className={styles.liveFileSheets}>
                          {file.sheets.map((sheet, sIdx) => (
                            <span key={sIdx} className={styles.liveFileSheetTag}>
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
        <div className={styles.masterCardGrid}>
          <div className={styles.masterFileInfo}>
            <div className={styles.masterFileIconBadge}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
            <div className={styles.masterFileText}>
              <h3 className={styles.masterFileTitle}>Master Financial Dataset.xlsx</h3>
              <p className={styles.masterFileDesc}>The fully compiled dataset containing all appended records.</p>
            </div>
          </div>

          <div className={styles.masterCardActions}>
            <button 
              type="button" 
              onClick={handleDownloadMaster} 
              disabled={downloadingMaster}
              className={`${styles.downloadMasterBtn} ${masterDownloaded ? styles.masterDownloadedSuccess : ''}`}
              style={{ cursor: downloadingMaster ? 'wait' : 'pointer', border: 'none' }}
              title={masterDownloaded ? "Master File Downloaded!" : "Download consolidated master Excel workbook"}
            >
              {downloadingMaster ? (
                <div style={{
                  width: 15,
                  height: 15,
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#fff',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  display: 'inline-block'
                }} />
              ) : masterDownloaded ? (
                <span className={styles.appleTickIcon}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </span>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
              )}
              <span>{downloadingMaster ? 'Generating...' : (masterDownloaded ? 'Downloaded' : 'Master File')}</span>
            </button>

            <div className={styles.moreMenuWrapper} ref={masterMenuRef}>
              <button 
                onClick={() => setShowMasterMenu(!showMasterMenu)}
                className={styles.moreOptionsBtn}
                title="More dataset options"
                aria-label="More dataset options"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
              </button>
              {showMasterMenu && (
                <div className={styles.dropdownMenu}>
                  <button onClick={fetchLiveFiles} className={styles.dropdownItem}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                    <span>Live Files in DB</span>
                  </button>
                  <button onClick={handleWipeAll} className={`${styles.dropdownItem} ${styles.dropdownDanger}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    <span>Wipe Database</span>
                  </button>
                </div>
              )}
            </div>
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

      {/* In-App Wipe Database Confirmation Modal */}
      {showWipeModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                Wipe Knowledge Base
              </h3>
              <button className={styles.closeBtn} onClick={() => setShowWipeModal(false)}>×</button>
            </div>
            <p className={styles.warningText} style={{ margin: '1rem 0 0.5rem', fontWeight: 600 }}>
              Are you sure you want to permanently wipe the entire Knowledge Base?
            </p>
            <p className={styles.warningTextSub} style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              This will drop all uploaded dataset tables and reset financial analytics to a clean slate. This action cannot be undone.
            </p>
            <div className={styles.modalActions} style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className={styles.btnCancel} onClick={() => setShowWipeModal(false)}>
                Cancel
              </button>
              <button 
                type="button" 
                onClick={confirmWipeAll}
                style={{ 
                  background: '#ef4444', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: '10px', 
                  padding: '0.6rem 1.25rem', 
                  fontWeight: 600, 
                  cursor: 'pointer' 
                }}
              >
                Wipe Database
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-App Clear Upload History Confirmation Modal */}
      {showClearModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                Clear Upload History
              </h3>
              <button className={styles.closeBtn} onClick={() => setShowClearModal(false)}>×</button>
            </div>
            <p className={styles.warningText} style={{ margin: '1rem 0 0.5rem', fontWeight: 600 }}>
              Reset the upload history log?
            </p>
            <p className={styles.warningTextSub} style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              This will clear the history list display without deleting active database tables or data.
            </p>
            <div className={styles.modalActions} style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className={styles.btnCancel} onClick={() => setShowClearModal(false)}>
                Cancel
              </button>
              <button 
                type="button" 
                onClick={confirmClearHistory}
                style={{ 
                  background: 'var(--action)', 
                  color: 'var(--action-text)', 
                  border: 'none', 
                  borderRadius: '10px', 
                  padding: '0.6rem 1.25rem', 
                  fontWeight: 600, 
                  cursor: 'pointer' 
                }}
              >
                Clear History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
