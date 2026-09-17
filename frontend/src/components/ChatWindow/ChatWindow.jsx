import { authenticatedFetch } from '../../api/auth';
import { useState, useRef, useEffect, useContext } from 'react';
import styles from './ChatWindow.module.css';
import { AppContext } from '@/pages/_app';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DataTable from './DataTable';
import ChartRenderer from './ChartRenderer';

const DATASET_PROMPTS = {
  'kpi': [
    "What are our key KPI metrics for this year?",
    "Show gross profit margins and revenue KPI trends",
    "What is the net profit margin according to KPI records?"
  ],
  'p&l': [
    "Total revenue and expenses in 2025",
    "What is our operating profit margin for 2025?",
    "Breakdown of total operational expenses (OpEx)"
  ],
  'monthly_payroll': [
    "What was the net salary in March 2025?",
    "Total company payroll expenditure in 2025",
    "Monthly salary trend across Q1 and Q2"
  ],
  'salary_teamwise': [
    "Show salary breakdown by department",
    "Which team has the highest payroll expense?",
    "Compare department salary costs"
  ],
  'headcount_teamwise': [
    "What is our total headcount by team?",
    "Which department has the largest headcount?",
    "Show headcount distribution across departments"
  ],
  'gp_margins_salary_wise': [
    "Summarize GP margins by department",
    "Compare GP margin vs salary costs",
    "Which teams maintain the highest gross profit margin?"
  ],
  'project_health': [
    "Summary of active project health and status",
    "Show projects at risk or over budget",
    "List completed and on-track project deliverables"
  ]
};

const getPromptsForGrantedDatasets = (grantedList) => {
  if (!grantedList || grantedList.length === 0) {
    return [];
  }

  // Normalize user's granted dataset keys
  const userKeys = grantedList.map(g => {
    const raw = typeof g === 'object' ? (g.id || g.name || '') : String(g);
    return raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  }).filter(Boolean);

  // Filter prompt buckets strictly to granted datasets
  const matchingBuckets = [];
  for (const [key, prompts] of Object.entries(DATASET_PROMPTS)) {
    const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isGranted = userKeys.some(uk => uk.includes(cleanKey) || cleanKey.includes(uk));
    if (isGranted) {
      matchingBuckets.push({ key, prompts });
    }
  }

  if (matchingBuckets.length === 0) {
    return grantedList.slice(0, 3).map(g => {
      const name = typeof g === 'object' ? (g.name || g.id) : g;
      return `Summary of data and key metrics from ${name}`;
    });
  }

  // If ONLY 1 dataset is granted (e.g. only KPI), return all 3 prompts strictly for that dataset!
  if (matchingBuckets.length === 1) {
    return matchingBuckets[0].prompts.slice(0, 3);
  }

  // If 2 datasets are granted, pick prompts from both
  if (matchingBuckets.length === 2) {
    return [
      matchingBuckets[0].prompts[0],
      matchingBuckets[1].prompts[0],
      matchingBuckets[0].prompts[1] || matchingBuckets[1].prompts[1]
    ].filter(Boolean);
  }

  // If 3 or more datasets are granted, pick 1 distinct prompt from each granted dataset
  return [
    matchingBuckets[0].prompts[0],
    matchingBuckets[1].prompts[0],
    matchingBuckets[2].prompts[0]
  ].filter(Boolean);
};

const ChatHeroDashboard = ({ onSelectPrompt, userName, grantedDatasets }) => {
  const datasetNames = (grantedDatasets || [])
    .map(d => (typeof d === 'object' ? (d.name || d.id || '') : d))
    .filter(Boolean);
  const suggestedPrompts = getPromptsForGrantedDatasets(grantedDatasets);

  return (
    <div className={styles.heroWrapper}>
      <div className={styles.heroBox}>
        
        {/* 1. Header with Personalized Greeting (No emoji) */}
        <div className={styles.heroHeader}>
          <h1 className={styles.greetingTitle}>
            Hello, <span className={styles.greetingName}>{userName}</span>! I'm FINST<span className={styles.lambda}>Λ</span>NT, your financial data assistant.
          </h1>
          <p className={styles.heroSubtitle}>
            Ask me a question about your organization's uploaded financial data and I'll give you a direct answer sourced from your records.
          </p>
        </div>

        {/* 2. Granted Datasets Active Status Bar */}
        <div className={styles.datasetsRow}>
          <div className={styles.datasetsHeader}>
            <span className={styles.datasetsLabel}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              Granted Datasets &amp; Accessible Records:
            </span>
            {datasetNames.length > 0 ? (
              <span className={styles.accessBadge}>
                <span className={styles.dotPulse}></span>
                {datasetNames.length} {datasetNames.length === 1 ? 'Dataset' : 'Datasets'} Active
              </span>
            ) : (
              <span className={styles.noAccessBadge}>
                No Datasets Assigned
              </span>
            )}
          </div>
          <div className={styles.datasetsList}>
            {datasetNames.length > 0 ? (
              datasetNames.map((ds, idx) => (
                <span key={idx} className={styles.datasetChip}>
                  <span className={styles.dot}></span>
                  {ds}
                </span>
              ))
            ) : (
              <span className={styles.noDatasetsNotice}>
                No datasets are currently assigned to your account. Please contact an administrator to grant access.
              </span>
            )}
          </div>
        </div>

        {/* 3. 5 Capability Cards */}
        <div className={styles.capabilityGrid}>
          
          {/* Card 1: Green */}
          <div className={styles.capCard}>
            <div className={`${styles.capIcon} ${styles.iconGreen}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="8" y1="13" x2="16" y2="13"></line>
                <line x1="8" y1="17" x2="16" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            </div>
            <div className={styles.capTitle}>Run Natural Language Queries</div>
            <div className={styles.capDesc}>Ask questions in plain English (e.g. net salary, revenue, expenses).</div>
          </div>

          {/* Card 2: Purple */}
          <div className={styles.capCard}>
            <div className={`${styles.capIcon} ${styles.iconPurple}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
              </svg>
            </div>
            <div className={styles.capTitle}>Get Analytics &amp; Insights</div>
            <div className={styles.capDesc}>Find trends, summaries, aggregates and more.</div>
          </div>

          {/* Card 3: Blue (Mentioning only PDF and Excel as requested) */}
          <div className={styles.capCard}>
            <div className={`${styles.capIcon} ${styles.iconBlue}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
              </svg>
            </div>
            <div className={styles.capTitle}>Use Multiple File Types</div>
            <div className={styles.capDesc}>Works with PDF and Excel workbooks.</div>
          </div>

          {/* Card 4: Teal */}
          <div className={styles.capCard}>
            <div className={`${styles.capIcon} ${styles.iconTeal}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                <polyline points="9 12 11 14 15 10"></polyline>
              </svg>
            </div>
            <div className={styles.capTitle}>Cite Your Sources</div>
            <div className={styles.capDesc}>Get answers with references to your data files.</div>
          </div>

          {/* Card 5: Coral */}
          <div className={styles.capCard}>
            <div className={`${styles.capIcon} ${styles.iconCoral}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </div>
            <div className={styles.capTitle}>Export Results</div>
            <div className={styles.capDesc}>Download your results as PDF or Excel.</div>
          </div>

        </div>

        {/* 4. Interactive Clickable Suggested Prompts */}
        <div className={styles.promptSuggestionsRow}>
          <div className={styles.promptList}>
            {suggestedPrompts.map((promptText, idx) => (
              <button 
                key={idx}
                type="button" 
                className={styles.promptChip}
                onClick={() => onSelectPrompt(promptText)}
              >
                <span>{`"${promptText}"`}</span>
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

const copyToClipboard = async (text) => {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.warn("navigator.clipboard failed, attempting execCommand fallback:", err);
    }
  }

  // Robust fallback for plain HTTP IP addresses (e.g. http://54.83.65.189)
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    textArea.setAttribute("readonly", "");
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error("Fallback clipboard copy failed:", err);
    return false;
  }
};

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  return (
    <button className={styles.copyBtn} onClick={handleCopy} title="Copy message">
      {copied ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
      )}
    </button>
  );
};

const PdfButton = ({ elementId, fileName }) => {
  const [downloadStatus, setDownloadStatus] = useState('idle'); // 'idle' | 'generating' | 'downloaded'
  const resetTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const handleDownload = async () => {
    if (downloadStatus !== 'idle') return;
    setDownloadStatus('generating');
    try {
      // Dynamically import to prevent SSR 'window is not defined' errors in Next.js
      const html2pdf = (await import('html2pdf.js')).default;
      const element = document.getElementById(elementId);
      
      if (!element) {
        console.error("Element not found for PDF generation");
        setDownloadStatus('idle');
        return;
      }

      const targetFileName = fileName || `Finstant_Report_${new Date().toISOString().split('T')[0]}.pdf`;

      // --- DEDICATED OFF-SCREEN PRINT TEMPLATE ENGINE ---
      const clone = element.cloneNode(true);

      // 1. Remove on-screen interactive UI (buttons, menus, spinners)
      clone.querySelectorAll('button, svg.spinner, [class*="messageFooter"], [class*="copyBtn"]').forEach(b => b.remove());

      // 2. Detect wide tables to choose portrait vs landscape orientation
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

      // 3. Format clone as a clean, high-contrast corporate document
      clone.style.width = `${containerWidth}px`;
      clone.style.maxWidth = `${containerWidth}px`;
      clone.style.padding = '24px 28px';
      clone.style.background = '#FFFFFF';
      clone.style.color = '#111827';
      clone.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      clone.style.boxShadow = 'none';
      clone.style.border = 'none';
      clone.style.borderRadius = '0px';

      // 4. Expand all table containers so no columns are clipped or horizontally scrolled
      clone.querySelectorAll(`.${styles.tableContainer}, [class*="tableContainer"]`).forEach(tc => {
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

      clone.querySelectorAll('strong, [class*="metricChip"]').forEach(s => {
        s.style.color = '#111827';
        s.style.fontWeight = '700';
      });

      // 5. Executive Corporate Header
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
          <div style="color: #10B981; font-weight: 600;">Official Financial Extract</div>
        </div>
      `;
      clone.insertBefore(header, clone.firstChild);

      // 6. Executive Corporate Footer
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
        margin:       [10, 10, 10, 10],
        filename:     targetFileName,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, windowWidth: containerWidth + 80 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: isLandscape ? 'landscape' : 'portrait' },
        pagebreak:    { mode: ['css', 'legacy'], avoid: ['tr', 'h1', 'h2', 'h3', 'p', 'li'] }
      };

      // Generate raw PDF blob and trigger browser's native download manager (Chrome/Edge download tray)
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
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(() => {
        setDownloadStatus('idle');
      }, 2600);
    } catch (e) {
      console.error("PDF generation failed:", e);
      setDownloadStatus('idle');
    }
  };

  return (
    <button 
      className={`${styles.copyBtn} ${styles.pdfDownloadBtn} ${downloadStatus === 'downloaded' ? styles.pdfDownloadedSuccess : ''}`} 
      onClick={handleDownload} 
      title={downloadStatus === 'downloaded' ? "PDF Downloaded" : "Download Report as PDF"} 
      disabled={downloadStatus === 'generating'}
    >
      {downloadStatus === 'generating' ? (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.spinner}><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
          <span style={{ marginLeft: '4px', fontSize: '0.8rem', fontWeight: 600 }}>Generating...</span>
        </>
      ) : downloadStatus === 'downloaded' ? (
        <>
          <span className={styles.appleTickIcon}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </span>
          <span style={{ marginLeft: '4px', fontSize: '0.8rem', fontWeight: 600 }}>Downloaded</span>
        </>
      ) : (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          <span style={{ marginLeft: '4px', fontSize: '0.8rem', fontWeight: 600 }}>PDF</span>
        </>
      )}
    </button>
  );
};

const parseSourceCitation = (rawText) => {
  if (!rawText) return { sheets: '', files: '' };
  const text = rawText.replace(/^Source:\s*/i, '').trim();

  // Pattern 1: Already has "(...)" at the end: e.g. "p&l (FY-2022-23 and FY-2023-24)"
  const bracketMatch = text.match(/^([^(]+)\s*\(([^)]+)\)\.?$/);
  if (bracketMatch) {
    let rawSheets = bracketMatch[1].replace(/\bsheet[s]?\b/gi, '').trim();
    rawSheets = rawSheets.replace(/[,•\s]+$/, '').trim();
    return {
      sheets: rawSheets,
      files: bracketMatch[2].trim()
    };
  }

  // Pattern 2: Has separator like "—" or "•" or " - "
  let sheetPart = text;
  let filePart = '';

  if (text.includes('—')) {
    const parts = text.split('—');
    sheetPart = parts[0];
    filePart = parts.slice(1).join('—');
  } else if (text.includes(' • ')) {
    const parts = text.split(' • ');
    sheetPart = parts[0];
    filePart = parts.slice(1).join(' • ');
  } else if (text.includes(' - ') && (text.includes('.xlsx') || text.includes('FY'))) {
    const lastDash = text.lastIndexOf(' - ');
    sheetPart = text.slice(0, lastDash);
    filePart = text.slice(lastDash + 3);
  }

  // Extract sheet names
  let sheets = [];
  const sheetMatches = sheetPart.match(/([a-zA-Z0-9_&]+)\s+sheet/gi);
  if (sheetMatches) {
    sheets = sheetMatches.map(m => m.replace(/\s+sheet/gi, '').trim());
  } else {
    const knownSheets = ['p&l', 'kpi', 'monthly_payroll', 'gp_margins_salary_wise', 'salary_teamwise', 'balance_sheet', 'cash_flow'];
    for (const ks of knownSheets) {
      if (new RegExp('\\b' + ks.replace('&', '\\&') + '\\b', 'i').test(sheetPart)) {
        sheets.push(ks);
      }
    }
  }

  if (sheets.length === 0) {
    const firstChunk = sheetPart.split(/[,•(]/)[0].replace(/\bsheet[s]?\b/gi, '').trim();
    sheets.push(firstChunk || 'Financial Records');
  }
  const uniqueSheets = Array.from(new Set(sheets));

  // Extract file names
  let files = [];
  const searchForFiles = filePart || text;
  const fyMatches = searchForFiles.match(/FY[-_ ]?\d{2,4}(?:[-_/]\d{2,4})?/gi);
  if (fyMatches && fyMatches.length > 0) {
    files = Array.from(new Set(fyMatches.map(f => f.replace(/_/g, '-'))));
  } else if (filePart) {
    const cleanFile = filePart.replace(/\.(xlsx|xls|csv)\.?/gi, '').replace(/^[\s•–—-]+/, '').trim();
    if (cleanFile) files.push(cleanFile);
  }

  let formattedFiles = '';
  if (files.length === 1) {
    formattedFiles = files[0];
  } else if (files.length === 2) {
    formattedFiles = `${files[0]} and ${files[1]}`;
  } else if (files.length > 2) {
    formattedFiles = files.join(', ');
  }

  return {
    sheets: uniqueSheets.join(', '),
    files: formattedFiles
  };
};

const SourceCitation = ({ sourceText, citation }) => {
  const fullText = sourceText ? sourceText.replace(/^Source:\s*/i, '') : citation;
  if (!fullText) return null;

  const { sheets, files } = parseSourceCitation(fullText);

  return (
    <div className={styles.citationSection}>
      <hr className={styles.citationDivider} />
      <div className={styles.inlineCitation}>
        <span className={styles.citationHeading}>Source:</span>
        <span className={styles.citationSheets}>{sheets}</span>
        {files && <span className={styles.citationFiles}>({files})</span>}
      </div>
    </div>
  );
};

export default function ChatWindow({ chatId, setActiveChatId }) {
  const { theme, user, setChats } = useContext(AppContext);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [grantedDatasets, setGrantedDatasets] = useState([]);
  const endOfMessagesRef = useRef(null);
  const textareaRef = useRef(null);

  const rawName = user?.name || user?.first_name || user?.username || 'there';
  const userName = rawName.split(/\s+/)[0];

  useEffect(() => {
    const fetchAccess = async () => {
      try {
        let res = await authenticatedFetch('/api/my-access');
        if (!res.ok) res = await authenticatedFetch('/my-access');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setGrantedDatasets(data);
            return;
          }
        }
      } catch (e) {
        console.warn('Dataset access fetch error:', e);
      }
    };
    fetchAccess();
  }, [chatId, user]);

  useEffect(() => {
    if (chatId) {
      authenticatedFetch(`/chats/${chatId}`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setMessages(data.map(m => ({ id: m.id, role: m.role, text: m.text })));
          }
        })
        .catch(err => console.error("Failed to load chat history:", err));
    } else {
      setMessages([]);
    }
  }, [chatId]);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  };

  const handleSendPrompt = async (promptText) => {
    if (!promptText || isTyping) return;
    
    const userMsg = { id: Date.now().toString(), role: 'user', text: promptText };
    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const response = await authenticatedFetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: promptText, session_id: chatId })
      });

      const data = await response.json();
      
      if (!chatId && data.session_id) {
        setActiveChatId(data.session_id);
        if (setChats) {
          const newTitle = data.chat_title || promptText.slice(0, 30);
          setChats(prev => {
            if (prev.some(c => c.id === String(data.session_id))) return prev;
            return [{
              id: String(data.session_id),
              title: newTitle,
              createdAt: new Date().toISOString(),
              pinned: false,
              archived: false,
            }, ...prev];
          });
        }
      }

      const botMsg = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        text: data.answer || "Sorry, I couldn't process that.",
        citation: data.citation 
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error("Chat prompt error:", err);
      setMessages(prev => [...prev, { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        text: "Error communicating with server." 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsTyping(true);

    try {
      const response = await authenticatedFetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.text, session_id: chatId })
      });

      const data = await response.json();
      
      if (!chatId && data.session_id) {
        setActiveChatId(data.session_id);
        if (setChats) {
          const newTitle = data.chat_title || userMsg.text.slice(0, 30);
          setChats(prev => {
            if (prev.some(c => c.id === String(data.session_id))) return prev;
            return [{
              id: String(data.session_id),
              title: newTitle,
              createdAt: new Date().toISOString(),
              pinned: false,
              archived: false,
            }, ...prev];
          });
        }
      }

      const botMsg = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        text: data.answer || "Sorry, I couldn't process that.",
        citation: data.citation 
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error("Chat error:", err);
      setMessages(prev => [...prev, { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        text: "Error communicating with server." 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.messagesList}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <ChatHeroDashboard 
              userName={userName}
              grantedDatasets={grantedDatasets}
              onSelectPrompt={handleSendPrompt}
            />
          </div>
        ) : (
          messages.map(msg => {
            const parts = msg.text.split(/(?:\n\n|\n)?Source: /i);
            let mainText = parts[0];
            let sourceText = parts.length > 1 ? 'Source: ' + parts[1] : null;
            
            // Check if AI explicitly flagged this as a report/PDF anywhere in the full text
            const showPdf = msg.text.includes('<!-- SHOW_PDF_BUTTON -->');
            mainText = mainText.replace('<!-- SHOW_PDF_BUTTON -->', '').trim();
            if (sourceText) {
              sourceText = sourceText.replace('<!-- SHOW_PDF_BUTTON -->', '').trim();
            }
            
            return (
              <div key={msg.id} className={`${styles.messageWrapper} ${styles[msg.role]}`}>
                <div id={`msg-${msg.id}`} className={`${styles.messageBubble} ${styles.markdown} ${showPdf ? styles.reportBox : ''}`}>
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{ 
                      table: (props) => <DataTable {...props} messageText={mainText} isReportMode={showPdf} />,
                      strong: ({children, ...props}) => <strong className={styles.metricChip} {...props}>{children}</strong>,
                      code({node, inline, className, children, ...props}) {
                        const match = /language-(\w+)/.exec(className || '')
                        if (!inline && match && match[1] === 'chart') {
                          return <ChartRenderer jsonString={String(children).replace(/\n$/, '')} />
                        }
                        return <code className={className} {...props}>{children}</code>
                      }
                    }}
                  >
                    {mainText}
                  </ReactMarkdown>

                  {msg.role === 'assistant' && (sourceText || msg.citation) && (
                    <SourceCitation sourceText={sourceText} citation={msg.citation} />
                  )}
                </div>
                <div className={styles.messageFooter}>
                  <CopyButton text={mainText} />
                  {msg.role === 'assistant' && showPdf && (
                    <PdfButton elementId={`msg-${msg.id}`} />
                  )}
                </div>
              </div>
            );
          })
        )}
        
        {isTyping && (
          <div className={`${styles.messageWrapper} ${styles.assistant}`}>
            <div className={`${styles.messageBubble} ${styles.typingIndicator}`}>
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
        <div ref={endOfMessagesRef} />
      </div>

      <div className={styles.inputArea}>
        <div className={styles.inputWrapper}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className={styles.textarea}
            rows={1}
          />
          <button 
            onClick={handleSend} 
            className={styles.sendBtn}
            disabled={!input.trim() || isTyping}
            title="Send message"
            aria-label="Send message"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5"></line>
              <polyline points="5 12 12 5 19 12"></polyline>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
