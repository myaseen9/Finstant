import React, { useEffect, useState } from 'react';
import styles from './ActionHUD.module.css';

export default function ActionHUD({ title, subtitle, type = 'success', duration = 2000, onClose }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Start exit animation slightly before total duration
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, Math.max(800, duration - 250));

    const closeTimer = setTimeout(() => {
      if (onClose) onClose();
    }, duration);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(closeTimer);
    };
  }, [duration, onClose]);

  return (
    <div className={styles.hudOverlay}>
      <div className={`${styles.hudCard} ${styles[type] || ''} ${isExiting ? styles.exiting : ''}`}>
        <div className={styles.iconWrapper}>
          {type === 'error' ? (
            <svg width="56" height="56" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="30" cy="30" r="27" className={styles.errorCircleRing} />
              <path d="M21 21L39 39M39 21L21 39" className={styles.errorCross} />
            </svg>
          ) : type === 'warning' || type === 'info' ? (
            <svg width="56" height="56" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="30" cy="30" r="27" className={styles.infoCircleRing} />
              <path d="M30 19V33M30 41H30.02" className={styles.infoExclamation} />
            </svg>
          ) : (
            <svg width="56" height="56" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="30" cy="30" r="27" className={styles.circleRing} />
              <path d="M18 31L26 39L42 22" className={styles.checkMark} />
            </svg>
          )}
        </div>

        {title && <h4 className={styles.title}>{title}</h4>}
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
    </div>
  );
}
