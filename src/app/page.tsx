'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

// ─── Types ──────────────────────────────────────────────────────────────────
interface WaterLog {
  id: string;
  created_at: string;
  amount_ml: number;
}

// ─── Floating Particles ──────────────────────────────────────────────────────
function Particles() {
  const count = 18;
  const items = Array.from({ length: count }, (_, i) => ({
    id: i,
    size: Math.random() * 6 + 4,
    left: Math.random() * 100,
    delay: Math.random() * 12,
    duration: Math.random() * 10 + 12,
    color: ['rgba(6,182,212,0.45)', 'rgba(99,102,241,0.45)', 'rgba(236,72,153,0.35)'][Math.floor(Math.random() * 3)],
  }));
  return (
    <div className="particles">
      {items.map(p => (
        <div
          key={p.id}
          className="particle"
          style={{
            width: p.size, height: p.size,
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Confetti ────────────────────────────────────────────────────────────────
function Confetti({ active }: { active: boolean }) {
  if (!active) return null;
  const pieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 1.5,
    duration: Math.random() * 2 + 2,
    color: ['#38bdf8', '#818cf8', '#f43f5e', '#fbbf24', '#10b981', '#ec4899'][Math.floor(Math.random() * 6)],
    size: Math.random() * 8 + 6,
    shape: Math.random() > 0.5 ? '50%' : '2px',
  }));
  return (
    <div className="confetti-overlay">
      {pieces.map(p => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            width: p.size, height: p.size,
            background: p.color,
            borderRadius: p.shape,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Animated SVG Ring ────────────────────────────────────────────────────────
function AnimatedRing({ percentage }: { percentage: number }) {
  const radius = 85;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;
  const celebrate = percentage >= 100;

  return (
    <svg className="ring-svg" viewBox="0 0 210 210">
      <defs>
        <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="55%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
        <linearGradient id="celebrateGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>
      <circle className="ring-track" cx="105" cy="105" r={radius} />
      <circle
        className={`ring-progress${celebrate ? ' celebrate' : ''}`}
        cx="105" cy="105" r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

// ─── Toast hook ───────────────────────────────────────────────────────────────
function useToast() {
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((message: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMsg(message);
    setShow(true);
    timerRef.current = setTimeout(() => setShow(false), 2800);
  }, []);

  return { msg, show, toast };
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function WaterDashboard() {
  const [logs, setLogs] = useState<WaterLog[]>([]);
  const [goal, setGoal] = useState(2000);
  const [loading, setLoading] = useState(true);
  const [customAmount, setCustomAmount] = useState('');
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const { msg: toastMsg, show: toastShow, toast } = useToast();
  const prevMet = useRef(false);

  useEffect(() => {
    fetchData();
    const saved = localStorage.getItem('aquatrack_goal');
    if (saved) setGoal(Number(saved));
  }, []);

  // Trigger confetti when crossing 100%
  const total = logs.reduce((s, l) => s + l.amount_ml, 0);
  const percentage = Math.round((total / goal) * 100);
  useEffect(() => {
    if (percentage >= 100 && !prevMet.current) {
      prevMet.current = true;
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4000);
      toast('🎉 כל הכבוד! הגעת ליעד היומי שלך!');
    }
    if (percentage < 100) prevMet.current = false;
  }, [percentage, toast]);

  async function fetchData() {
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from('water_logs')
        .select('id, created_at, amount_ml')
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false });
      if (!error && data) setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const addWater = async (amount: number) => {
    if (amount <= 0 || isNaN(amount)) return;
    const tempId = `temp-${Date.now()}`;
    const optimistic: WaterLog = { id: tempId, amount_ml: amount, created_at: new Date().toISOString() };
    setLogs(prev => [optimistic, ...prev]);
    try {
      const { data, error } = await supabase
        .from('water_logs').insert([{ amount_ml: amount }]).select().single();
      if (error) throw error;
      setLogs(prev => prev.map(l => l.id === tempId ? data : l));
      toast(`💧 הוספת ${amount} מ"ל`);
    } catch {
      setLogs(prev => prev.filter(l => l.id !== tempId));
      toast('שגיאה בשמירה');
    }
  };

  const removeLog = async (id: string) => {
    const removed = logs.find(l => l.id === id);
    setLogs(prev => prev.filter(l => l.id !== id));
    try {
      const { error } = await supabase.from('water_logs').delete().eq('id', id);
      if (error) throw error;
      toast(`↩️ הסרת ${removed?.amount_ml} מ"ל`);
    } catch {
      if (removed) setLogs(prev => [removed, ...prev]);
      toast('שגיאה בהסרה');
    }
  };

  const resetDay = async () => {
    setShowResetModal(false);
    const backup = [...logs];
    setLogs([]);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { error } = await supabase.from('water_logs').delete().gte('created_at', today.toISOString());
      if (error) throw error;
      toast('🌊 התחלה מחדש! בהצלחה!');
    } catch {
      setLogs(backup);
      toast('שגיאה באיפוס');
    }
  };

  const saveGoal = () => {
    const val = parseInt(goalInput);
    if (!isNaN(val) && val > 0) {
      setGoal(val);
      localStorage.setItem('aquatrack_goal', String(val));
      toast(`🎯 יעד חדש: ${val} מ"ל`);
    }
    setEditingGoal(false);
  };

  const motivation = percentage >= 100
    ? '🎉 יעד הושג! אתה מדהים!'
    : percentage >= 75
      ? '💪 כמעט שם! המשך כך!'
      : percentage >= 50
        ? '🌊 חצי הדרך! כל הכבוד'
        : percentage >= 25
          ? '⚡ התחלה טובה, המשך!'
          : '💧 שתה מים, תרגיש טוב!';

  return (
    <>
      <Particles />
      <Confetti active={showConfetti} />

      <div className="page-wrap">
        <main>
          <div className="glass">
            {/* Header */}
            <div className="header">
              <div className="logo-wrap">💧</div>
              <h1 className="title">AquaTrack</h1>
              <p className="subtitle">ממשק מעקב שתייה יימי חכם</p>
            </div>

            {/* Streak badge */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div className="streak-badge">🔥 {logs.length} שתיות היום</div>
            </div>

            {/* Ring */}
            <div className="ring-container">
              <div className={`ring-wrapper${percentage >= 100 ? ' goal-met' : ''}`}>
                <AnimatedRing percentage={percentage} />
                <div className="ring-inner">
                  <span className="ring-value">{total}</span>
                  <span className="ring-unit">מ"ל היום</span>
                </div>
              </div>
              <span className="ring-percent">
                {percentage}% מהיעד היומי {percentage >= 100 ? '🎉' : ''}
              </span>
              <p style={{ fontSize: '0.85rem', color: 'rgba(125,211,252,0.7)', textAlign: 'center', fontWeight: 600 }}>
                {motivation}
              </p>

              {/* Progress bar */}
              <div className="progress-bar-wrap" style={{ width: '100%' }}>
                <div className="progress-bar-fill" style={{ width: `${Math.min(percentage, 100)}%` }} />
              </div>

              {/* Goal editing */}
              {editingGoal ? (
                <div className="goal-editor">
                  <button className="btn btn-secondary" style={{ padding: '0.6rem 0.8rem', flex: 'none' }} onClick={() => setEditingGoal(false)}>✕</button>
                  <button className="btn btn-primary" style={{ padding: '0.6rem 1rem', flex: 'none' }} onClick={saveGoal}>שמור</button>
                  <input
                    className="custom-input"
                    style={{ maxWidth: '130px' }}
                    type="number"
                    autoFocus
                    placeholder={String(goal)}
                    value={goalInput}
                    onChange={e => setGoalInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveGoal(); if (e.key === 'Escape') setEditingGoal(false); }}
                  />
                </div>
              ) : (
                <button className="goal-btn" onClick={() => { setGoalInput(String(goal)); setEditingGoal(true); }}>
                  ✏️ יעד: {goal} מ"ל — לחץ לשינוי
                </button>
              )}
            </div>

            {/* Quick Add */}
            <div className="quick-add">
              <button className="btn btn-primary" onClick={() => addWater(150)}>+ 150 מ"ל</button>
              <button className="btn btn-primary" onClick={() => addWater(250)}>+ 250 מ"ל</button>
              <button className="btn btn-primary" onClick={() => addWater(350)}>+ 350 מ"ל</button>
              <button className="btn btn-primary" onClick={() => addWater(500)}>+ 500 מ"ל</button>
            </div>

            {/* Custom Amount */}
            <div className="custom-add">
              <button
                className="btn btn-secondary"
                style={{ flex: 'none', padding: '0.8rem 1.2rem' }}
                onClick={() => {
                  if (customAmount) { addWater(parseInt(customAmount)); setCustomAmount(''); }
                }}
              >
                הוסף ✓
              </button>
              <input
                className="custom-input"
                type="number"
                placeholder='כמות מותאמת (מ"ל)...'
                value={customAmount}
                onChange={e => setCustomAmount(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && customAmount) {
                    addWater(parseInt(customAmount));
                    setCustomAmount('');
                  }
                }}
              />
            </div>

            {/* Log list */}
            <div className="section-header">
              <span className="section-title">פעילות היום</span>
              {logs.length > 0 && (
                <button className="btn btn-danger" onClick={() => setShowResetModal(true)}>
                  🗑 איפוס יום
                </button>
              )}
            </div>

            <div className="log-list">
              {loading && logs.length === 0 ? (
                <p className="empty-state">טוען נתונים...</p>
              ) : logs.length === 0 ? (
                <p className="empty-state">
                  עדיין לא שתית היום 😅<br />
                  לחץ על אחד הכפתורים ותתחיל!
                </p>
              ) : (
                logs.map(log => (
                  <div key={log.id} className="log-item">
                    <div className="log-left">
                      <div className="log-dot" />
                      <span className="log-amount">+{log.amount_ml} מ"ל</span>
                    </div>
                    <div className="log-right">
                      <span className="log-time">
                        {new Date(log.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <button className="btn-icon" onClick={() => removeLog(log.id)} title="הסר">✕</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <p className="footer">נבנה על ידי סוכן AI • Supabase &amp; Vercel</p>
        </main>
      </div>

      {/* Reset Modal */}
      {showResetModal && (
        <div className="modal-overlay" onClick={() => setShowResetModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>🗑 לאפס את היום?</h2>
            <p>
              פעולה זו תמחק את כל {logs.length} הרשומות מהיום.
              <br />לא ניתן לשחזר את הנתונים.
            </p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowResetModal(false)}>ביטול</button>
              <button className="btn btn-danger" onClick={resetDay}>כן, אפס</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      <div className={`toast${toastShow ? ' show' : ''}`}>{toastMsg}</div>
    </>
  );
}
