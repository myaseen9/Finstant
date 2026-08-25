import { authenticatedFetch } from '../../api/auth';
import { useState, useContext } from 'react';
import styles from './SettingsModal.module.css';
import { AppContext } from '@/pages/_app';

export default function SettingsModal({ isOpen, onClose }) {
  const { user } = useContext(AppContext);
  
  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState('');

  if (!isOpen) return null;

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      setPasswordStatus('Please fill in all fields.');
      return;
    }
    
    setPasswordStatus('Updating...');
    try {
      let res = await authenticatedFetch('http://127.0.0.1:8000/update-password', {
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
          <button className={`${styles.tabBtn} ${styles.active}`}>
            Security
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.contentHeader}>
            <h3>Security Settings</h3>
            <button className={styles.closeBtn} onClick={onClose}>&times;</button>
          </div>

          <div className={styles.contentBody}>
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
          </div>
        </div>
      </div>
    </div>
  );
}
