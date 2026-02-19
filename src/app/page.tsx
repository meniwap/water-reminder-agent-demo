'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

// ─── Types ───────────────────────────────────────────────────────────────────
interface WaterLog {
  id: string;
  created_at: string;
  amount_ml: number;
}

// ─── Animated SVG Ring ───────────────────────────────────────────────────────
function AnimatedRing({ percentage }: { percentage: number }) {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percentage, 100) / 100) * circumference;
  const celebrate = percentage >= 100;

  return (
    <svg className="ring-svg" viewBox="0 0 196 196">
      <defs>
        <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
        <linearGradient id="celebrateGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#34d399" />
        </linearGradient>
      </defs>
      <circle className="ring-track" cx="98" cy="98" r={radius} />
      <circle
        className={`ring-progress${celebrate ? ' celebrate' : ''}`}
        cx="98"
        cy="98"
        r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function useToast() {
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((message: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMsg(message);
    setShow(true);
    timerRef.current = setTimeout(() => setShow(false), 2500);
  }, []);

  return { msg, show, toast };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function WaterDashboard() {
  const [logs, setLogs] = useState<WaterLog[]>([]);
  const [goal, setGoal] = useState(2000);
  const [loading, setLoading] = useState(true);
  const [customAmount, setCustomAmount] = useState('');
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const { msg: toastMsg, show: toastShow, toast } = useToast();

  useEffect(() => {
    fetchData();
    // Load goal from localStorage
    const saved = localStorage.getItem('aquatrack_goal');
    if (saved) setGoal(Number(saved));
  }, []);

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

  // ─── Add Water ─────────────────────────────────────────────────────────────
  const addWater = async (amount: number) => {
    if (amount <= 0 || isNaN(amount)) return;
    const tempId = `temp-${Date.now()}`;
    const optimistic: WaterLog = { id: tempId, amount_ml: amount, created_at: new Date().toISOString() };
    setLogs(prev => [optimistic, ...prev]);

    try {
      const { data, error } = await supabase
        .from('water_logs')
        .insert([{ amount_ml: amount }])
        .select()
        .single();

      if (error) throw error;
      // Replace temp with real row
      setLogs(prev => prev.map(l => l.id === tempId ? data : l));
      toast(`+${amount}ml added 💧`);
    } catch {
      setLogs(prev => prev.filter(l => l.id !== tempId));
      toast('Error saving log');
    }
  };

  // ─── Remove Single Log ──────────────────────────────────────────────────────
  const removeLog = async (id: string) => {
    const removed = logs.find(l => l.id === id);
    setLogs(prev => prev.filter(l => l.id !== id));

    try {
      const { error } = await supabase.from('water_logs').delete().eq('id', id);
      if (error) throw error;
      toast(`Removed ${removed?.amount_ml}ml ↩️`);
    } catch {
      if (removed) setLogs(prev => [removed, ...prev]);
      toast('Error removing log');
    }
  };

  // ─── Reset Day ─────────────────────────────────────────────────────────────
  const resetDay = async () => {
    setShowResetModal(false);
    const backup = [...logs];
    setLogs([]);

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { error } = await supabase
        .from('water_logs')
        .delete()
        .gte('created_at', today.toISOString());
      if (error) throw error;
      toast('Day reset! Fresh start 🌊');
    } catch {
      setLogs(backup);
      toast('Error resetting day');
    }
  };

  // ─── Update Goal ────────────────────────────────────────────────────────────
  const saveGoal = () => {
    const val = parseInt(goalInput);
    if (!isNaN(val) && val > 0) {
      setGoal(val);
      localStorage.setItem('aquatrack_goal', String(val));
      toast(`Daily goal set to ${val}ml 🎯`);
    }
    setEditingGoal(false);
  };

  // ─── Computed ───────────────────────────────────────────────────────────────
  const total = logs.reduce((s, l) => s + l.amount_ml, 0);
  const percentage = Math.round((total / goal) * 100);

  return (
    <>
      <main>
        <div className="glass">
          {/* Header */}
          <div className="header">
            <h1 className="title">AquaTrack</h1>
            <p className="subtitle">Stay hydrated, stay healthy 💧</p>
          </div>

          {/* Animated Ring */}
          <div className="ring-container">
            <div className="ring-wrapper">
              <AnimatedRing percentage={percentage} />
              <div className="ring-inner">
                <span className="ring-value">{total}</span>
                <span className="ring-unit">ml today</span>
              </div>
            </div>
            <span className="ring-percent">
              {percentage}% of {goal}ml goal {percentage >= 100 ? '🎉' : ''}
            </span>

            {/* Goal Editor */}
            {editingGoal ? (
              <div className="goal-editor">
                <input
                  className="custom-input"
                  style={{ maxWidth: '140px' }}
                  type="number"
                  autoFocus
                  placeholder={String(goal)}
                  value={goalInput}
                  onChange={e => setGoalInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveGoal(); if (e.key === 'Escape') setEditingGoal(false); }}
                />
                <button className="btn btn-primary" style={{ padding: '0.6rem 1rem', flex: 'none' }} onClick={saveGoal}>Save</button>
                <button className="btn btn-secondary" style={{ padding: '0.6rem 0.8rem', flex: 'none' }} onClick={() => setEditingGoal(false)}>✕</button>
              </div>
            ) : (
              <button className="goal-btn" onClick={() => { setGoalInput(String(goal)); setEditingGoal(true); }}>
                ✏️ Edit goal
              </button>
            )}
          </div>

          {/* Quick Add Buttons */}
          <div className="quick-add">
            <button className="btn btn-primary" onClick={() => addWater(150)}>+ 150ml</button>
            <button className="btn btn-primary" onClick={() => addWater(250)}>+ 250ml</button>
            <button className="btn btn-primary" onClick={() => addWater(350)}>+ 350ml</button>
            <button className="btn btn-primary" onClick={() => addWater(500)}>+ 500ml</button>
          </div>

          {/* Custom Amount */}
          <div className="custom-add">
            <input
              className="custom-input"
              type="number"
              placeholder="Custom amount (ml)..."
              value={customAmount}
              onChange={e => setCustomAmount(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && customAmount) {
                  addWater(parseInt(customAmount));
                  setCustomAmount('');
                }
              }}
            />
            <button
              className="btn btn-secondary"
              style={{ flex: 'none', padding: '0.75rem 1.2rem' }}
              onClick={() => {
                if (customAmount) { addWater(parseInt(customAmount)); setCustomAmount(''); }
              }}
            >
              Add ✓
            </button>
          </div>

          {/* Log List */}
          <div className="section-header">
            <span className="section-title">Today&apos;s Activity</span>
            {logs.length > 0 && (
              <button className="btn btn-danger" style={{ padding: '0.4rem 0.9rem', fontSize: '0.8rem' }} onClick={() => setShowResetModal(true)}>
                🗑 Reset Day
              </button>
            )}
          </div>

          <div className="log-list">
            {loading && logs.length === 0 ? (
              <p className="empty-state">Loading logs...</p>
            ) : logs.length === 0 ? (
              <p className="empty-state">No logs yet today.<br />Start drinking! 💪</p>
            ) : (
              logs.map(log => (
                <div key={log.id} className="log-item">
                  <div className="log-left">
                    <div className="log-dot" />
                    <span className="log-amount">+{log.amount_ml}ml</span>
                  </div>
                  <div className="log-right">
                    <span className="log-time">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button className="btn-icon" onClick={() => removeLog(log.id)} title="Remove this entry">
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <p className="footer">Built by AI Agent • Powered by Supabase &amp; Vercel</p>
      </main>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="modal-overlay" onClick={() => setShowResetModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>🗑 Reset Today?</h2>
            <p>This will delete all {logs.length} log{logs.length !== 1 ? 's' : ''} from today. This can&apos;t be undone.</p>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowResetModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={resetDay}>Yes, Reset</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      <div className={`toast${toastShow ? ' show' : ''}`}>{toastMsg}</div>
    </>
  );
}
