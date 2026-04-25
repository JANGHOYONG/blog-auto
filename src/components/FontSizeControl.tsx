'use client';
import { useEffect, useState } from 'react';

const SIZES = [
  { label: '가', value: 0.9, title: '작게' },
  { label: '가', value: 1,   title: '보통' },
  { label: '가', value: 1.15, title: '크게' },
];

export default function FontSizeControl() {
  const [size, setSize] = useState(1.15);

  useEffect(() => {
    const saved = parseFloat(localStorage.getItem('fontScale') || '1.15');
    setSize(saved);
    document.documentElement.style.setProperty('--font-scale', String(saved));
  }, []);

  const apply = (val: number) => {
    setSize(val);
    document.documentElement.style.setProperty('--font-scale', String(val));
    localStorage.setItem('fontScale', String(val));
  };

  const fontSizes = ['0.8rem', '1rem', '1.2rem'];

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>글자</span>
      {SIZES.map(({ label, value, title }, i) => (
        <button
          key={value}
          onClick={() => apply(value)}
          title={title}
          className="flex items-center justify-center w-8 h-8 rounded-lg font-bold transition-all"
          style={{
            fontSize: fontSizes[i],
            background: size === value ? 'var(--primary)' : 'var(--bg-bar)',
            color: size === value ? 'white' : 'var(--text)',
            border: size === value ? '2px solid var(--primary-dark)' : '2px solid transparent',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
