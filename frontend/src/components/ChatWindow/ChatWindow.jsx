import { authenticatedFetch } from '../../api/auth';
import { useState, useRef, useEffect, useContext } from 'react';
import styles from './ChatWindow.module.css';
import { AppContext } from '@/pages/_app';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DataTable from './DataTable';
import ChartRenderer from './ChartRenderer';

const FULL_INTRO_LINE = "I am Finstant Developed with Love at DPL by WhiteWalkers.";
const PROMPT_LINE = "What do you want to know today?";

const OwlHeroIntro = () => {
  const [typedText, setTypedText] = useState('');
  const [phase, setPhase] = useState('idle'); // 'idle' | 'intro-typing' | 'intro-holding' | 'intro-deleting' | 'prompt-showing' | 'prompt-holding'

  useEffect(() => {
    let timer;

    if (phase === 'idle') {
      timer = setTimeout(() => {
        setPhase('intro-typing');
      }, 500);
    } else if (phase === 'intro-typing') {
      if (typedText.length < FULL_INTRO_LINE.length) {
        timer = setTimeout(() => {
          setTypedText(FULL_INTRO_LINE.substring(0, typedText.length + 1));
        }, 36);
      } else {
        setPhase('intro-holding');
      }
    } else if (phase === 'intro-holding') {
      timer = setTimeout(() => {
        setPhase('intro-deleting');
      }, 10000); // 10-second intro hold
    } else if (phase === 'intro-deleting') {
      if (typedText.length > 0) {
        timer = setTimeout(() => {
          setTypedText(typedText.substring(0, typedText.length - 1));
        }, 14);
      } else {
        // Once intro text is fully erased and owl returns to center, show prompt below owl
        setPhase('prompt-showing');
      }
    } else if (phase === 'prompt-showing') {
      timer = setTimeout(() => {
        setPhase('prompt-holding');
      }, 600);
    } else if (phase === 'prompt-holding') {
      timer = setTimeout(() => {
        // Smoothly loop back to intro
        setPhase('idle');
      }, 10000); // 10-second prompt hold
    }

    return () => clearTimeout(timer);
  }, [phase, typedText]);

  const isIntroActive = phase.startsWith('intro');
  const isPromptActive = phase.startsWith('prompt');

  return (
    <div className={styles.emptyStateLockup}>
      {/* Desktop / Laptop Layout: Gliding Owl Mascot with Horizontal Stream Emergence */}
      <div className={styles.desktopHeroContainer}>
        <div className={styles.horizontalHeroRow}>
          <div className={styles.mascotGlider}>
            <img src="/logo.svg" alt="Finstant Owl Mascot" className={styles.mascotImg} />
          </div>

          {isIntroActive && (
            <div className={`${styles.streamTextPortal} ${typedText.length > 0 ? styles.portalActive : ''}`}>
              <span className={styles.streamText}>
                {typedText}
                {phase !== 'intro-holding' && <span className={styles.streamCaret}>|</span>}
              </span>
            </div>
          )}
        </div>

        <div className={`${styles.bottomPromptWrapper} ${isPromptActive ? styles.promptVisible : ''}`}>
          <h2 className={styles.emptyStatePrompt}>
            {PROMPT_LINE}
          </h2>
        </div>
      </div>

      {/* Mobile Layout: Dedicated Centered Mascot with Below-Logo Typing from Frame 1 */}
      <div className={styles.mobileHeroContainer}>
        <div className={styles.mobileMascotBox}>
          <img src="/logo.svg" alt="Finstant Owl Mascot" className={styles.mascotImg} />
        </div>

        <div className={styles.mobileTextBox}>
          {isIntroActive && (
            <div className={styles.mobileIntroText}>
              {typedText}
              {phase !== 'intro-holding' && <span className={styles.streamCaret}>|</span>}
            </div>
          )}

          {isPromptActive && (
            <h2 className={styles.mobilePromptText}>
              {PROMPT_LINE}
            </h2>
          )}
        </div>
      </div>
    </div>
  );
};

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
  const [downloading, setDownloading] = useState(false);
  
  const handleDownload = async () => {
    setDownloading(true);
    try {
      // Dynamically import to prevent SSR 'window is not defined' errors in Next.js
      const html2pdf = (await import('html2pdf.js')).default;
      const element = document.getElementById(elementId);
      
      if (!element) {
        console.error("Element not found for PDF generation");
        return;
      }
      
      const opt = {
        margin:       [15, 15, 15, 15],
        filename:     fileName || `Finstant_Report_${new Date().toISOString().split('T')[0]}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak:    { mode: ['css', 'legacy'], avoid: ['tr', 'h1', 'h2', 'h3', 'p', 'li'] }
      };
      
      await html2pdf().set(opt).from(element).save();
    } catch (e) {
      console.error("PDF generation failed:", e);
    } finally {
      setDownloading(false);
    }
  };
  
  return (
    <button className={`${styles.copyBtn} ${styles.pdfDownloadBtn}`} onClick={handleDownload} title="Download Report as PDF" disabled={downloading}>
      {downloading ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.spinner}><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg>
      ) : (
        <>
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          <span style={{ marginLeft: '4px', fontSize: '0.8rem', fontWeight: 600 }}>PDF</span>
        </>
      )}
    </button>
  );
};

const SourceButton = ({ sourceText }) => {
  return (
    <div className={styles.sourceBtnWrapper} title={sourceText}>
      <button className={styles.copyBtn}>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
      </button>
    </div>
  );
};

export default function ChatWindow({ chatId, setActiveChatId }) {
  const { theme, user } = useContext(AppContext);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const endOfMessagesRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (chatId) {
      authenticatedFetch(`http://127.0.0.1:8000/chats/${chatId}`)
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

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsTyping(true);

    try {
      const response = await authenticatedFetch('http://127.0.0.1:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.text, session_id: chatId })
      });

      const data = await response.json();
      
      if (!chatId && data.session_id) {
        setActiveChatId(data.session_id);
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
            {/* Dynamic Gliding Owl Mascot with Sequential Typewriter and Bottom Prompt Reveal */}
            <OwlHeroIntro />
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
                </div>
                <div className={styles.messageFooter}>
                  <CopyButton text={mainText} />
                  {msg.role === 'assistant' && showPdf && (
                    <PdfButton elementId={`msg-${msg.id}`} />
                  )}
                  {sourceText && (
                    <SourceButton sourceText={sourceText} />
                  )}
                  {msg.citation && (
                    <div className={styles.citation}>{msg.citation}</div>
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
