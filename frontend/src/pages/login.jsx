import { useState, useContext } from 'react';
import { useRouter } from 'next/router';
import { AppContext } from '@/pages/_app';
import { login } from '@/api/auth';
import { motion } from 'framer-motion';
import styles from './login.module.css';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setUser } = useContext(AppContext);
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    
    setLoading(true);
    setError('');

    try {
      const data = await login(username, password);
      setUser(data);
      router.push('/');
    } catch (err) {
      setError(err.message || 'Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.backgroundBlob}></div>
      <div className={styles.backgroundBlob2}></div>
      
      <motion.div 
        className={styles.card}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className={styles.brandBanner}>
          <motion.div 
            className={styles.bannerLogoWrapper}
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Finstant Logo" className={styles.bannerLogo} />
          </motion.div>
          <span className={styles.bannerText}>FINSTΛNT</span>
        </div>
        <p className={styles.subtitle}>Sign in to your account</p>
        
        <form onSubmit={handleLogin} className={styles.form}>
          <div className={styles.inputGroup}>
            <label>Username</label>
            <input 
              type="text" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
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

          {error && (
            <motion.div 
              className={styles.errorMsg}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
            >
              {error}
            </motion.div>
          )}

          <motion.button 
            type="submit" 
            className={styles.submitBtn} 
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
