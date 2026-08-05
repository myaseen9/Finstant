import { useState, useRef, useContext } from 'react';
import styles from './SettingsModal.module.css';
import { AppContext } from '@/pages/_app';

export default function SettingsModal({ isOpen, onClose }) {
  const { user, setUser } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState('profile');
  const fileInputRef = useRef(null);
  
  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState('');
  
  // Upload state
  const [uploadStatus, setUploadStatus] = useState('');

  if (!isOpen) return null;

  const handleProfileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadStatus('Uploading...');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('http://localhost:8000/upload-profile', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      const data = await res.json();
      if (data.status === 'success') {
        setUser({ ...user, profile_picture: data.profile_url });
        setUploadStatus('Profile updated successfully!');
        setTimeout(() => setUploadStatus(''), 3000);
      } else {
        setUploadStatus('Upload failed: ' + data.error);
      }
    } catch (err) {
      setUploadStatus('Network error during upload');
    }
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      setPasswordStatus('Please fill in all fields.');
      return;
    }
    
    setPasswordStatus('Updating...');
    try {
      const res = await fetch('http://localhost:8000/update-password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setPasswordStatus('Password updated successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setTimeout(() => setPasswordStatus(''), 3000);
      } else {
        setPasswordStatus('Error: ' + data.error);
      }
    } catch (err) {
      setPasswordStatus('Network error during update');
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.sidebar}>
          <div className={styles.header}>Settings</div>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'profile' ? styles.active : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            Profile
          </button>
          <button 
            className={`${styles.tabBtn} ${activeTab === 'security' ? styles.active : ''}`}
            onClick={() => setActiveTab('security')}
          >
            Security
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.contentHeader}>
            <h3>{activeTab === 'profile' ? 'Profile Settings' : 'Security Settings'}</h3>
            <button className={styles.closeBtn} onClick={onClose}>&times;</button>
          </div>

          <div className={styles.contentBody}>
            {activeTab === 'profile' && (
              <div className={styles.section}>
                <div className={styles.profileRow}>
                  <div className={styles.avatarLarge}>
                    {user?.profile_picture ? (
                      <img src={user.profile_picture} alt="Profile" />
                    ) : (
                      <span>{user?.first_name?.charAt(0).toUpperCase() || user?.username?.charAt(0).toUpperCase() || 'U'}</span>
                    )}
                  </div>
                  <div className={styles.uploadDetails}>
                    <input 
                      type="file" 
                      accept="image/*" 
                      ref={fileInputRef} 
                      style={{ display: 'none' }}
                      onChange={handleProfileUpload}
                    />
                    <button className={styles.primaryBtn} onClick={() => fileInputRef.current.click()}>
                      Upload new picture
                    </button>
                    {uploadStatus && <div className={styles.statusMsg}>{uploadStatus}</div>}
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
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>New Password</label>
                  <input 
                    type="password" 
                    value={newPassword} 
                    onChange={e => setNewPassword(e.target.value)}
                  />
                </div>
                {passwordStatus && (
                  <div className={`${styles.statusMsg} ${passwordStatus.includes('Error') ? styles.error : styles.success}`}>
                    {passwordStatus}
                  </div>
                )}
                <button type="submit" className={styles.primaryBtn}>Update Password</button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
