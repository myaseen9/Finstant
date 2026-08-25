import { useState, useContext, useEffect } from 'react';
import { useRouter } from 'next/router';
import { AppContext } from '@/pages/_app';
import { login, needsSetup } from '@/api/auth';
import styles from './login.module.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [newPasswordRequired, setNewPasswordRequired] = useState(false);
  const [cognitoUserRef, setCognitoUserRef] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  
  // Forgot Password & Reset State
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetStep, setResetStep] = useState(1); // 1: Enter email, 2: Enter code + new password
  const [resetCode, setResetCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');

  const { setUser } = useContext(AppContext);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      let data;
      if (newPasswordRequired) {
        const { completeNewPassword } = await import('@/api/auth');
        try {
          await completeNewPassword(cognitoUserRef, newPassword);
          window.alert('Password updated successfully! The page will now refresh so you can log in.');
          window.location.reload();
          return;
        } catch (updateErr) {
          if (updateErr.message.includes('session can only be used once') || updateErr.message.includes('Invalid session')) {
             window.alert('The AWS security timer expired. The page will refresh automatically so you can try again.');
             window.location.reload();
             return;
          }
          throw updateErr;
        }
      } else {
        data = await login(username, password);
      }

      setUser(data);
      router.push('/');
    } catch (err) {
      if (err.code === 'NEW_PASSWORD_REQUIRED') {
        setNewPasswordRequired(true);
        setCognitoUserRef(err.cognitoUser);
        setError('AWS requires you to set a permanent password.');
      } else {
        setError(err.message || 'Network error. Please try again.');
      }
      setLoading(false);
    }
  };

  // Step 1: Send AWS Cognito Verification Code
  const handleSendResetCode = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please enter your email address.');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const { requestReset } = await import('@/api/auth');
      await requestReset(username.trim());
      setResetStep(2);
      setSuccessMsg(`A 6-digit verification code has been sent to ${username}.`);
    } catch (err) {
      setError(err.message || 'Failed to send reset code. Verify email is correct.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Confirm Code + Set New Permanent Password
  const handleConfirmReset = async (e) => {
    e.preventDefault();
    if (!resetCode.trim() || !resetNewPassword) {
      setError('Please fill in both the verification code and new password.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const { confirmPasswordReset } = await import('@/api/auth');
      await confirmPasswordReset(username.trim(), resetCode.trim(), resetNewPassword);
      setSuccessMsg('Password reset successfully! You can now log in with your new password.');
      setIsResetMode(false);
      setResetStep(1);
      setResetCode('');
      setResetNewPassword('');
      setPassword('');
    } catch (err) {
      setError(err.message || 'Failed to reset password. Please check the code and requirements.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.brandBanner}>
          <div className={styles.bannerLogoWrapper}>
            <img src="/logo.svg" alt="Finstant Logo" className={styles.bannerLogo} />
          </div>
          <span className={styles.bannerText}>FINSTΛNT</span>
        </div>
        <p className={styles.subtitle}>
          {isResetMode ? 'Secure Password Reset via AWS' : 'Sign in to your account'}
        </p>

        {successMsg && (
          <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', color: '#10b981', padding: '0.75rem', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'center' }}>
            {successMsg}
          </div>
        )}
        
        {!isResetMode ? (
          /* STANDARD USER LOGIN FORM */
          <form onSubmit={handleLogin} className={styles.form}>
            <div className={styles.inputGroup}>
              <label>Email Address</label>
              <input 
                type="email" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                placeholder="user@example.com"
                required
              />
            </div>
            <div className={styles.inputGroup}>
              <label>Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            
            {newPasswordRequired && (
              <div className={styles.inputGroup}>
                <label style={{color: '#ff4444'}}>Set New Permanent Password</label>
                <input 
                  type="password" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  required
                />
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <span style={{ color: newPassword.length >= 8 ? '#10b981' : '#9ca3af' }}>
                    {newPassword.length >= 8 ? '✓' : '○'} At least 8 characters
                  </span>
                  <span style={{ color: (/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)) ? '#10b981' : '#9ca3af' }}>
                    {(/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)) ? '✓' : '○'} Uppercase & lowercase letters
                  </span>
                  <span style={{ color: /[0-9]/.test(newPassword) ? '#10b981' : '#9ca3af' }}>
                    {/[0-9]/.test(newPassword) ? '✓' : '○'} At least one number
                  </span>
                  <span style={{ color: /[^A-Za-z0-9]/.test(newPassword) ? '#10b981' : '#9ca3af' }}>
                    {/[^A-Za-z0-9]/.test(newPassword) ? '✓' : '○'} At least one special character
                  </span>
                </div>
              </div>
            )}

            {error && <div className={styles.errorMsg}>{error}</div>}

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'Authenticating...' : (newPasswordRequired ? 'Update Password' : 'Log In')}
            </button>
            
            <div style={{ marginTop: '1.25rem', textAlign: 'center' }}>
              <button 
                type="button" 
                onClick={() => { setIsResetMode(true); setError(''); setSuccessMsg(''); setResetStep(1); }}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: 'var(--color-primary)', 
                  cursor: 'pointer', 
                  fontSize: '0.85rem',
                  textDecoration: 'underline' 
                }}
              >
                Forgot Password? Reset with AWS Security
              </button>
            </div>
          </form>
        ) : (
          /* FORGOT PASSWORD RESET FLOW */
          <div className={styles.form}>
            {resetStep === 1 ? (
              <form onSubmit={handleSendResetCode}>
                <div className={styles.inputGroup}>
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)} 
                    placeholder="Enter your registered email"
                    required
                    autoFocus
                  />
                  <small style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                    AWS will send a 6-digit confirmation code to your email.
                  </small>
                </div>

                {error && <div className={styles.errorMsg}>{error}</div>}

                <button type="submit" className={styles.submitBtn} disabled={loading}>
                  {loading ? 'Sending Code...' : 'Send Verification Code'}
                </button>

                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                  <button 
                    type="button" 
                    onClick={() => { setIsResetMode(false); setError(''); setSuccessMsg(''); }}
                    style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '0.85rem' }}
                  >
                    ← Back to Sign In
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleConfirmReset}>
                <div className={styles.inputGroup}>
                  <label>6-Digit Verification Code</label>
                  <input 
                    type="text" 
                    value={resetCode} 
                    onChange={(e) => setResetCode(e.target.value)} 
                    placeholder="123456"
                    required
                    autoFocus
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label>Set New Password</label>
                  <input 
                    type="password" 
                    value={resetNewPassword} 
                    onChange={(e) => setResetNewPassword(e.target.value)} 
                    required
                  />
                  <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    <span style={{ color: resetNewPassword.length >= 8 ? '#10b981' : '#9ca3af' }}>
                      {resetNewPassword.length >= 8 ? '✓' : '○'} At least 8 characters
                    </span>
                    <span style={{ color: (/[A-Z]/.test(resetNewPassword) && /[a-z]/.test(resetNewPassword)) ? '#10b981' : '#9ca3af' }}>
                      {(/[A-Z]/.test(resetNewPassword) && /[a-z]/.test(resetNewPassword)) ? '✓' : '○'} Uppercase & lowercase letters
                    </span>
                    <span style={{ color: /[0-9]/.test(resetNewPassword) ? '#10b981' : '#9ca3af' }}>
                      {/[0-9]/.test(resetNewPassword) ? '✓' : '○'} At least one number
                    </span>
                    <span style={{ color: /[^A-Za-z0-9]/.test(resetNewPassword) ? '#10b981' : '#9ca3af' }}>
                      {/[^A-Za-z0-9]/.test(resetNewPassword) ? '✓' : '○'} At least one special character
                    </span>
                  </div>
                </div>

                {error && <div className={styles.errorMsg}>{error}</div>}

                <button type="submit" className={styles.submitBtn} disabled={loading} style={{ backgroundColor: 'var(--action)' }}>
                  {loading ? 'Resetting Password...' : 'Save & Confirm New Password'}
                </button>

                <div style={{ marginTop: '1rem', textAlign: 'center', display: 'flex', justifyContent: 'space-between' }}>
                  <button 
                    type="button" 
                    onClick={handleSendResetCode}
                    style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    Resend Code
                  </button>
                  <button 
                    type="button" 
                    onClick={() => { setIsResetMode(false); setError(''); setSuccessMsg(''); }}
                    style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '0.8rem' }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
