'use client';
import { useEffect, useState } from 'react';

interface Heading { id: string; text: string; }
interface Props { headings: Heading[]; }

export default function TOC({ headings }: Props) {
  const [active, setActive] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!headings.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) { setActive(entry.target.id); break; }
        }
      },
      { rootMargin: '0px 0px -60% 0px', threshold: 0 }
    );
    headings.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [headings]);

  if (!headings.length) return null;

  const linkList = headings.map(({ id, text }) => (
    <li key={id}>
      <a
        href={`#${id}`}
        className="block leading-snug transition-colors py-2.5 px-2 rounded-lg"
        style={{
          color: active === id ? 'var(--primary)' : 'var(--text-muted)',
          fontWeight: active === id ? 600 : 400,
        }}
        onClick={(e) => {
          e.preventDefault();
          document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
          setMobileOpen(false);
        }}
      >
        {text}
      </a>
    </li>
  ));

  return (
    <>
      {/* 데스크탑 사이드바 목차 */}
      <nav className="card p-4 text-sm hidden lg:block">
        <p className="font-bold mb-3" style={{ color: 'var(--text)' }}>목차</p>
        <ol className="space-y-2">{linkList}</ol>
      </nav>

      {/* 모바일 플로팅 목차 버튼 */}
      <button
        className="fixed bottom-20 right-6 z-50 lg:hidden w-12 h-12 rounded-full shadow-lg flex items-center justify-center text-white text-xs font-bold transition-all hover:scale-110"
        style={{ background: 'var(--primary-dark)' }}
        onClick={() => setMobileOpen(true)}
        aria-label="목차 열기"
      >
        목차
      </button>

      {/* 모바일 슬라이드업 드로어 */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute bottom-0 left-0 right-0 rounded-t-2xl p-6 max-h-[70vh] overflow-y-auto"
            style={{ background: 'var(--bg-card)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold text-base" style={{ color: 'var(--text)' }}>목차</p>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-lg leading-none"
                style={{ color: 'var(--text-muted)' }}
                aria-label="목차 닫기"
              >
                ✕
              </button>
            </div>
            <ol className="space-y-3 text-sm">{linkList}</ol>
          </div>
        </div>
      )}
    </>
  );
}
