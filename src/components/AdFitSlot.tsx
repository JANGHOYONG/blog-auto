import AdFit from './AdFit';

type Slot = 'top' | 'middle' | 'bottom' | 'sidebar';

// 카카오 AdFit 단일 유닛 ID (320×50) — adfit.kakao.com 에서 발급
// 모든 슬롯 동일 유닛 사용 (추가 유닛 발급 시 슬롯별 분리 가능)
const ADFIT_UNIT = 'DAN-gGACvVerrv2TwXYJ';
const AD_WIDTH  = 320;
const AD_HEIGHT = 50;

interface Props {
  slot: Slot;
  className?: string;
}

export default function AdFitSlot({ slot, className }: Props) {
  return <AdFit unit={ADFIT_UNIT} width={AD_WIDTH} height={AD_HEIGHT} className={className} />;
}
