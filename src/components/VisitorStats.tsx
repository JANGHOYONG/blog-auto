'use client';
import { useEffect, useState } from 'react';

interface Stats {
  todayViews: number;
  totalViews: number;
  todayUnique: number;
  totalUnique: number;
}

export default function VisitorStats({ compact = false }: { compact?: boolean }) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const key = `visited_${new Date().toISOString().slice(0, 10)}`;
    const isNew = !sessionStorage.getItem(key);

    fetch('/api/visitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isUnique: isNew }),
    }).then(() => {
      if (isNew) sessionStorage.setItem(key, '1');
    });

    fetch('/api/visitors').then((r) => r.json()).then(setStats);
  }, []);

  if (!stats) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>오늘 <strong style={{ color: 'var(--text)' }}>{stats.todayUnique.toLocaleString()}</strong>명</span>
        <span>누적 <strong style={{ color: 'var(--text)' }}>{stats.totalUnique.toLocaleString()}</strong>명</span>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-muted)' }}>방문자 통계</p>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: '오늘 방문', value: stats.todayUnique, icon: '👤' },
          { label: '오늘 조회', value: stats.todayViews, icon: '👁️' },
          { label: '누적 방문', value: stats.totalUnique, icon: '📊' },
          { label: '누적 조회', value: stats.totalViews, icon: '📈' },
        ].map(({ label, value, icon }) => (
          <div key={label} className="text-center py-2">
            <div className="text-lg">{icon}</div>
            <div className="text-lg font-bold" style={{ color: 'var(--text)' }}>{value.toLocaleString()}</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
