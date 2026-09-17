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
  const [showForgotOption, setShowForgotOption] = useState(false);
  const [codeStatus, setCodeStatus] = useState('idle'); // 'idle' | 'verifying' | 'verified'
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

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
          setSuccessMsg('Password updated successfully! Logging you in...');
          setTimeout(() => {
            window.location.reload();
          }, 1200);
          return;
        } catch (updateErr) {
          if (updateErr.message.includes('session can only be used once') || updateErr.message.includes('Invalid session')) {
             setError('The security session expired. Refreshing page...');
             setTimeout(() => {
               window.location.reload();
             }, 1500);
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
        setShowForgotOption(true);
      }
      setLoading(false);
    }
  };

  // Step 1: Send AWS Cognito Verification Code
  const handleSendResetCode = async (e) => {
    if (e) e.preventDefault();
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
      setCodeStatus('idle');
      setResetCode('');
      setSuccessMsg(`A 6-digit verification code has been sent to ${username}.`);
    } catch (err) {
      setError(err.message || 'Failed to send reset code. Verify email is correct.');
    } finally {
      setLoading(false);
    }
  };

  // Handle 6-Digit Code Input & Simulated Instant Verification
  const handleCodeChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setResetCode(val);
    setError('');

    if (val.length === 6) {
      setCodeStatus('verifying');
      setTimeout(() => {
        setCodeStatus('verified');
        setTimeout(() => {
          document.getElementById('reset-new-password-input')?.focus();
        }, 80);
      }, 750);
    } else {
      if (codeStatus !== 'idle') {
        setCodeStatus('idle');
      }
    }
  };

  // Step 2: Confirm Code + Set New Permanent Password
  const handleConfirmReset = async (e) => {
    e.preventDefault();
    if (codeStatus !== 'verified') {
      setError('Please enter and verify the 6-digit code first.');
      return;
    }
    if (!resetNewPassword) {
      setError('Please set your new password.');
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
      setCodeStatus('idle');
      setIsPasswordFocused(false);
      setShowForgotOption(false);
    } catch (err) {
      setError(err.message || 'Failed to reset password. Please check the code and requirements.');
      if (err.message && (err.message.toLowerCase().includes('code') || err.message.toLowerCase().includes('mismatch'))) {
        setCodeStatus('idle');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.brandBanner}>
          <div className={styles.bannerLogoWrapper}>
            <img src="/logo.svg" alt="FINSTΛNT Owl Logo" className={styles.bannerLogo} />
          </div>
          <span className={styles.bannerText}>FINST<span className={styles.lambda}>Λ</span>NT</span>
        </div>
        <p className={styles.subtitle}>
          {isResetMode 
            ? (resetStep === 1 ? 'Reset your password' : 'Enter verification code') 
            : 'Sign in to your account'}
        </p>

        {isResetMode && (
          <div className={styles.stepIndicator}>
            <div className={`${styles.stepPill} ${resetStep >= 1 ? styles.stepActive : ''}`}>
              <span className={styles.stepNumber}>1</span>
              <span>Email</span>
            </div>
            <div className={`${styles.stepDivider} ${resetStep >= 2 ? styles.stepDividerActive : ''}`} />
            <div className={`${styles.stepPill} ${resetStep >= 2 ? styles.stepActive : ''}`}>
              <span className={styles.stepNumber}>2</span>
              <span>Set Password</span>
            </div>
          </div>
        )}

        {successMsg && (
          <div className={isResetMode && resetStep === 2 ? styles.successBannerCompact : styles.successBanner}>
            {successMsg}
          </div>
        )}
        
        {!isResetMode ? (
          /* STANDARD USER LOGIN FORM */
          <form onSubmit={handleLogin} className={styles.form}>
            <div className={styles.inputGroup}>
              <label>Email Address or Username</label>
              <input 
                type="text" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                placeholder="user@example.com or username"
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                placeholder="••••••••"
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
                <div className={styles.passwordChecklist}>
                  <span className={styles.checklistItem} style={{ color: newPassword.length >= 8 ? 'var(--accent, #22B8CF)' : '#9ca3af' }}>
                    {newPassword.length >= 8 ? '✓' : '○'} At least 8 characters
                  </span>
                  <span className={styles.checklistItem} style={{ color: (/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)) ? 'var(--accent, #22B8CF)' : '#9ca3af' }}>
                    {(/[A-Z]/.test(newPassword) && /[a-z]/.test(newPassword)) ? '✓' : '○'} Uppercase & lowercase letters
                  </span>
                  <span className={styles.checklistItem} style={{ color: /[0-9]/.test(newPassword) ? 'var(--accent, #22B8CF)' : '#9ca3af' }}>
                    {/[0-9]/.test(newPassword) ? '✓' : '○'} At least one number
                  </span>
                  <span className={styles.checklistItem} style={{ color: /[^A-Za-z0-9]/.test(newPassword) ? 'var(--accent, #22B8CF)' : '#9ca3af' }}>
                    {/[^A-Za-z0-9]/.test(newPassword) ? '✓' : '○'} At least one special character
                  </span>
                </div>
              </div>
            )}

            {error && <div className={styles.errorMsg}>{error}</div>}

            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? 'Authenticating...' : (newPasswordRequired ? 'Update Password' : 'Log In')}
            </button>
            
            {/* Conditional Forgot Password Prompt (Only shows after failed attempt) */}
            {showForgotOption && !newPasswordRequired && (
              <div className={styles.forgotPrompt}>
                <p className={styles.forgotText}>Forgot password?</p>
                <button 
                  type="button" 
                  onClick={() => { 
                    setIsResetMode(true); 
                    setError(''); 
                    setSuccessMsg(''); 
                    setResetStep(1); 
                  }}
                  className={styles.resetLinkBtn}
                >
                  Click here to reset.
                </button>
              </div>
            )}
          </form>
        ) : (
          /* FORGOT PASSWORD RESET FLOW */
          <div className={styles.form}>
            {resetStep === 1 ? (
              <form onSubmit={handleSendResetCode}>
                <div className={styles.inputGroup}>
                  <label>Email Address or Username</label>
                  <input 
                    type="text" 
                    value={username} 
                    onChange={(e) => setUsername(e.target.value)} 
                    placeholder="Enter your registered email or username"
                    required
                    autoFocus
                  />
                  <span className={styles.helperText}>
                    A 6-digit verification code will be sent to your registered email.
                  </span>
                </div>

                {error && <div className={styles.errorMsg}>{error}</div>}

                <div className={styles.resetActionsRow}>
                  <button 
                    type="button" 
                    onClick={() => { setIsResetMode(false); setError(''); setSuccessMsg(''); }}
                    className={styles.rowBtn}
                  >
                    Back to Sign In
                  </button>

                  <button 
                    type="submit" 
                    className={styles.rowBtn} 
                    disabled={loading}
                  >
                    {loading ? 'Sending Code...' : 'Send Verification Code'}
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
                    onChange={handleCodeChange} 
                    placeholder="123456"
                    maxLength={6}
                    className={`${styles.codeInput} ${codeStatus === 'verified' ? styles.codeVerifiedLocked : ''}`}
                    readOnly={codeStatus === 'verified'}
                    tabIndex={codeStatus === 'verified' ? -1 : 0}
                    required
                    autoFocus
                  />
                  <div className={styles.inputEndAction}>
                    {codeStatus === 'verifying' && (
                      <div className={styles.verifyingBadge}>
                        <span className={styles.windowsSpinner} />
                        <span>Verifying...</span>
                      </div>
                    )}
                    {codeStatus === 'verified' && (
                      <div className={styles.codeStatusRow}>
                        <div className={styles.verifiedBadge}>
                          <span className={styles.minimalTick}>✓</span>
                          <span>Verified</span>
                        </div>
                        <button 
                          type="button" 
                          onClick={(e) => { setCodeStatus('idle'); setResetCode(''); handleSendResetCode(e); }}
                          className={styles.resendTextBtn}
                          disabled={loading}
                        >
                          ↻ Resend
                        </button>
                      </div>
                    )}
                    {codeStatus === 'idle' && (
                      <button 
                        type="button" 
                        onClick={(e) => { setCodeStatus('idle'); setResetCode(''); handleSendResetCode(e); }}
                        className={styles.resendTextBtn}
                        disabled={loading}
                      >
                        ↻ Resend Code
                      </button>
                    )}
                  </div>
                </div>

                <div className={styles.inputGroup}>
                  <label>Set New Password</label>
                  <div className={styles.passwordFieldWrapper}>
                    {/* Upside dropdown: floats above the text box, only visible when user focuses on the password field */}
                    {isPasswordFocused && codeStatus === 'verified' && (
                      <div className={styles.passwordConditionsDropdown}>
                        <div className={styles.dropdownTitle}>Password Requirements</div>
                        <div className={styles.passwordChecklist} style={{ margin: 0, padding: 0, background: 'transparent', border: 'none' }}>
                          <span className={styles.checklistItem} style={{ color: resetNewPassword.length >= 8 ? 'var(--accent, #22B8CF)' : '#9ca3af' }}>
                            {resetNewPassword.length >= 8 ? '✓' : '○'} At least 8 characters
                          </span>
                          <span className={styles.checklistItem} style={{ color: (/[A-Z]/.test(resetNewPassword) && /[a-z]/.test(resetNewPassword)) ? 'var(--accent, #22B8CF)' : '#9ca3af' }}>
                            {(/[A-Z]/.test(resetNewPassword) && /[a-z]/.test(resetNewPassword)) ? '✓' : '○'} Uppercase & lowercase letters
                          </span>
                          <span className={styles.checklistItem} style={{ color: /[0-9]/.test(resetNewPassword) ? 'var(--accent, #22B8CF)' : '#9ca3af' }}>
                            {/[0-9]/.test(resetNewPassword) ? '✓' : '○'} At least one number
                          </span>
                          <span className={styles.checklistItem} style={{ color: /[^A-Za-z0-9]/.test(resetNewPassword) ? 'var(--accent, #22B8CF)' : '#9ca3af' }}>
                            {/[^A-Za-z0-9]/.test(resetNewPassword) ? '✓' : '○'} At least one special character
                          </span>
                        </div>
                        <div className={styles.dropdownArrow} />
                      </div>
                    )}

                    <input 
                      id="reset-new-password-input"
                      type="password" 
                      value={resetNewPassword} 
                      onChange={(e) => setResetNewPassword(e.target.value)} 
                      onFocus={() => setIsPasswordFocused(true)}
                      onBlur={() => setIsPasswordFocused(false)}
                      placeholder={codeStatus === 'verified' ? "••••••••" : "Verify code first"}
                      disabled={codeStatus !== 'verified'}
                      className={`${styles.passwordInput} ${codeStatus !== 'verified' ? styles.inputDisabled : ''}`}
                      title={codeStatus !== 'verified' ? "Please enter the 6-digit verification code above first" : ""}
                      required
                    />
                  </div>
                </div>

                {error && <div className={styles.errorMsg}>{error}</div>}

                <div className={styles.resetActionsRow}>
                  <button 
                    type="button" 
                    onClick={() => { 
                      setIsResetMode(false); 
                      setError(''); 
                      setSuccessMsg(''); 
                      setCodeStatus('idle');
                      setIsPasswordFocused(false);
                    }}
                    className={styles.rowBtn}
                  >
                    Cancel
                  </button>

                  <button 
                    type="submit" 
                    className={styles.rowBtn} 
                    disabled={loading || codeStatus !== 'verified'}
                  >
                    {loading ? 'Updating...' : 'Save & Confirm'}
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
