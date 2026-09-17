import { useEffect, useState, useContext, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { AppContext } from './_app';
import { authenticatedFetch } from '@/api/auth';
import Layout from '@/components/Layout/Layout';
import styles from '@/styles/Dashboard.module.css';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Format numbers as currency with K/M abbreviation and dynamic currency code
const getCurrencyPrefix = (currency) => {
  if (!currency) return 'PKR ';
  const c = String(currency).toUpperCase().trim();
  if (c === 'USD' || c === '$') return '$';
  if (c === 'EUR' || c === '€') return '€';
  if (c === 'GBP' || c === '£') return '£';
  if (c === 'PKR' || c === 'RS' || c === 'RS.') return 'PKR ';
  return `${c} `;
};

const formatCurrency = (value, currency = 'PKR') => {
  if (value === null || value === undefined || isNaN(value)) return `${getCurrencyPrefix(currency)}0`;
  const isNegative = Number(value) < 0;
  const val = Math.abs(Number(value));
  const prefix = getCurrencyPrefix(currency);
  const sign = isNegative ? '-' : '';
  
  if (val >= 1000000000) {
    return `${sign}${prefix}${(val / 1000000000).toFixed(2)}B`;
  } else if (val >= 1000000) {
    return `${sign}${prefix}${(val / 1000000).toFixed(2)}M`;
  } else if (val >= 1000) {
    return `${sign}${prefix}${(val / 1000).toFixed(1)}K`;
  }
  return `${sign}${prefix}${val.toLocaleString()}`;
};

const formatCompactAxis = (val) => {
  if (val === null || val === undefined || isNaN(val)) return '0';
  const isNegative = Number(val) < 0;
  const v = Math.abs(Number(val));
  const sign = isNegative ? '-' : '';
  if (v >= 1000000000) return `${sign}${(v / 1000000000).toFixed(1)}B`;
  if (v >= 1000000) return `${sign}${Math.round(v / 1000000)}M`;
  if (v >= 1000) return `${sign}${Math.round(v / 1000)}K`;
  return `${sign}${Math.round(v)}`;
};

const formatFullNumber = (value) => {
  if (value === null || value === undefined || isNaN(value)) return '0';
  return Math.round(value).toLocaleString();
};

// Custom Glassmorphic Tooltip for Recharts
const CustomChartTooltip = ({ active, payload, label, isPercent = false, currency = 'PKR' }) => {
  if (active && payload && payload.length) {
    return (
      <div className={styles.customTooltip}>
        <div className={styles.tooltipLabel}>{label}</div>
        {payload.map((entry, index) => {
          const isCurrency = entry.name.includes('Revenue') || entry.name.includes('Costs') || entry.name.includes('Profit') || entry.name.includes('Salary');
          const isPct = entry.name.includes('%') || isPercent;
          const formattedVal = isPct 
            ? `${Number(entry.value).toFixed(1)}%`
            : isCurrency 
              ? formatCurrency(entry.value, currency)
              : formatFullNumber(entry.value);

          return (
            <div key={`item-${index}`} className={styles.tooltipRow}>
              <div className={styles.tooltipRowLeft}>
                <span className={styles.tooltipDot} style={{ backgroundColor: entry.color || entry.fill }} />
                <span>{entry.name}:</span>
              </div>
              <span className={styles.tooltipVal}>{formattedVal}</span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { user } = useContext(AppContext);
  const router = useRouter();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedYear, setSelectedYear] = useState('All');
  const [chartType, setChartType] = useState('bar'); // 'bar' | 'area'
  const [timeGranularity, setTimeGranularity] = useState('monthly'); // 'monthly' | 'quarterly'

  const yearScrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkYearScroll = () => {
    if (yearScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = yearScrollRef.current;
      setCanScrollLeft(scrollLeft > 4);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
    }
  };

  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  const handleMouseDown = (e) => {
    if (!yearScrollRef.current) return;
    isDraggingRef.current = true;
    startXRef.current = e.pageX - yearScrollRef.current.offsetLeft;
    scrollLeftRef.current = yearScrollRef.current.scrollLeft;
  };

  const handleMouseMove = (e) => {
    if (!isDraggingRef.current || !yearScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - yearScrollRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    yearScrollRef.current.scrollLeft = scrollLeftRef.current - walk;
    checkYearScroll();
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  const scrollYears = (direction) => {
    if (yearScrollRef.current) {
      const amount = direction === 'left' ? -180 : 180;
      yearScrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
      setTimeout(checkYearScroll, 320);
    }
  };

  useEffect(() => {
    checkYearScroll();
    window.addEventListener('resize', checkYearScroll);
    let resizeObserver;
    if (yearScrollRef.current && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        checkYearScroll();
      });
      resizeObserver.observe(yearScrollRef.current);
    }
    const timer = setTimeout(checkYearScroll, 120);
    return () => {
      window.removeEventListener('resize', checkYearScroll);
      if (resizeObserver) resizeObserver.disconnect();
      clearTimeout(timer);
    };
  }, [data, selectedYear]);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    fetchDashboardData(selectedYear);
  }, [user, router, selectedYear]);

  const fetchDashboardData = async (yr) => {
    setLoading(true);
    setError('');
    try {
      const query = yr !== 'All' ? `?year=${encodeURIComponent(yr)}` : '';
      let res = await authenticatedFetch(`/api/dashboard${query}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || body.message || 'Failed to fetch dashboard data');
      }
      const result = await res.json();
      setData(result);
    } catch (err) {
      console.error("Dashboard error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const { chartData = [], quarterlyData = [], overview = {}, years = [], mode = 'annual' } = data || {};

  // Active dataset for charts based on granularity (Monthly vs Quarterly in single FY mode)
  const activeDataset = (mode === 'monthly' && timeGranularity === 'quarterly' && quarterlyData.length > 0)
    ? quarterlyData
    : chartData;

  const isAllYears = selectedYear === 'All';

  const getAllYearsRange = () => {
    if (!years || years.length === 0) return 'ALL FY';
    const numbers = years.join(' ').match(/\b\d{4}\b/g);
    if (numbers && numbers.length >= 2) {
      const min = Math.min(...numbers.map(Number));
      const max = Math.max(...numbers.map(Number));
      return min === max ? `ALL FY ${min}` : `ALL FY ${min}-${max}`;
    }
    if (years.length === 1) return `ALL ${years[0]}`;
    return `ALL FY ${years[0]} - ${years[years.length - 1]}`;
  };

  const dynamicSubtitle = isAllYears ? getAllYearsRange() : selectedYear;

  // Compute dynamic CSS mask fade state for the pill rail
  let trackMaskClass = styles.maskNone;
  if (canScrollLeft && canScrollRight) {
    trackMaskClass = styles.maskBoth;
  } else if (canScrollRight) {
    trackMaskClass = styles.maskRightOnly;
  } else if (canScrollLeft) {
    trackMaskClass = styles.maskLeftOnly;
  }

  return (
    <Layout>
      <Head>
        <title>Financial Visuals & Insights - Finstant</title>
      </Head>

      <div className={styles.container}>
        {/* Top Header & Interactive Filter Bar */}
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>Financial Visuals</h1>
            <p className={styles.subtitle}>{dynamicSubtitle}</p>
          </div>

          {/* Interactive Filters and View Controls */}
          <div className={styles.controlsBar}>
            {/* Continuous Capsule Pill Rail with Smooth Gradient Dissolve & Arrows */}
            <div className={styles.capsuleRailContainer}>
              {/* Floating Left Arrow */}
              <button 
                type="button" 
                className={`${styles.capsuleArrow} ${styles.capsuleArrowLeft} ${canScrollLeft ? styles.capsuleArrowVisible : ''}`} 
                onClick={(e) => {
                  e.stopPropagation();
                  scrollYears('left');
                }}
                title="Scroll previous years"
                aria-label="Scroll previous years"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12"></line>
                  <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
              </button>

              {/* Scrollable Track with Edge Fade */}
              <div 
                className={`${styles.pillGroup} ${trackMaskClass}`} 
                ref={yearScrollRef} 
                onScroll={checkYearScroll}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
              >
                <button 
                  className={`${styles.pillBtn} ${selectedYear === 'All' ? styles.activePill : ''}`}
                  onClick={() => setSelectedYear('All')}
                >
                  All Years
                </button>
                {years.map(y => (
                  <button 
                    key={y} 
                    className={`${styles.pillBtn} ${selectedYear === y ? styles.activePill : ''}`}
                    onClick={() => setSelectedYear(y)}
                  >
                    {y}
                  </button>
                ))}
              </div>

              {/* Floating Right Arrow */}
              <button 
                type="button" 
                className={`${styles.capsuleArrow} ${styles.capsuleArrowRight} ${canScrollRight ? styles.capsuleArrowVisible : ''}`} 
                onClick={(e) => {
                  e.stopPropagation();
                  scrollYears('right');
                }}
                title="Scroll next years"
                aria-label="Scroll next years"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                  <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
              </button>
            </div>

            {/* View & Granularity Controls */}
            <div className={styles.controlsRight}>
              {/* In Single FY mode: Monthly vs Quarterly Toggle */}
              {!isAllYears && (
                <div className={styles.granularityPillGroup}>
                  <button 
                    className={`${styles.pillBtn} ${timeGranularity === 'monthly' ? styles.activePill : ''}`}
                    onClick={() => setTimeGranularity('monthly')}
                  >
                    Monthly (Jul-Jun)
                  </button>
                  <button 
                    className={`${styles.pillBtn} ${timeGranularity === 'quarterly' ? styles.activePill : ''}`}
                    onClick={() => setTimeGranularity('quarterly')}
                  >
                    Quarterly (Q1-Q4)
                  </button>
                </div>
              )}

              {/* Chart Type Toggle (Bar vs Area) */}
              <div className={styles.viewToggleGroup}>
                <button 
                  className={`${styles.viewToggleBtn} ${chartType === 'bar' ? styles.activeToggle : ''}`}
                  onClick={() => setChartType('bar')}
                  title="Bar Chart View"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"></line><line x1="18" y1="20" x2="18" y2="4"></line><line x1="6" y1="20" x2="6" y2="16"></line></svg>
                </button>
                <button 
                  className={`${styles.viewToggleBtn} ${chartType === 'area' ? styles.activeToggle : ''}`}
                  onClick={() => setChartType('area')}
                  title="Smooth Area / Line View"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sleek Skeleton Loading Scene */}
        {loading && !data && (
          <div className={styles.skeletonContainer}>
            <div className={styles.skeletonStatusBadge}>
              <div className={styles.spinner} style={{ width: 14, height: 14, borderWidth: 2 }} />
              <span>Aggregating Financial Insights...</span>
            </div>

            {/* Skeleton Metric Cards */}
            <div className={styles.metricsGrid}>
              {[1, 2, 3, 4].map(n => (
                <div key={n} className={`${styles.card} ${styles.skeletonCard}`}>
                  <div className={styles.skeletonPulse} style={{ width: '45%', height: 14 }} />
                  <div className={styles.skeletonPulse} style={{ width: '70%', height: 28, margin: '8px 0' }} />
                  <div className={styles.skeletonPulse} style={{ width: '35%', height: 12 }} />
                </div>
              ))}
            </div>

            {/* Skeleton Main Chart Card */}
            <div className={`${styles.chartCard} ${styles.skeletonChartCard}`}>
              <div>
                <div className={styles.skeletonPulse} style={{ width: '30%', height: 18, marginBottom: 8 }} />
                <div className={styles.skeletonPulse} style={{ width: '50%', height: 12 }} />
              </div>
              <div className={styles.skeletonChartBars}>
                {[35, 60, 48, 85, 42, 75, 55, 92, 65, 80, 50, 95].map((h, i) => (
                  <div 
                    key={i} 
                    className={styles.skeletonBarCol} 
                    style={{ height: `${h}%`, animationDelay: `${i * 90}ms` }} 
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '1rem 1.5rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Metric Overview Cards */}
        {data && (
          <>
            <div className={styles.metricsGrid}>
              <div className={styles.card} style={{ animationDelay: '0ms' }}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardLabel}>Total Revenue</span>
                  <div className={styles.cardIconBox}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                  </div>
                </div>
                <div className={styles.cardValue}>{formatCurrency(overview.total_revenue || 0, data?.currency)}</div>
                <div className={styles.cardFooter}>
                  <span className={styles.cardBadgePositive}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                    Ingested
                  </span>
                  <span>{isAllYears ? 'Cumulative Total' : `${selectedYear} Total`}</span>
                </div>
              </div>

              <div className={styles.card} style={{ animationDelay: '80ms' }}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardLabel}>Gross Profit</span>
                  <div className={styles.cardIconBox} style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                  </div>
                </div>
                <div className={styles.cardValue} style={{ color: '#10b981' }}>{formatCurrency(overview.gross_profit || 0, data?.currency)}</div>
                <div className={styles.cardFooter}>
                  <span style={{ fontWeight: 600 }}>
                    {overview.total_revenue > 0 ? `${((overview.gross_profit / overview.total_revenue) * 100).toFixed(1)}% GP Margin` : 'Healthy'}
                  </span>
                </div>
              </div>

              <div className={styles.card} style={{ animationDelay: '160ms' }}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardLabel}>Avg Headcount</span>
                  <div className={styles.cardIconBox}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                  </div>
                </div>
                <div className={styles.cardValue}>{formatFullNumber(overview.avg_headcount || 0)}</div>
                <div className={styles.cardFooter}>
                  <span>Active Team Members</span>
                </div>
              </div>

              <div className={styles.card} style={{ animationDelay: '240ms' }}>
                <div className={styles.cardHeader}>
                  <span className={styles.cardLabel}>Total Salary</span>
                  <div className={styles.cardIconBox} style={{ color: '#6366f1', background: 'rgba(99, 102, 241, 0.1)' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><line x1="6" y1="8" x2="6" y2="8"></line><line x1="10" y1="8" x2="18" y2="8"></line><line x1="6" y1="12" x2="6" y2="12"></line><line x1="10" y1="12" x2="18" y2="12"></line></svg>
                  </div>
                </div>
                <div className={styles.cardValue}>{formatCurrency(overview.total_salary || 0, data?.currency)}</div>
                <div className={styles.cardFooter}>
                  <span>Payroll Expense</span>
                </div>
              </div>
            </div>

            {/* Charts Grid */}
            <div className={styles.chartsGrid}>
              {/* Main Financial Performance Chart: Revenue vs Total Costs & Gross Profit */}
              <div className={styles.chartCard} style={{ animationDelay: '220ms' }}>
                <div className={styles.chartHeader}>
                  <div>
                    <h3 className={styles.chartTitle}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
                      {isAllYears ? 'Annual Revenue vs Total Costs & Gross Profit' : `${selectedYear} Monthly Revenue vs Costs & Profit`}
                    </h3>
                    <p className={styles.chartSubtitle}>
                      {isAllYears 
                        ? 'Year-over-year comparison across complete fiscal years' 
                        : 'July to June monthly financial trajectory with clean scaling'}
                    </p>
                  </div>
                </div>

                <div className={styles.chartWrapper}>
                  <ResponsiveContainer width="100%" height={320}>
                    {chartType === 'bar' ? (
                      <BarChart data={activeDataset} margin={{ top: 15, right: 15, left: 10, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} opacity={0.6} />
                        <XAxis dataKey="label" stroke="var(--color-text-muted)" tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} dy={6} />
                        <YAxis width={46} tickFormatter={formatCompactAxis} stroke="var(--color-text-muted)" tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                        <Tooltip content={<CustomChartTooltip currency={data?.currency} />} />
                        <Legend wrapperStyle={{ paddingTop: '12px' }} />
                        <Bar isAnimationActive={true} animationDuration={1000} animationEasing="ease-out" dataKey="revenue" name="Revenue" fill="#22B8CF" radius={[5, 5, 0, 0]} maxBarSize={38} />
                        <Bar isAnimationActive={true} animationDuration={1000} animationEasing="ease-out" animationBegin={120} dataKey="costs" name="Total Costs" fill="#6366F1" radius={[5, 5, 0, 0]} maxBarSize={38} />
                        <Bar isAnimationActive={true} animationDuration={1000} animationEasing="ease-out" animationBegin={240} dataKey="profit" name="Gross Profit" fill="#10B981" radius={[5, 5, 0, 0]} maxBarSize={38} />
                      </BarChart>
                    ) : (
                      <AreaChart data={activeDataset} margin={{ top: 15, right: 15, left: 10, bottom: 8 }}>
                        <defs>
                          <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22B8CF" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#22B8CF" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorProf" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} opacity={0.6} />
                        <XAxis dataKey="label" stroke="var(--color-text-muted)" tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} dy={6} />
                        <YAxis width={46} tickFormatter={formatCompactAxis} stroke="var(--color-text-muted)" tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                        <Tooltip content={<CustomChartTooltip currency={data?.currency} />} />
                        <Legend wrapperStyle={{ paddingTop: '12px' }} />
                        <Area isAnimationActive={true} animationDuration={1100} animationEasing="ease-out" type="monotone" dataKey="revenue" name="Revenue" stroke="#22B8CF" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                        <Area isAnimationActive={true} animationDuration={1100} animationEasing="ease-out" animationBegin={150} type="monotone" dataKey="costs" name="Total Costs" stroke="#6366F1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorCost)" />
                        <Area isAnimationActive={true} animationDuration={1100} animationEasing="ease-out" animationBegin={300} type="monotone" dataKey="profit" name="Gross Profit" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorProf)" />
                      </AreaChart>
                    )}
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Dual Column Bottom Charts */}
              <div className={styles.chartsGridDual}>
                {/* Profit Margin % Trend */}
                <div className={styles.chartCard} style={{ animationDelay: '300ms' }}>
                  <div className={styles.chartHeader}>
                    <div>
                      <h3 className={styles.chartTitle}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="m4.93 4.93 4.24 4.24"></path><path d="m14.83 9.17 4.24-4.24"></path><path d="m14.83 14.83 4.24 4.24"></path><path d="m9.17 14.83-4.24 4.24"></path></svg>
                        Gross Profit Margin (%)
                      </h3>
                      <p className={styles.chartSubtitle}>
                        {isAllYears ? 'Annual Gross Profit Margin efficiency' : 'Month-over-month margin stability'}
                      </p>
                    </div>
                  </div>

                  <div className={styles.chartWrapper}>
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={activeDataset} margin={{ top: 15, right: 15, left: 10, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} opacity={0.6} />
                        <XAxis dataKey="label" stroke="var(--color-text-muted)" tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} dy={6} />
                        <YAxis width={42} unit="%" domain={[0, 'auto']} tickFormatter={(v) => `${Math.round(v)}`} stroke="var(--color-text-muted)" tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                        <Tooltip content={<CustomChartTooltip isPercent={true} currency={data?.currency} />} />
                        <Legend wrapperStyle={{ paddingTop: '10px' }} />
                        <Line isAnimationActive={true} animationDuration={1200} animationEasing="ease-out" type="monotone" dataKey="gpPercent" name="GP Margin (%)" stroke="#10B981" strokeWidth={3} dot={{ r: 4, fill: '#10B981', strokeWidth: 2, stroke: '#FFFFFF' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Workforce & Total Salary Dynamics */}
                <div className={styles.chartCard} style={{ animationDelay: '360ms' }}>
                  <div className={styles.chartHeader}>
                    <div>
                      <h3 className={styles.chartTitle}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" y1="8" x2="19" y2="14"></line><line x1="22" y1="11" x2="16" y2="11"></line></svg>
                        Headcount vs Total Salary
                      </h3>
                      <p className={styles.chartSubtitle}>Workforce scale vs total payroll allocation</p>
                    </div>
                  </div>

                  <div className={styles.chartWrapper}>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={activeDataset} margin={{ top: 15, right: 10, left: 10, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} opacity={0.6} />
                        <XAxis dataKey="label" stroke="var(--color-text-muted)" tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} dy={6} />
                        <YAxis yAxisId="left" width={40} stroke="var(--color-text-muted)" tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                        <YAxis yAxisId="right" width={46} orientation="right" tickFormatter={formatCompactAxis} stroke="var(--color-text-muted)" tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                        <Tooltip content={<CustomChartTooltip currency={data?.currency} />} />
                        <Legend wrapperStyle={{ paddingTop: '10px' }} />
                        <Bar isAnimationActive={true} animationDuration={1000} animationEasing="ease-out" yAxisId="left" dataKey="headcount" name="Headcount" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={28} />
                        <Bar isAnimationActive={true} animationDuration={1000} animationEasing="ease-out" animationBegin={150} yAxisId="right" dataKey="salary" name="Total Salary" fill="#3B82F6" radius={[4, 4, 0, 0]} maxBarSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
