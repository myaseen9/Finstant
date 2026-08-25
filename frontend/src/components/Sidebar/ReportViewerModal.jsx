import { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './ReportViewerModal.module.css';
import chatStyles from '../ChatWindow/ChatWindow.module.css';
import DataTable from '../ChatWindow/DataTable';

export default function ReportViewerModal({ isOpen, onClose, report }) {
  const [downloading, setDownloading] = useState(false);
  const reportRef = useRef(null);

  if (!isOpen || !report) return null;

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const element = reportRef.current;
      const titleSafe = (report.logicalTitle || report.chat_title).replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const opt = {
        margin: [15, 15, 15, 15],
        filename: `${titleSafe}_${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', 'h1', 'h2', 'h3', 'p', 'li'] }
      };
      await html2pdf().set(opt).from(element).save();
    } catch (e) {
      console.error("PDF generation failed:", e);
    } finally {
      setDownloading(false);
    }
  };

  // We reuse the exact markdown rendering logic as the ChatWindow
  let mainText = report.content.replace('<!-- SHOW_PDF_BUTTON -->', '').trim();

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <h2 className={styles.title}>{report.logicalTitle || report.chat_title}</h2>
            <span className={styles.date}>{new Date(report.created_at).toLocaleDateString()}</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose} title="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <div className={styles.content}>
          <div className={styles.reportBoxWrapper}>
            <div className={`${styles.reportBox} ${chatStyles.reportBox}`} ref={reportRef}>
              <div className={chatStyles.markdown}>
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm]}
                  components={{
                    table: ({node, ...props}) => {
                      const { children, ...rest } = props;
                      return <DataTable {...rest} messageText={mainText} isReportMode={true}>{children}</DataTable>;
                    }
                  }}
                >
                  {mainText}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.downloadBtn} onClick={handleDownload} disabled={downloading}>
            {downloading ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.spinner}><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                <span>Download PDF</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
