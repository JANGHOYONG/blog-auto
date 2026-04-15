import AdFit from './AdFit';

type Slot = 'top' | 'middle' | 'bottom' | 'sidebar';

// ─── 카카오 AdFit 광고 단위 ────────────────────────────────────────────────────
// 모바일 배너 (320×50) — 상단·하단
const UNIT_BANNER = { id: 'DAN-gGACvVerrv2TwXYJ', width: 320, height: 50 };
// PC·모바일 겸용 직사각형 (300×250) — 본문 중간·사이드바 (클릭률 최고)
const UNIT_RECT   = { id: 'DAN-d0PQygd7Wr3dydYQ', width: 300, height: 250 };

const SLOT_CONFIG: Record<Slot, typeof UNIT_BANNER> = {
  top:     UNIT_BANNER,
  middle:  UNIT_RECT,
  bottom:  UNIT_BANNER,
  sidebar: UNIT_RECT,
};

interface Props {
  slot: Slot;
  className?: string;
}

export default function AdFitSlot({ slot, className }: Props) {
  const { id, width, height } = SLOT_CONFIG[slot];
  return <AdFit unit={id} width={width} height={height} className={className} />;
}
