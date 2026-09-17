import { authenticatedFetch } from '../../api/auth';
import { useState, useContext, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './SettingsModal.module.css';
import { AppContext } from '@/pages/_app';

export default function SettingsModal({ isOpen, onClose }) {
  const { user, setUser, showHUD, font, setFont, fontOptions, themeMode, setThemeMode } = useContext(AppContext);
  const [mounted, setMounted] = useState(false);
  
  const [activeTab, setActiveTab] = useState('profile'); // 'profile', 'appearance', or 'security'

  // Profile Form State
  const [name, setName] = useState('');
  const [profileStatus, setProfileStatus] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);

  // Security Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sync state when modal opens or user changes
  useEffect(() => {
    if (user && isOpen) {
      setName(user.name || user.first_name || '');
      setProfileStatus('');
      setPasswordStatus('');
      setCurrentPassword('');
      setNewPassword('');
    }
  }, [user, isOpen]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const handleFontChange = (newFontId) => {
    if (setFont) {
      setFont(newFontId);
      const selected = fontOptions?.find(f => f.id === newFontId);
      if (showHUD) {
        showHUD({
          title: 'Typography Updated',
          subtitle: `Switched font to ${selected?.name || newFontId}`,
          type: 'success'
        });
      }
    }
  };

  // Handle Profile (Name) Update
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setProfileStatus('Name cannot be empty.');
      if (showHUD) {
        showHUD({
          title: 'Required Field',
          subtitle: 'Please enter a valid name',
          type: 'warning'
        });
      }
      return;
    }

    setProfileLoading(true);
    setProfileStatus('Saving changes...');
    try {
      let res = await authenticatedFetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim()
        })
      });
      if (!res.ok) {
        res = await authenticatedFetch('/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name.trim()
          })
        });
      }
      const data = await res.json();
      if (res.ok) {
        setProfileStatus('Profile updated successfully!');
        if (setUser) {
          setUser(prev => ({
            ...prev,
            name: data.name || name.trim(),
            first_name: data.name || name.trim(),
            username: data.username || prev.username
          }));
        }
        if (showHUD) {
          showHUD({
            title: 'Profile Updated',
            subtitle: 'Name and login handle updated successfully',
            type: 'success'
          });
        }
        setTimeout(() => {
          setProfileStatus('');
          onClose();
        }, 450);
      } else {
        const errMsg = data.detail || data.error || 'Failed to update profile';
        setProfileStatus('Error: ' + errMsg);
        if (showHUD) {
          showHUD({
            title: 'Update Failed',
            subtitle: errMsg,
            type: 'error'
          });
        }
      }
    } catch (err) {
      setProfileStatus('Network error during profile update');
      if (showHUD) {
        showHUD({
          title: 'Network Error',
          subtitle: 'Could not communicate with server',
          type: 'error'
        });
      }
    } finally {
      setProfileLoading(false);
    }
  };

  // Handle Password Update
  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      setPasswordStatus('Please fill in both current and new password.');
      if (showHUD) {
        showHUD({
          title: 'Missing Fields',
          subtitle: 'Please enter both current and new password',
          type: 'warning'
        });
      }
      return;
    }
    
    setPasswordLoading(true);
    setPasswordStatus('Updating password...');
    try {
      let res = await authenticatedFetch('/update-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });
      if (!res.ok) {
        res = await authenticatedFetch('/api/update-password', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword
          })
        });
      }
      const data = await res.json();
      if (data.status === 'success') {
        setPasswordStatus('Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        if (showHUD) {
          showHUD({
            title: 'Password Updated',
            subtitle: 'Security credentials changed successfully',
            type: 'success'
          });
        }
        setTimeout(() => {
          setPasswordStatus('');
          onClose();
        }, 450);
      } else {
        const errMsg = data.error || data.detail || 'Current password incorrect';
        setPasswordStatus('Error: ' + errMsg);
        if (showHUD) {
          showHUD({
            title: 'Update Failed',
            subtitle: errMsg,
            type: 'error'
          });
        }
      }
    } catch (err) {
      setPasswordStatus('Network error during update');
      if (showHUD) {
        showHUD({
          title: 'Network Error',
          subtitle: 'Could not communicate with authentication server',
          type: 'error'
        });
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  const getHeaderTitle = () => {
    if (activeTab === 'profile') return 'Profile Settings';
    if (activeTab === 'appearance') return 'Appearance & Typography';
    return 'Security Settings';
  };

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Modal Sidebar */}
        <div className={styles.sidebar}>
          <div className={styles.header}>Settings</div>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'profile' ? styles.active : ''}`}
            onClick={() => setActiveTab('profile')}
            type="button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '0.5rem'}}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            Profile
          </button>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'appearance' ? styles.active : ''}`}
            onClick={() => setActiveTab('appearance')}
            type="button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '0.5rem'}}><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>
            Appearance
          </button>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'security' ? styles.active : ''}`}
            onClick={() => setActiveTab('security')}
            type="button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '0.5rem'}}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            Security
          </button>
        </div>

        {/* Modal Main Content */}
        <div className={styles.content}>
          <div className={styles.contentHeader}>
            <h3>{getHeaderTitle()}</h3>
            <button className={styles.closeBtn} onClick={onClose} aria-label="Close settings">&times;</button>
          </div>

          <div className={styles.contentBody}>
            {activeTab === 'profile' && (
              <form className={styles.section} onSubmit={handleProfileUpdate}>
                <div className={styles.infoCard}>
                  <div className={styles.infoRow}>
                    <span className={styles.infoLabel}>Login ID / Username:</span>
                    <span className={styles.infoValue}>{user?.username || 'user'}</span>
                  </div>
                  {user?.role && (
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Account Role:</span>
                      <span className={styles.roleBadge}>{user.role}</span>
                    </div>
                  )}
                </div>

                <div className={styles.inputGroup}>
                  <label>Full Name</label>
                  <input 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                  />
                </div>

                {profileStatus && (
                  <div className={`${styles.statusMsg} ${profileStatus.includes('Error') ? styles.error : styles.success}`}>
                    {profileStatus}
                  </div>
                )}

                <button type="submit" className={styles.primaryBtn} disabled={profileLoading}>
                  {profileLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            )}

            {activeTab === 'appearance' && (
              <div className={styles.appearanceSection}>
                <div className={styles.appearanceGroup}>
                  <label className={styles.groupHeading}>Typography Style</label>
                  <p className={styles.groupSubtext}>Select your preferred reading and interface typeface. Roboto is the system default.</p>

                  <div className={styles.fontGrid}>
                    {(fontOptions || [
                      { id: 'roboto', name: 'Roboto', badge: 'Default', description: 'Clean, modern standard financial UI typeface.' },
                      { id: 'anthropic-sans', name: 'Anthropic Sans', badge: 'Plus Jakarta / Inter', description: 'Modern neo-grotesque sans-serif with crisp legibility.' },
                      { id: 'anthropic-serif', name: 'Anthropic Serif', badge: 'Lora / Charter', description: 'Refined editorial serif styling inspired by Claude & publications.' }
                    ]).map((fOpt) => {
                      const isSelected = (font || 'roboto') === fOpt.id;
                      return (
                        <div
                          key={fOpt.id}
                          className={`${styles.fontCard} ${isSelected ? styles.fontCardSelected : ''}`}
                          onClick={() => handleFontChange(fOpt.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleFontChange(fOpt.id); }}
                        >
                          <div className={styles.fontCardHeader}>
                            <div className={styles.fontRadio}>
                              <div className={`${styles.radioDot} ${isSelected ? styles.radioDotActive : ''}`} />
                            </div>
                            <div className={styles.fontTitleWrap}>
                              <span className={styles.fontName}>{fOpt.name}</span>
                              <span className={styles.fontBadge}>{fOpt.badge}</span>
                            </div>
                          </div>
                          <p className={styles.fontDesc}>{fOpt.description}</p>
                          <div
                            className={styles.fontSample}
                            style={{
                              fontFamily: fOpt.id === 'roboto'
                                ? 'var(--font-roboto, Roboto, sans-serif)'
                                : fOpt.id === 'anthropic-sans'
                                ? 'var(--font-anthropic-sans, Plus Jakarta Sans, sans-serif)'
                                : 'var(--font-anthropic-serif, Lora, serif)'
                            }}
                          >
                            Aa Bb Gg 123 · Financial Analysis
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className={styles.appearanceGroup}>
                  <label className={styles.groupHeading}>Live Typography Preview</label>
                  <div 
                    className={styles.livePreviewCard}
                    style={{
                      fontFamily: (font === 'roboto')
                        ? "'Roboto', sans-serif"
                        : (font === 'anthropic-sans')
                        ? "'Plus Jakarta Sans', 'Inter', sans-serif"
                        : "'Lora', 'Charter', serif"
                    }}
                  >
                    <div className={styles.livePreviewHeader}>
                      <h4 style={{ fontFamily: 'inherit' }}>FINANCIAL PERFORMANCE BRIEF</h4>
                      <span className={styles.previewTag}>ACTIVE PREVIEW</span>
                    </div>
                    <div className={styles.liveMetrics}>
                      <div className={styles.liveMetricItem}>
                        <span className={styles.metricLabel} style={{ fontFamily: 'inherit' }}>Q3 Revenue</span>
                        <span className={styles.metricValue} style={{ fontFamily: 'inherit' }}>PKR 42.8M</span>
                      </div>
                      <div className={styles.liveMetricItem}>
                        <span className={styles.metricLabel} style={{ fontFamily: 'inherit' }}>YoY Growth</span>
                        <span className={`${styles.metricValue} ${styles.metricPositive}`} style={{ fontFamily: 'inherit' }}>+18.4%</span>
                      </div>
                      <div className={styles.liveMetricItem}>
                        <span className={styles.metricLabel} style={{ fontFamily: 'inherit' }}>Operating Margin</span>
                        <span className={styles.metricValue} style={{ fontFamily: 'inherit' }}>24.6%</span>
                      </div>
                    </div>
                    <p className={styles.previewBody} style={{ fontFamily: 'inherit' }}>
                      Finstant automatically queries, cross-references, and analyzes your authorized enterprise financial models, payroll sheets, and KPI data with deterministic precision.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <form className={styles.section} onSubmit={handlePasswordUpdate}>
                <div className={styles.inputGroup}>
                  <label>Current Password</label>
                  <input 
                    type="password" 
                    value={currentPassword} 
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    required
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>New Password</label>
                  <input 
                    type="password" 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                  />
                </div>

                {passwordStatus && (
                  <div className={`${styles.statusMsg} ${passwordStatus.includes('Error') ? styles.error : styles.success}`}>
                    {passwordStatus}
                  </div>
                )}

                <button type="submit" className={styles.primaryBtn} disabled={passwordLoading}>
                  {passwordLoading ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

