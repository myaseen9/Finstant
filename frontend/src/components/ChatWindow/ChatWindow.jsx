import { useState, useRef, useEffect, useContext } from 'react';
import styles from './ChatWindow.module.css';
import { AppContext } from '@/pages/_app';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DataTable from './DataTable';
import ChartRenderer from './ChartRenderer';

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

  useEffect(() => {
    if (chatId) {
      fetch(`http://localhost:8000/chats/${chatId}`, { credentials: 'include' })
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

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMessage = input.trim();
    const newMsg = { id: Date.now().toString(), role: 'user', text: userMessage };
    setMessages(prev => [...prev, newMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ message: userMessage, session_id: chatId })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!chatId && data.session_id && setActiveChatId) {
        setActiveChatId(data.session_id);
      }
      
      setMessages(prev => [
        ...prev, 
        { 
          id: Date.now().toString(), 
          role: 'assistant', 
          text: data.answer,
        }
      ]);
    } catch (error) {
      console.error("Failed to fetch chat:", error);
      setMessages(prev => [
        ...prev, 
        { 
          id: Date.now().toString(), 
          role: 'assistant', 
          text: 'Sorry, I am having trouble connecting to the backend engine right now.',
        }
      ]);
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
            <div className={styles.emptyStateLogoWrapper}>
              <img src="/logo.svg" alt="Finstant Logo" className={styles.emptyStateLogo} />
            </div>
            <h2>What do you want to know, {user?.firstName || user?.first_name || 'there'}?</h2>
          </div>
        ) : (
          messages.map(msg => {
            const parts = msg.text.split(/(?:\n\n|\n)?Source: /i);
            const mainText = parts[0];
            const sourceText = parts.length > 1 ? 'Source: ' + parts[1] : null;
            
            return (
              <div key={msg.id} className={`${styles.messageWrapper} ${styles[msg.role]}`}>
                <div className={`${styles.messageBubble} ${styles.markdown}`}>
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{ 
                      table: (props) => <DataTable {...props} messageText={mainText} />,
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
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className={styles.textarea}
            rows={1}
          />
          <button 
            onClick={handleSend} 
            className={styles.sendBtn}
            disabled={!input.trim() || isTyping}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
