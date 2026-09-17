import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import styles from './ReportViewerModal.module.css';
import chatStyles from '../ChatWindow/ChatWindow.module.css';
import DataTable from '../ChatWindow/DataTable';

export default function ReportViewerModal({ isOpen, onClose, report }) {
  const [downloadStatus, setDownloadStatus] = useState('idle'); // 'idle' | 'generating' | 'downloaded'
  const [mounted, setMounted] = useState(false);
  const reportRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  if (!isOpen || !report || !mounted) return null;

  const handleDownload = async () => {
    if (downloadStatus !== 'idle') return;
    setDownloadStatus('generating');
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      const element = reportRef.current;
      if (!element) {
        setDownloadStatus('idle');
        return;
      }

      const titleSafe = (report.logicalTitle || report.chat_title).replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const targetFileName = `${titleSafe}_${new Date().toISOString().split('T')[0]}.pdf`;

      // --- DEDICATED OFF-SCREEN PRINT TEMPLATE ENGINE ---
      const clone = element.cloneNode(true);

      // 1. Remove interactive UI
      clone.querySelectorAll('button, svg.spinner, [class*="tableFooter"]').forEach(b => b.remove());

      // 2. Count table columns for auto-landscape
      const tables = clone.querySelectorAll('table');
      let maxCols = 0;
      tables.forEach(table => {
        const rows = table.querySelectorAll('tr');
        rows.forEach(r => {
          const cells = r.querySelectorAll('th, td');
          if (cells.length > maxCols) maxCols = cells.length;
        });
      });

      const isLandscape = maxCols >= 5;
      const containerWidth = isLandscape ? 1040 : 760;

      // 3. Format clone
      clone.style.width = `${containerWidth}px`;
      clone.style.maxWidth = `${containerWidth}px`;
      clone.style.padding = '24px 28px';
      clone.style.background = '#FFFFFF';
      clone.style.color = '#111827';
      clone.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      clone.style.boxShadow = 'none';
      clone.style.border = 'none';
      clone.style.borderRadius = '0px';

      // 4. Expand tables to eliminate scroll cut-offs
      clone.querySelectorAll('[class*="tableContainer"]').forEach(tc => {
        tc.style.overflow = 'visible';
        tc.style.width = '100%';
        tc.style.maxWidth = '100%';
        tc.style.border = '1px solid #E5E7EB';
        tc.style.borderRadius = '8px';
        tc.style.boxShadow = 'none';
        tc.style.margin = '16px 0';
      });

      clone.querySelectorAll('table').forEach(tbl => {
        tbl.style.width = '100%';
        tbl.style.tableLayout = isLandscape ? 'auto' : (maxCols >= 4 ? 'fixed' : 'auto');
        tbl.style.borderCollapse = 'collapse';
        tbl.style.fontSize = isLandscape ? '11px' : (maxCols >= 4 ? '10px' : '12px');
        tbl.style.wordBreak = 'break-word';
      });

      clone.querySelectorAll('th').forEach(th => {
        th.style.background = '#F3F4F6';
        th.style.color = '#111827';
        th.style.padding = '8px 10px';
        th.style.fontWeight = '700';
        th.style.textAlign = 'left';
        th.style.borderBottom = '2px solid #D1D5DB';
        th.style.borderRight = '1px solid #E5E7EB';
      });

      clone.querySelectorAll('td').forEach(td => {
        td.style.padding = '7px 10px';
        td.style.color = '#374151';
        td.style.borderBottom = '1px solid #E5E7EB';
        td.style.borderRight = '1px solid #F3F4F6';
      });

      clone.querySelectorAll('h1, h2, h3, h4').forEach(h => {
        h.style.color = '#111827';
        h.style.fontWeight = '700';
        h.style.marginTop = '16px';
        h.style.marginBottom = '8px';
      });

      clone.querySelectorAll('p').forEach(p => {
        p.style.color = '#374151';
        p.style.lineHeight = '1.6';
        p.style.marginBottom = '10px';
      });

      // 5. Corporate Header
      const header = document.createElement('div');
      header.style.display = 'flex';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'center';
      header.style.borderBottom = '2px solid #22B8CF';
      header.style.paddingBottom = '12px';
      header.style.marginBottom = '20px';
      header.innerHTML = `
        <div>
          <div style="font-size: 20px; font-weight: 800; color: #111827; letter-spacing: -0.5px;">FINST<span style="color: #22B8CF;">Λ</span>NT</div>
          <div style="font-size: 11px; color: #6B7280; font-weight: 500; margin-top: 2px;">Executive Financial Intelligence & Analytics</div>
        </div>
        <div style="text-align: right; font-size: 10px; color: #6B7280; line-height: 1.4;">
          <div>Generated: ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
          <div style="color: #10B981; font-weight: 600;">Archived Corporate Report</div>
        </div>
      `;
      clone.insertBefore(header, clone.firstChild);

      // 6. Corporate Footer
      const footer = document.createElement('div');
      footer.style.marginTop = '24px';
      footer.style.paddingTop = '10px';
      footer.style.borderTop = '1px solid #E5E7EB';
      footer.style.display = 'flex';
      footer.style.justifyContent = 'space-between';
      footer.style.fontSize = '9px';
      footer.style.color = '#9CA3AF';
      footer.innerHTML = `
        <span>CONFIDENTIAL &bull; FOR INTERNAL CORPORATE USE ONLY</span>
        <span>FINSTΛNT Engine &bull; Automated Analysis</span>
      `;
      clone.appendChild(footer);

      // 7. Mount off-screen
      const offscreen = document.createElement('div');
      offscreen.style.position = 'fixed';
      offscreen.style.top = '-9999px';
      offscreen.style.left = '0';
      offscreen.style.width = `${containerWidth}px`;
      offscreen.style.zIndex = '-9999';
      offscreen.appendChild(clone);
      document.body.appendChild(offscreen);

      const opt = {
        margin: [10, 10, 10, 10],
        filename: targetFileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, windowWidth: containerWidth + 80 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: isLandscape ? 'landscape' : 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', 'h1', 'h2', 'h3', 'p', 'li'] }
      };

      const pdfBlob = await html2pdf().set(opt).from(clone).outputPdf('blob');
      document.body.removeChild(offscreen);

      const blobUrl = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = targetFileName;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        window.URL.revokeObjectURL(blobUrl);
        if (link.parentNode) link.parentNode.removeChild(link);
      }, 3000);

      setDownloadStatus('downloaded');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        setDownloadStatus('idle');
      }, 2600);
    } catch (e) {
      console.error("PDF generation failed:", e);
      setDownloadStatus('idle');
    }
  };

  // We reuse the exact markdown rendering logic as the ChatWindow
  let mainText = report.content.replace('<!-- SHOW_PDF_BUTTON -->', '').trim();

  return createPortal(
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
          <button 
            className={`${styles.downloadBtn} ${downloadStatus === 'downloaded' ? styles.downloadedSuccess : ''}`} 
            onClick={handleDownload} 
            disabled={downloadStatus === 'generating'}
            title={downloadStatus === 'downloaded' ? "Report Downloaded!" : "Download Report as PDF"}
          >
            {downloadStatus === 'generating' ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.spinner}><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
                <span>Generating...</span>
              </>
            ) : downloadStatus === 'downloaded' ? (
              <>
                <span className={styles.appleTickIcon}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </span>
                <span>Downloaded</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                <span>Download PDF</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
