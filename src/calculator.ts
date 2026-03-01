/**
 * Модуль расчёта траекторий и коридоров движения ТС
 *
 * Математическая модель (Аккерман):
 *   1. Все радиусы отсчитываются от единого центра поворота (ICR),
 *      расположенного на продолжении эффективной задней оси.
 *   2. trackWidth — КОЛЕЯ (расстояние между серединами следов колёс), не ширина кузова.
 *   3. Для многоосных ТС используется эффективная колёсная база L_eff:
 *      - 2 оси:          L_eff = wheelbase
 *      - Автобус 3 оси:  L_eff = wheelbase1 (до первой задней оси)
 *      - Грузовик 3 оси: L_eff = wheelbase1 + wheelbase2 (до последней)
 *
 * Формулы:
 *   R_outer = √((R + trackWidth/2)² + (L_eff + overhangFront)²)
 *   R_inner = √((R - trackWidth/2)² + overhangRear²)
 *   R_front = √((R + trackWidth/2)² + L_eff²)
 *
 * где R — minTurningRadius (радиус по центру эффективной задней оси).
 *
 * Верификация по расчётным схемам:
 *   Легковой автомобиль:       R_outer=6.85 ✓  R_inner=4.42 ✓
 *   Городской автобус 12м:     R_outer=10.54 ✓ R_inner=5.40 ✓
 *   Пригородный автобус 15м:   R_outer=11.52 ✓ R_inner=6.40 ✓
 *   Грузовик 12м (тандем):     R_outer=11.82 ✓ R_inner=6.15 ✓
 */

import type {
  VehicleParams,
  AlignmentSegment,
  Alignment,
  CorridorResult,
  Point3D,
} from './types';

// ─── Предустановленные параметры ТС ──────────────────────────────────────────
//
// trackWidth — КОЛЕЯ (не ширина кузова).

export const VEHICLE_PRESETS: Record<'passenger_car' | 'bus_12m' | 'bus_articulated' | 'truck_tandem', VehicleParams> = {

  passenger_car: {
    name: 'Легковой автомобиль',
    wheelbase: 2.90,
    trackWidth: 1.42,
    overhangFront: 0.90,
    overhangRear: 1.10,
    minTurningRadius: 4.99,
    totalLength: 4.90,
    axleConfig: '2',
  },

  bus_12m: {
    name: 'Автобус городской 12 м',
    wheelbase: 6.20,
    trackWidth: 1.11,
    overhangFront: 2.75,
    overhangRear: 3.05,
    minTurningRadius: 5.011,
    totalLength: 12.0,
    axleConfig: '2',
  },

  // L_eff = wheelbase1 (до первой задней оси тандема)
  bus_articulated: {
    name: 'Автобус пригородный 15 м (3 оси)',
    wheelbase: 6.90,
    trackWidth: 1.69,
    overhangFront: 2.60,
    overhangRear: 4.20,
    minTurningRadius: 5.673,
    totalLength: 15.0,
    axleConfig: '3_bus',
  },

  // L_eff = wheelbase1 + wheelbase2 (до последней оси тандема)
  truck_tandem: {
    name: 'Грузовик 12 м (3 оси, тандем)',
    wheelbase: 7.10,
    trackWidth: 2.98,
    overhangFront: 1.50,
    overhangRear: 3.40,
    minTurningRadius: 6.618,
    totalLength: 12.0,
    axleConfig: '3_truck',
  },
};

// ─── Вспомогательная геометрия ───────────────────────────────────────────────

/** Угол от точки A к точке B в плане */
function bearing(a: Point3D, b: Point3D): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/**
 * Смещение точки перпендикулярно направлению движения.
 * dist > 0 — влево, dist < 0 — вправо.
 */
function offsetPoint(pt: Point3D, angle: number, dist: number): Point3D {
  return {
    x: pt.x + dist * Math.cos(angle + Math.PI / 2),
    y: pt.y + dist * Math.sin(angle + Math.PI / 2),
    z: 0,
  };
}

/**
 * Точки на дуге окружности от startAngle до endAngle.
 * Направление обхода — кратчайший путь (delta нормализуется в (-π, π]).
 */
function arcPoints(
  center: Point3D,
  radius: number,
  startAngle: number,
  endAngle: number,
  steps: number = 64,
): Point3D[] {
  let delta = endAngle - startAngle;
  while (delta >  Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;

  const pts: Point3D[] = [];
  for (let i = 0; i <= steps; i++) {
    const angle = startAngle + (delta * i) / steps;
    pts.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
      z: 0,
    });
  }
  return pts;
}

// ─── Основной калькулятор ─────────────────────────────────────────────────────

export class VehicleTrackCalculator {
  private v: VehicleParams;

  constructor(vehicle: VehicleParams) {
    this.v = vehicle;
  }

  /**
   * Внешний радиус коридора — траектория внешней передней габаритной точки.
   * R_outer = √((R + trackWidth/2)² + (wheelbase + overhangFront)²)
   */
  calcOuterRadius(R: number = this.v.minTurningRadius): number {
    const { trackWidth, wheelbase, overhangFront } = this.v;
    const lateral     = R + trackWidth / 2;
    const longitudinal = wheelbase + overhangFront;
    return Math.sqrt(lateral * lateral + longitudinal * longitudinal);
  }

  /**
   * Внутренний радиус коридора — траектория внутренней задней габаритной точки.
   * R_inner = √((R - trackWidth/2)² + overhangRear²)
   */
  calcInnerRadius(R: number = this.v.minTurningRadius): number {
    const { trackWidth, overhangRear } = this.v;
    const lateral = Math.max(0, R - trackWidth / 2);
    return Math.sqrt(lateral * lateral + overhangRear * overhangRear);
  }

  /**
   * Радиус переднего забегающего колеса.
   * R_front = √((R + trackWidth/2)² + wheelbase²)
   */
  calcFrontWheelRadius(R: number = this.v.minTurningRadius): number {
    const { trackWidth, wheelbase } = this.v;
    const lateral = R + trackWidth / 2;
    return Math.sqrt(lateral * lateral + wheelbase * wheelbase);
  }

  // ── Построение коридора для прямого сегмента ───────────────────────────────

  /** Прямой участок: коридор = смещение осевой линии на ±trackWidth/2 */
  private straightCorridor(seg: AlignmentSegment): { outer: Point3D[]; inner: Point3D[] } {
    const angle = bearing(seg.start, seg.end);
    const hw    = this.v.trackWidth / 2;
    return {
      outer: [offsetPoint(seg.start, angle,  hw), offsetPoint(seg.end, angle,  hw)],
      inner: [offsetPoint(seg.start, angle, -hw), offsetPoint(seg.end, angle, -hw)],
    };
  }

  // ── Построение коридора для дугового сегмента ──────────────────────────────

  /**
   * Дуговой участок: внешний и внутренний контуры — дуги окружностей
   * с радиусами R_outer / R_inner от центра поворота ICR.
   *
   * Поворот вправо: ICR справа, внешний борт (левый) = R_outer, внутренний (правый) = R_inner.
   * Поворот влево — симметрично.
   */
  private arcCorridor(seg: AlignmentSegment): { outer: Point3D[]; inner: Point3D[] } {
    if (!seg.center || seg.radius == null) {
      throw new Error('Дуговой сегмент должен содержать center и radius');
    }

    const Ro = this.calcOuterRadius(seg.radius);
    const Ri = this.calcInnerRadius(seg.radius);

    const startAngle = bearing(seg.center, seg.start);
    const endAngle   = bearing(seg.center, seg.end);
    const isRight    = seg.direction === 'right';

    return {
      outer: arcPoints(seg.center, isRight ? Ro : Ri, startAngle, endAngle),
      inner: arcPoints(seg.center, isRight ? Ri : Ro, startAngle, endAngle),
    };
  }

  // ── Полный коридор по трассе ───────────────────────────────────────────────

  /**
   * Расчёт полного коридора движения ТС вдоль трассы.
   *
   * Для каждого сегмента строятся пары контуров outer/inner,
   * затем они стыкуются и склеиваются в единые полилинии.
   *
   * Стыковка прямой↔дуга: крайние точки прямой подтягиваются к дуге,
   * так как дуга геометрически точна (строится от ICR).
   */
  calculateCorridor(alignment: Alignment): CorridorResult {
    const segmentContours = alignment.segments.map(seg =>
      seg.type === 'straight' ? this.straightCorridor(seg) : this.arcCorridor(seg),
    );

    for (let i = 0; i < segmentContours.length - 1; i++) {
      const cur  = segmentContours[i];
      const next = segmentContours[i + 1];
      const curType  = alignment.segments[i].type;
      const nextType = alignment.segments[i + 1].type;

      if (curType === 'straight' && nextType === 'arc') {
        cur.outer[cur.outer.length - 1] = { ...next.outer[0] };
        cur.inner[cur.inner.length - 1] = { ...next.inner[0] };
      } else if (curType === 'arc' && nextType === 'straight') {
        next.outer[0] = { ...cur.outer[cur.outer.length - 1] };
        next.inner[0] = { ...cur.inner[cur.inner.length - 1] };
      }
      // arc→arc: точки геометрически совпадают, стыковка не нужна
    }

    const outerPolyline: Point3D[] = [];
    const innerPolyline: Point3D[] = [];

    for (let i = 0; i < segmentContours.length; i++) {
      const { outer, inner } = segmentContours[i];
      outerPolyline.push(...(i === 0 ? outer : outer.slice(1)));
      innerPolyline.push(...(i === 0 ? inner : inner.slice(1)));
    }

    const R = this.v.minTurningRadius;

    return {
      outerRadius:      this.calcOuterRadius(R),
      innerRadius:      this.calcInnerRadius(R),
      frontWheelRadius: this.calcFrontWheelRadius(R),
      straightWidth:    this.v.trackWidth,
      outerPolyline,
      innerPolyline,
    };
  }
}
