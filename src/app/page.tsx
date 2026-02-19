'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function WaterDashboard() {
  const [total, setTotal] = useState(0);
  const [goal, setGoal] = useState(2000);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      // Fetch logs from Supabase
      const { data, error } = await supabase
        .from('water_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching logs:', error);
      } else if (data) {
        setLogs(data);
        const sum = data.reduce((acc, log) => acc + log.amount_ml, 0);
        setTotal(sum);
      }

      // Fetch profile/goal
      const { data: profile } = await supabase
        .from('profiles')
        .select('daily_goal_ml')
        .single();

      if (profile) {
        setGoal(profile.daily_goal_ml);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  }

  const addWater = async (amount: number) => {
    // Optimistic update
    const newLog = {
      amount_ml: amount,
      created_at: new Date().toISOString()
    };

    setLogs([newLog, ...logs]);
    setTotal(prev => prev + amount);

    try {
      const { error } = await supabase
        .from('water_logs')
        .insert([{ amount_ml: amount }]);

      if (error) throw error;
    } catch (err) {
      console.error('Error saving log:', err);
      // Revert if error? For now just log it
    }
  };

  const percentage = Math.min(Math.round((total / goal) * 100), 100);

  return (
    <main>
      <div className="glass">
        <h1 className="title">AquaTrack</h1>
        <p className="subtitle">Stay hydrated, stay healthy</p>

        <div className="counter-container">
          <div className="progress-circle">
            <span className="progress-value">{total}</span>
            <span className="progress-label">ml / {goal}ml</span>
          </div>
          <p style={{ fontWeight: 600, color: '#38bdf8', fontSize: '1.2rem' }}>
            {percentage}% of daily goal
          </p>
        </div>

        <div className="button-group">
          <button className="btn btn-primary" onClick={() => addWater(250)}>
            + 250ml
          </button>
          <button className="btn btn-secondary" onClick={() => addWater(500)}>
            + 500ml
          </button>
        </div>

        <div className="history-card">
          <h3 style={{ marginBottom: '1.5rem', fontSize: '1.2rem' }}>Recent Activity</h3>
          {loading && logs.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading logs...</p>
          ) : logs.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>No logs yet today. Drink up!</p>
          ) : (
            <div style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {logs.map((log, i) => (
                <div key={i} className="history-item">
                  <span style={{ fontWeight: 600 }}>{log.amount_ml}ml</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        Built by AI Agent • Powered by Supabase & Vercel
      </p>
    </main>
  );
}
