import React, { useState, useEffect, useRef, useContext } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AppContext } from '@/pages/_app';

const DEMOS = [
  {
    q: "Looking at the GP margin salaries of FY 23-24 and FY25, what's the predicted GP margin salary for next 3 FYs.",
    a: "Based on GP margin salary data from FY 2023-24 (23.40%), FY 2024-25 (15.95%), and FY 2025-26 (25.12%), linear regression predicts: FY 2026-27: ~22.5% | FY 2027-28: ~24.0% | FY 2028-29: ~25.5%.",
    c: "Source: <strong>p&l / payroll</strong> &bull; Multi-year historical trend & linear regression forecast"
  },
  {
    q: "What was our Gross Profit Margin in FY 2023-24?",
    a: "Gross Profit Margin for FY 2023-24 was 24.54% (Net Revenue: $4,850,230 | Cost of Sales: $3,659,984).",
    c: "Source: <strong>p&l</strong> &bull; Exact variance calculated against FY 2022-23 (+1.8%)"
  },
  {
    q: "What was the total monthly payroll for December 2024?",
    a: "Total monthly payroll for December 2024 was $184,500 across 42 active employees.",
    c: "Source: <strong>payroll</strong> &bull; Verified from base salaries and active headcount"
  },
  {
    q: "Show me Travel & Leap expenses breakdown for FY 2023-24",
    a: "Travel & Leap expenses totaled $142,800, representing 8.4% of total Operating Expenses.",
    c: "Source: <strong>p&l</strong> &bull; Row 18: Travel & Leap Expenses"
  },
  {
    q: "What is the closing headcount trend across quarters?",
    a: "Headcount expanded from 36 in Q1 to 44 by Q4 (+22.2% annual team growth).",
    c: "Source: <strong>kpi</strong> &bull; Metric: Closing Headcount"
  }
];

const SECTIONS = [
  { id: 'section-hero', label: 'Overview', glow: '#22B8CF' },
  { id: 'section-demo', label: 'Live Demo', glow: '#06B6D4' },
  { id: 'section-stats', label: 'Metrics', glow: '#22B8CF' },
  { id: 'section-features', label: 'Features', glow: '#7C6FF0' },
  { id: 'section-security', label: 'Security', glow: '#10B981' },
  { id: 'section-cta', label: 'Get Started', glow: '#22B8CF' }
];

export default function LandingPage() {
  const router = useRouter();
  const appContext = useContext(AppContext);
  const [localTheme, setLocalTheme] = useState('light');
  const theme = appContext?.theme || localTheme;
  const [activeSection, setActiveSection] = useState('section-hero');
  const [clickedBtn, setClickedBtn] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // Typewriter demo state
  const [demoState, setDemoState] = useState({
    inputText: '',
    isTypingInput: false,
    sendBtnActive: false,
    sendBtnPressed: false,
    showUserMsg: false,
    showBotMsg: false,
    isTypingBot: false,
    showCitation: false,
    userQuestion: '',
    botAnswer: '',
    citationHTML: '',
    pipelineStage: 1
  });

  const demoIndexRef = useRef(0);
  const timersRef = useRef([]);
  const activeSectionRef = useRef(activeSection);
  const isNavigatingRef = useRef(false);

  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

  function addTimer(fn, delay) {
    const t = setTimeout(fn, delay);
    timersRef.current.push(t);
    return t;
  }

  function clearAllTimers() {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }

  // Theme Sync
  useEffect(() => {
    if (!appContext) {
      const savedTheme = localStorage.getItem('finstant-theme') || 'light';
      setLocalTheme(savedTheme);
      document.documentElement.setAttribute('data-theme', savedTheme);
    }
  }, [appContext]);

  const toggleTheme = () => {
    if (appContext?.toggleTheme) {
      appContext.toggleTheme();
    } else {
      const nextTheme = theme === 'dark' ? 'light' : 'dark';
      setLocalTheme(nextTheme);
      localStorage.setItem('finstant-theme', nextTheme);
      document.documentElement.setAttribute('data-theme', nextTheme);
    }
  };

  // Section tracking observer & Reveal observer
  useEffect(() => {
    const sectionEls = document.querySelectorAll('.snap-section');
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          setActiveSection(id);
          const found = SECTIONS.find(s => s.id === id);
          if (found) {
            document.documentElement.style.setProperty('--glow-shift-color', found.glow);
          }
        }
      });
    }, {
      rootMargin: '-20% 0px -20% 0px',
      threshold: 0.3
    });

    sectionEls.forEach(el => sectionObserver.observe(el));

    const revealEls = document.querySelectorAll('.reveal-item');
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          revealObserver.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.15
    });

    revealEls.forEach(el => revealObserver.observe(el));

    return () => {
      sectionEls.forEach(el => sectionObserver.unobserve(el));
      sectionObserver.disconnect();
      revealEls.forEach(el => revealObserver.unobserve(el));
      revealObserver.disconnect();
    };
  }, []);

  // Keyboard and Trackpad / Mouse Wheel Step Navigation for Desktop
  useEffect(() => {
    const sectionIds = ['section-hero', 'section-demo', 'section-stats', 'section-features', 'section-security', 'section-cta'];

    const getTargetScrollTop = (idx) => {
      const el = document.getElementById(sectionIds[idx]);
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      return window.pageYOffset + rect.top;
    };

    const scrollToSectionIdx = (idx) => {
      if (idx < 0 || idx >= sectionIds.length) return;
      isNavigatingRef.current = true;
      const targetTop = getTargetScrollTop(idx);
      window.scrollTo({
        top: targetTop,
        behavior: 'smooth'
      });
      setTimeout(() => {
        isNavigatingRef.current = false;
      }, 750);
    };

    const handleKeyDown = (e) => {
      const activeEl = document.activeElement;
      const tag = activeEl ? activeEl.tagName.toLowerCase() : '';
      if (tag === 'input' || tag === 'textarea') return;

      const curIdx = sectionIds.indexOf(activeSectionRef.current);

      if (e.key === 'PageDown' || e.key === 'ArrowDown' || (e.key === ' ' && !e.shiftKey)) {
        if (curIdx < sectionIds.length - 1) {
          e.preventDefault();
          scrollToSectionIdx(curIdx + 1);
        }
      } else if (e.key === 'PageUp' || e.key === 'ArrowUp' || (e.key === ' ' && e.shiftKey)) {
        if (curIdx > 0) {
          e.preventDefault();
          scrollToSectionIdx(curIdx - 1);
        }
      } else if (e.key === 'Home') {
        e.preventDefault();
        scrollToSectionIdx(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        scrollToSectionIdx(sectionIds.length - 1);
      }
    };

    const handleWheel = (e) => {
      if (window.innerWidth <= 768) return; // Keep mobile touch natural
      if (Math.abs(e.deltaY) < 20) return; // Ignore slight trackpad drift

      if (isNavigatingRef.current) {
        e.preventDefault();
        return;
      }

      const curIdx = sectionIds.indexOf(activeSectionRef.current);
      if (e.deltaY > 0) {
        if (curIdx < sectionIds.length - 1) {
          e.preventDefault();
          scrollToSectionIdx(curIdx + 1);
        }
      } else if (e.deltaY < 0) {
        if (curIdx > 0) {
          e.preventDefault();
          scrollToSectionIdx(curIdx - 1);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Live Typewriter demo loop
  useEffect(() => {
    let isCancelled = false;

    function typeInput(fullText, onDone) {
      let idx = 0;
      setDemoState(prev => ({
        ...prev,
        inputText: '',
        isTypingInput: true,
        sendBtnActive: false,
        sendBtnPressed: false,
        showUserMsg: false,
        showBotMsg: false,
        showCitation: false,
        userQuestion: '',
        botAnswer: '',
        citationHTML: ''
      }));

      const interval = setInterval(() => {
        if (isCancelled) { clearInterval(interval); return; }
        idx++;
        setDemoState(prev => ({
          ...prev,
          inputText: fullText.slice(0, idx),
          sendBtnActive: idx > 0
        }));

        if (idx >= fullText.length) {
          clearInterval(interval);
          if (!isCancelled && onDone) onDone();
        }
      }, 16);
    }

    function typeBotResponse(fullAnswer, fullCitation, onDone) {
      let idx = 0;
      setDemoState(prev => ({
        ...prev,
        showBotMsg: true,
        isTypingBot: true,
        botAnswer: ''
      }));

      const interval = setInterval(() => {
        if (isCancelled) { clearInterval(interval); return; }
        idx++;
        setDemoState(prev => ({
          ...prev,
          botAnswer: fullAnswer.slice(0, idx)
        }));

        if (idx >= fullAnswer.length) {
          clearInterval(interval);
          setDemoState(prev => ({
            ...prev,
            isTypingBot: false,
            botAnswer: fullAnswer,
            citationHTML: fullCitation,
            showCitation: true
          }));
          if (!isCancelled && onDone) onDone();
        }
      }, 12);
    }

    function runCycle() {
      if (isCancelled) return;
      const cur = DEMOS[demoIndexRef.current % DEMOS.length];

      setDemoState(prev => ({ ...prev, pipelineStage: 1 }));

      typeInput(cur.q, () => {
        addTimer(() => {
          if (isCancelled) return;
          setDemoState(prev => ({ ...prev, sendBtnPressed: true }));

          addTimer(() => {
            if (isCancelled) return;
            setDemoState(prev => ({
              ...prev,
              inputText: '',
              isTypingInput: false,
              sendBtnActive: false,
              sendBtnPressed: false,
              userQuestion: cur.q,
              showUserMsg: true,
              pipelineStage: 2
            }));

            addTimer(() => {
              if (isCancelled) return;
              setDemoState(prev => ({ ...prev, pipelineStage: 3 }));

              addTimer(() => {
                if (isCancelled) return;
                setDemoState(prev => ({ ...prev, pipelineStage: 4 }));

                addTimer(() => {
                  if (isCancelled) return;
                  setDemoState(prev => ({ ...prev, pipelineStage: 5 }));

                  addTimer(() => {
                    if (isCancelled) return;
                    setDemoState(prev => ({ ...prev, pipelineStage: 6 }));
                    typeBotResponse(cur.a, cur.c, () => {
                      demoIndexRef.current++;
                      addTimer(runCycle, 3800);
                    });
                  }, 350);
                }, 350);
              }, 350);
            }, 300);
          }, 180);
        }, 320);
      });
    }

    runCycle();

    return () => {
      isCancelled = true;
      clearAllTimers();
    };
  }, []);

  const handleGetStarted = (e) => {
    e.preventDefault();
    setClickedBtn(true);
    setTimeout(() => {
      setIsExiting(true);
    }, 100);
    setTimeout(() => {
      router.push('/login');
    }, 320);
  };

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className={`landing-content-wrap ${isExiting ? 'is-exiting' : ''}`} id="landingContentWrap">
      <div className="ambient-glow" id="ambientGlow" />
      <div className="top-nav-mask" id="topNavMask" aria-hidden="true" />

      {/* 1. NAVBAR (.top-header) — ON PAGE LOAD ONLY */}
      <header className="top-header">
        <div className="top-header-inner">
          <Link href="/" className="brand-lockup">
            <div className="brand-exec-badge">
              <img src="/logo.svg" alt="FINSTΛNT Owl Mascot Logo" className="brand-exec-img" />
            </div>
            <div className="brand-wordmark">
              FINST<span className="lambda">Λ</span>NT
            </div>
          </Link>

          <div className="header-actions">
            <button
              type="button"
              className="theme-toggle"
              id="themeToggle"
              aria-label="Toggle dark mode"
              title="Toggle Light/Dark Theme"
              onClick={toggleTheme}
            />
            <button
              type="button"
              onClick={handleGetStarted}
              className={`btn btn-primary ${clickedBtn ? 'btn-clicked' : ''}`}
            >
              Get Started <span className="btn-arrow">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Side Arc Navigation */}
      <nav className="side-dot-nav" id="sideDotNav" aria-label="Page Sections Navigation">
        {SECTIONS.map((sec) => (
          <button
            key={sec.id}
            type="button"
            className={`nav-dot ${activeSection === sec.id ? 'active' : ''}`}
            onClick={() => scrollToSection(sec.id)}
            data-target={sec.id}
            aria-label={sec.label}
            title={sec.label}
          >
            <span className="dot-tooltip">{sec.label}</span>
          </button>
        ))}
      </nav>

      <main>
        {/* 1. HERO SECTION */}
        <section className="snap-section is-active" id="section-hero">
          <div className="wrap">
            <div className="hero-content">
              <h1>
                <span className="hero-word" style={{ animationDelay: '250ms' }}>Instant</span>{' '}
                <span className="hero-word" style={{ animationDelay: '310ms' }}>Answers</span>{' '}
                <span className="hero-word" style={{ animationDelay: '370ms' }}>From</span><br />
                <span className="hero-word" style={{ animationDelay: '430ms' }}>Your</span>{' '}
                <span className="hero-word" style={{ animationDelay: '490ms' }}>Financial</span>{' '}
                <span className="hero-word" style={{ animationDelay: '550ms' }}>Data.</span><br />
                <span className="hero-word" style={{ animationDelay: '610ms' }}>Computed,</span>{' '}
                <span className="hero-word" style={{ animationDelay: '670ms' }}>Verified</span>{' '}
                <span className="hero-word" style={{ animationDelay: '720ms' }}>and</span>{' '}
                <span className="hero-word" style={{ animationDelay: '780ms' }}>
                  <span className="gradient-sourced">100% Sourced.</span>
                </span>
              </h1>
              <p className="sub">
                FINSTΛNT turns spreadsheets and accounting ledgers into natural conversations, every metric calculated via real SQL queries, zero hallucinations, running for under $5-8/month.
              </p>
              <div className="hero-ctas">
                <button
                  type="button"
                  onClick={handleGetStarted}
                  className={`btn btn-primary ${clickedBtn ? 'btn-clicked' : ''}`}
                >
                  Get Started <span className="btn-arrow">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('section-demo')}
                  className="btn btn-ghost"
                >
                  Watch Live Demo &darr;
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 2. LIVE DEMO PANEL SECTION */}
        <section className="snap-section" id="section-demo">
          <div className="wrap">
            <div className="section-head reveal-item" style={{ marginBottom: 'clamp(20px, 3.5vh, 32px)', transitionDelay: '0ms' }}>
              <h2>Autonomous Query Engine in Action</h2>
              <p>Real-time deterministic SQL execution with precise spreadsheet citations, zero hallucinations.</p>
            </div>

            <div className="demo-panel reveal-item" style={{ margin: '0 auto', maxWidth: '780px', transitionDelay: '80ms' }}>
              {/* 6-Stage Query Processing Pipeline Bar */}
              <div className="query-pipeline-bar">
                <div className="pipeline-track-line">
                  <div
                    className="pipeline-progress-glow"
                    style={{
                      width:
                        demoState.pipelineStage === 1 ? '0%' :
                        demoState.pipelineStage === 2 ? '20%' :
                        demoState.pipelineStage === 3 ? '40%' :
                        demoState.pipelineStage === 4 ? '60%' :
                        demoState.pipelineStage === 5 ? '80%' : '100%'
                    }}
                  />
                </div>
                <div className={`pipeline-node ${demoState.pipelineStage === 1 ? 'active' : demoState.pipelineStage > 1 ? 'completed' : ''}`}>
                  <div className="pipeline-node-circle">1</div>
                  <span>QUERY</span>
                </div>
                <div className={`pipeline-node ${demoState.pipelineStage === 2 ? 'active' : demoState.pipelineStage > 2 ? 'completed' : ''}`}>
                  <div className="pipeline-node-circle">2</div>
                  <span>SCHEMA</span>
                </div>
                <div className={`pipeline-node ${demoState.pipelineStage === 3 ? 'active' : demoState.pipelineStage > 3 ? 'completed' : ''}`}>
                  <div className="pipeline-node-circle">3</div>
                  <span>SQL GEN</span>
                </div>
                <div className={`pipeline-node ${demoState.pipelineStage === 4 ? 'active' : demoState.pipelineStage > 4 ? 'completed' : ''}`}>
                  <div className="pipeline-node-circle">4</div>
                  <span>EXECUTE</span>
                </div>
                <div className={`pipeline-node ${demoState.pipelineStage === 5 ? 'active' : demoState.pipelineStage > 5 ? 'completed' : ''}`}>
                  <div className="pipeline-node-circle">5</div>
                  <span>VERIFY</span>
                </div>
                <div className={`pipeline-node ${demoState.pipelineStage === 6 ? 'active completed' : ''}`}>
                  <div className="pipeline-node-circle">6</div>
                  <span>ANSWERED</span>
                </div>
              </div>

              {/* Dynamic Chat Conversation Stream */}
              <div className="demo-conversation">
                <div className={`demo-msg-user-wrap ${demoState.showUserMsg ? 'show' : ''}`} id="demoUserMsgWrap">
                  <div className="demo-msg-user" id="demoQuestion">
                    {demoState.userQuestion}
                  </div>
                </div>

                <div className={`demo-response-box ${demoState.showBotMsg ? 'show' : ''}`} id="demoResponseBox">
                  <div className="demo-answer" id="demoAnswer">
                    {demoState.botAnswer}
                    {demoState.isTypingBot && <span className="demo-cursor" />}
                  </div>
                  <div className={`demo-citation ${demoState.showCitation ? 'show' : ''}`} id="demoCitation">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span id="demoCitationContent" dangerouslySetInnerHTML={{ __html: demoState.citationHTML }} />
                  </div>
                </div>
              </div>

              <div className={`demo-input-bar ${demoState.isTypingInput ? 'typing' : ''}`} id="demoInputBar">
                <div className="demo-input-text" id="demoInputText">
                  {demoState.inputText ? (
                    <>
                      {demoState.inputText}
                      {demoState.isTypingInput && <span className="demo-cursor" />}
                    </>
                  ) : (
                    <span className="placeholder">Type your financial query...</span>
                  )}
                </div>
                <button
                  type="button"
                  className={`demo-send-btn ${demoState.sendBtnActive ? 'active' : ''} ${demoState.sendBtnPressed ? 'pressed' : ''}`}
                  id="demoSendBtn"
                  title="Send message"
                  aria-label="Send message"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 3. STATS SECTION — ON SCROLL INTO VIEW (60ms Stagger) */}
        <section className="snap-section" id="section-stats">
          <div className="wrap">
            <div className="stats-card-container">
              <div className="stats-intro reveal-item" style={{ transitionDelay: '0ms' }}>
                <h2>Engineered for Enterprise Performance</h2>
                <p>Deterministic calculations delivered at lightning speed with unmatched cloud cost efficiency.</p>
              </div>
              <div className="stats">
                <div className="stat reveal-item" style={{ transitionDelay: '0ms' }}><div className="num"> ~ $5-8/mo</div><div className="label">Total Operating Cloud Cost</div></div>
                <div className="stat reveal-item" style={{ transitionDelay: '60ms' }}><div className="num">&lt; 50ms</div><div className="label">Instant Fast-Router Speed</div></div>
                <div className="stat reveal-item" style={{ transitionDelay: '120ms' }}><div className="num">100%</div><div className="label">Deterministic Source Audited</div></div>
                <div className="stat reveal-item" style={{ transitionDelay: '180ms' }}><div className="num">0%</div><div className="label">Data Leaves Your AWS VPC</div></div>
              </div>

              {/* Financial Micro Ticker inside Stats Container */}
              <div className="financial-ticker-wrap reveal-item" style={{ transitionDelay: '240ms' }}>
                <div className="ticker-track">
                  <span>GROSS MARGIN <strong className="val-pos">+24.5%</strong></span>
                  <span>•</span>
                  <span>OPEX RATIO <strong className="val-neg">-4.2%</strong></span>
                  <span>•</span>
                  <span>FAST-ROUTER <strong className="val-acc">&lt; 48ms</strong></span>
                  <span>•</span>
                  <span>DETERMINISTIC JOIN <strong className="val-pos">100%</strong></span>
                  <span>•</span>
                  <span>AWS VPC ISOLATION <strong className="val-pos">ACTIVE</strong></span>
                  <span>•</span>
                  <span>TOTAL CLOUD COST <strong className="val-acc">&lt; $1.85/mo</strong></span>
                  <span>•</span>
                  <span>CLOSING HEADCOUNT <strong className="val-pos">44 ACTIVE</strong></span>
                  <span>•</span>
                  <span>GROSS MARGIN <strong className="val-pos">+24.5%</strong></span>
                  <span>•</span>
                  <span>OPEX RATIO <strong className="val-neg">-4.2%</strong></span>
                  <span>•</span>
                  <span>FAST-ROUTER <strong className="val-acc">&lt; 48ms</strong></span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. FEATURES BENTO GRID — ON SCROLL INTO VIEW (60ms Stagger) */}
        <section className="snap-section" id="section-features">
          <div className="wrap">
            <div className="section-head reveal-item" style={{ transitionDelay: '0ms' }}>
              <h2>Everything Your Finance Team Needs</h2>
              <p>Not a generic chatbot guessing at numbers, an autonomous financial query engine that translates natural language directly into verified SQL.</p>
            </div>
            <div className="bento">
              <div className="card big reveal-item" style={{ transitionDelay: '0ms' }}>
                <span className="tag tag-cyan">NATURAL CONVERSATION</span>
                <div className="icon-dot" style={{ background: 'color-mix(in srgb, var(--accent) 18%, transparent)', color: 'var(--accent)' }}>&#10022;</div>
                <h3>Plain English &bull; Pure Financial Math</h3>
                <p>Ask complex questions across multiple uploaded files, Finstant executes exact relational joins and mathematical aggregations, never an approximation.</p>
              </div>

              <div className="card reveal-item" style={{ transitionDelay: '60ms' }}>
                <span className="tag tag-green">ZERO HALLUCINATIONS</span>
                <div className="icon-dot" style={{ background: 'color-mix(in srgb, var(--gain) 18%, transparent)', color: 'var(--gain)' }}>&#10003;</div>
                <h3>100% Sourced & Cited</h3>
                <p>Every single number cites its underlying table, column name, and financial period down to the exact row.</p>
              </div>

              <div className="card reveal-item" style={{ transitionDelay: '120ms' }}>
                <span className="tag tag-pink">EFFICIENCY</span>
                <div className="icon-dot" style={{ background: 'color-mix(in srgb, var(--pink) 18%, transparent)', color: 'var(--pink)' }}>&#9889;</div>
                <h3>Sub-50ms Fast Router</h3>
                <p>Common lookups hit our zero-token deterministic router and semantic SQL cache for sub-50ms answers at $0.00 cost.</p>
              </div>

              <div className="card reveal-item" style={{ transitionDelay: '180ms' }}>
                <div className="icon-dot" style={{ background: 'color-mix(in srgb, var(--violet) 18%, transparent)', color: 'var(--violet)' }}>&#9638;</div>
                <h3>Multi-Table Variance & Ratios</h3>
                <p>Effortlessly computes GP Margins %, OPEX ratios, headcount variances, and month-over-month EBITDA trends.</p>
              </div>

              <div className="card reveal-item" style={{ transitionDelay: '240ms' }}>
                <div className="icon-dot" style={{ background: 'color-mix(in srgb, var(--loss) 18%, transparent)', color: 'var(--loss)' }}>&#9782;</div>
                <h3>Instant PDF & Table Reports</h3>
                <p>Export pixel-perfect vector A4 financial reports and interactive spreadsheets straight from the conversation.</p>
              </div>

              <div className="card big reveal-item" style={{ transitionDelay: '300ms' }}>
                <div className="icon-dot" style={{ background: 'color-mix(in srgb, var(--gain) 18%, transparent)', color: 'var(--gain)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <ellipse cx="12" cy="5" rx="9" ry="3" />
                    <path d="M3 5v5c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
                    <path d="M3 10v5c0 1.66 4.03 3 9 3s9-1.34 9-3v-5" />
                    <path d="M3 15v4c0 1.66 4.03 3 9 3s9-1.34 9-3v-4" />
                  </svg>
                </div>
                <h3>Unbeatable Cloud Cost Efficiency</h3>
                <p>By leveraging dynamic schema pruning, local PostgreSQL query caching, and lightweight LLM models, FINSTΛNT processes thousands of financial questions for less than the price of a cup of coffee.</p>
              </div>
            </div>
          </div>
        </section>

        {/* 5. SECURITY BAND SECTION — ON SCROLL INTO VIEW (70ms Stagger) */}
        <section className="snap-section" id="section-security">
          <div className="wrap">
            <div className="security-band reveal-item" style={{ transitionDelay: '0ms' }}>
              <div className="text">
                <h2>Air-Tight AWS Cloud Architecture</h2>
                <p>Financial records must remain strictly confidential. FINSTΛNT is engineered to operate inside your isolated AWS environment with zero data leakage.</p>
              </div>
              <div className="security-list">
                <div className="security-item reveal-item" style={{ transitionDelay: '70ms' }}>
                  <span className="check">&#10003;</span>
                  <div><strong>Private VPC Isolation:</strong> Runs entirely within your private subnet with strict security groups.</div>
                </div>
                <div className="security-item reveal-item" style={{ transitionDelay: '140ms' }}>
                  <span className="check">&#10003;</span>
                  <div><strong>Granular Role-Based Access (RBAC):</strong> Users only query tables their permission tier authorizes.</div>
                </div>
                <div className="security-item reveal-item" style={{ transitionDelay: '210ms' }}>
                  <span className="check">&#10003;</span>
                  <div><strong>Read-Only Database Enforcement:</strong> Backend database credentials strictly reject any mutating statements (DROP/DELETE/UPDATE).</div>
                </div>
                <div className="security-item reveal-item" style={{ transitionDelay: '280ms' }}>
                  <span className="check">&#10003;</span>
                  <div><strong>End-to-End Encryption:</strong> AES-256 at rest and TLS 1.3 in transit with zero model training on your proprietary records.</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. FINAL CTA SECTION — ON SCROLL INTO VIEW (80ms Stagger) */}
        <section className="snap-section" id="section-cta">
          <div className="wrap">
            <div className="cta-box">
              <h2 className="reveal-item" style={{ transitionDelay: '0ms' }}>Ready to Transform Your Financial Intelligence?</h2>
              <p className="reveal-item" style={{ transitionDelay: '80ms' }}>No spreadsheets to manually dig through. Just fast, verified financial answers.</p>
              <div className="reveal-item" style={{ transitionDelay: '160ms' }}>
                <button
                  type="button"
                  onClick={handleGetStarted}
                  className={`btn btn-primary ${clickedBtn ? 'btn-clicked' : ''}`}
                  style={{ padding: '14px clamp(20px, 5vw, 32px)', fontSize: 'clamp(13.5px, 2.8vw, 15px)' }}
                >
                  Get Started with FINSTΛNT <span className="btn-arrow">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </span>
                </button>
              </div>
            </div>

            {/* Footer Inside Section 6 */}
            <footer>
              <div className="footer-inner">
                <Link href="/" className="brand-lockup" style={{ transform: 'scale(0.88)', transformOrigin: 'left center' }}>
                  <div className="brand-exec-badge" style={{ width: '40px', height: '40px', borderRadius: '50%' }}>
                    <img src="/logo.svg" alt="FINSTΛNT Owl Logo" className="brand-exec-img" style={{ width: '24px', height: '24px' }} />
                  </div>
                  <div className="brand-wordmark" style={{ fontSize: '22px' }}>
                    FINST<span className="lambda">Λ</span>NT
                  </div>
                </Link>
                <div className="fine">
                  &copy; 2026 FINSTΛNT. Built at DPL by WhiteWalkers ❤️.
                </div>
              </div>
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}
