/**
 * Модуль расчёта траекторий и коридоров движения ТС
 * Алгоритмы аналогичны AutoTURN
 */

import type {
  VehicleParams,
  VehiclePreset,
  AlignmentSegment,
  Alignment,
  CorridorResult,
  Point3D,
} from './types';

// ─── Предустановленные параметры ТС ──────────────────────────────────────────

export const VEHICLE_PRESETS: Record<Exclude<VehiclePreset, 'custom'>, VehicleParams> = {
  passenger_car: {
    name: 'Легковой автомобиль',
    wheelbase: 2.7,
    trackWidth: 1.8,
    overhangFront: 0.9,
    overhangRear: 0.9,
    minTurningRadius: 5.5,
    totalLength: 4.5,
  },
  truck_16m: {
    name: 'Грузовик 16 м',
    wheelbase: 5.5,
    trackWidth: 2.5,
    overhangFront: 1.2,
    overhangRear: 1.5,
    minTurningRadius: 9.0,
    totalLength: 16.0,
  },
  truck_20m: {
    name: 'Грузовик 20 м',
    wheelbase: 6.0,
    trackWidth: 2.5,
    overhangFront: 1.3,
    overhangRear: 2.0,
    minTurningRadius: 12.0,
    totalLength: 20.0,
  },
  bus_12m: {
    name: 'Автобус 12 м',
    wheelbase: 5.9,
    trackWidth: 2.3,
    overhangFront: 2.5,
    overhangRear: 2.0,
    minTurningRadius: 10.5,
    totalLength: 12.0,
  },
  bus_articulated: {
    name: 'Автобус сочленённый 18 м',
    wheelbase: 12.0,
    trackWidth: 2.55,
    overhangFront: 2.7,
    overhangRear: 2.3,
    minTurningRadius: 11.5,
    totalLength: 18.0,
  },
};

// ─── Вспомогательная геометрия ───────────────────────────────────────────────

/**
 * Перемещение точки по нормали к направлению (в плане)
 */
function offsetPoint(pt: Point3D, angle: number, dist: number): Point3D {
  return {
    x: pt.x + dist * Math.cos(angle + Math.PI / 2),
    y: pt.y + dist * Math.sin(angle + Math.PI / 2),
    z: pt.z,
  };
}

/**
 * Угол от точки A к точке B
 */
function bearing(a: Point3D, b: Point3D): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/**
 * Точки на дуге (N шагов)
 * @param ccw true = против часовой (поворот влево), false = по часовой (вправо)
 */
function arcPoints(
  center: Point3D,
  radius: number,
  startAngle: number,
  endAngle: number,
  ccw: boolean,
  steps: number = 32,
): Point3D[] {
  const pts: Point3D[] = [];

  // Нормализуем delta строго в нужном направлении
  let delta = endAngle - startAngle;
  if (ccw) {
    // Должны идти в сторону увеличения угла
    while (delta <= 0) delta += 2 * Math.PI;
    while (delta > 2 * Math.PI) delta -= 2 * Math.PI;
  } else {
    // Должны идти в сторону уменьшения угла
    while (delta >= 0) delta -= 2 * Math.PI;
    while (delta < -2 * Math.PI) delta += 2 * Math.PI;
  }

  for (let i = 0; i <= steps; i++) {
    const angle = startAngle + (delta * i) / steps;
    pts.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
      z: center.z,
    });
  }
  return pts;
}

// ─── Основной калькулятор ─────────────────────────────────────────────────────

export class VehicleTrackCalculator {
  private vehicle: VehicleParams;

  constructor(vehicle: VehicleParams) {
    this.vehicle = vehicle;
  }

  /**
   * Ширина коридора на прямом участке
   */
  get straightWidth(): number {
    return this.vehicle.trackWidth + this.vehicle.overhangFront + this.vehicle.overhangRear;
  }

  /**
   * Внешний радиус поворота (AutoTURN формула)
   * R_outer = R + (wheelbase/2 + trackWidth/2 + overhangFront)
   */
  outerRadius(turningRadius: number): number {
    const { wheelbase, trackWidth, overhangFront } = this.vehicle;
    return turningRadius + (wheelbase / 2 + trackWidth / 2 + overhangFront);
  }

  /**
   * Внутренний радиус поворота (AutoTURN формула)
   * R_inner = R - (wheelbase/2 + trackWidth/2)
   */
  innerRadius(turningRadius: number): number {
    const { wheelbase, trackWidth } = this.vehicle;
    return Math.max(0.1, turningRadius - (wheelbase / 2 + trackWidth / 2));
  }

  /**
   * Расчёт коридора для одного прямого сегмента трассы
   */
  private straightSegmentCorridor(seg: AlignmentSegment): { outer: Point3D[]; inner: Point3D[] } {
    const angle = bearing(seg.start, seg.end);
    const halfWidth = this.straightWidth / 2;

    const outer: Point3D[] = [
      offsetPoint(seg.start, angle, halfWidth),
      offsetPoint(seg.end, angle, halfWidth),
    ];
    const inner: Point3D[] = [
      offsetPoint(seg.start, angle, -halfWidth),
      offsetPoint(seg.end, angle, -halfWidth),
    ];
    return { outer, inner };
  }

  /**
   * Расчёт коридора для дугового сегмента трассы
   */
  private arcSegmentCorridor(seg: AlignmentSegment): { outer: Point3D[]; inner: Point3D[] } {
    if (!seg.center || !seg.radius) {
      throw new Error('Дуговой сегмент должен содержать center и radius');
    }

    const R = seg.radius;
    const isLeft = seg.direction === 'left';  // поворот влево = CCW
    const Ro = this.outerRadius(R);
    const Ri = this.innerRadius(R);

    const startAngle = bearing(seg.center, seg.start);
    const endAngle   = bearing(seg.center, seg.end);

    // Внешний контур — всегда дальше от центра поворота (Ro)
    // Внутренний контур — всегда ближе к центру (Ri)
    // Направление обхода: влево = CCW, вправо = CW
    const outer = arcPoints(seg.center, Ro, startAngle, endAngle, isLeft);
    const inner = arcPoints(seg.center, Ri, startAngle, endAngle, isLeft);

    return { outer, inner };
  }

  /**
   * Расчёт полного коридора движения по трассе
   */
  calculateCorridor(alignment: Alignment): CorridorResult {
    const outerPolyline: Point3D[] = [];
    const innerPolyline: Point3D[] = [];

    for (const seg of alignment.segments) {
      let outer: Point3D[];
      let inner: Point3D[];

      if (seg.type === 'straight') {
        ({ outer, inner } = this.straightSegmentCorridor(seg));
      } else {
        ({ outer, inner } = this.arcSegmentCorridor(seg));
      }

      // Добавляем точки (избегаем дублирования стыков)
      if (outerPolyline.length > 0) {
        outer.shift();
        inner.shift();
      }
      outerPolyline.push(...outer);
      innerPolyline.push(...inner);
    }

    // Используем минимальный радиус поворота из параметров ТС
    const R = this.vehicle.minTurningRadius;
    return {
      outerRadius: this.outerRadius(R),
      innerRadius: this.innerRadius(R),
      straightWidth: this.straightWidth,
      outerPolyline,
      innerPolyline,
    };
  }
}

// ─── Парсер IFC Alignment ─────────────────────────────────────────────────────

/**
 * Преобразование IFC-объекта трассы в структуру Alignment
 * Адаптируйте под реальный API Топоматик 360
 */
export function parseIfcAlignment(ifcObject: any): Alignment {
  const segments: AlignmentSegment[] = [];
  let totalLength = 0;

  // Попытка прочитать сегменты из IfcAlignmentHorizontal
  const horizontal =
    ifcObject?.IsDecomposedBy?.[0]?.RelatedObjects?.find(
      (o: any) => o?.type === 'IfcAlignmentHorizontal',
    ) ?? ifcObject;

  const elements: any[] = horizontal?.IsDecomposedBy?.[0]?.RelatedObjects ?? [];

  for (const el of elements) {
    const design = el?.DesignParameters;
    if (!design) continue;

    if (design.type === 'IfcAlignmentHorizontalSegment') {
      const startPt: Point3D = { x: design.StartPoint?.x ?? 0, y: design.StartPoint?.y ?? 0, z: 0 };
      const len: number = design.SegmentLength ?? 10;

      if (design.PredefinedType === 'LINE') {
        const angle: number = design.StartDirection ?? 0;
        const endPt: Point3D = {
          x: startPt.x + len * Math.cos(angle),
          y: startPt.y + len * Math.sin(angle),
          z: 0,
        };
        segments.push({ type: 'straight', start: startPt, end: endPt, length: len });
      } else if (design.PredefinedType === 'CIRCULARARC') {
        const R: number = design.Radius ?? 10;
        const dir: 'left' | 'right' = design.IsCCW ? 'left' : 'right';
        const startAngle: number = design.StartDirection ?? 0;
        const sign = dir === 'left' ? 1 : -1;
        const center: Point3D = {
          x: startPt.x + R * Math.cos(startAngle + sign * Math.PI / 2),
          y: startPt.y + R * Math.sin(startAngle + sign * Math.PI / 2),
          z: 0,
        };
        const deltaAngle = len / R;
        const endAngleFromCenter = startAngle - sign * Math.PI / 2 + sign * deltaAngle;
        const endPt: Point3D = {
          x: center.x + R * Math.cos(endAngleFromCenter),
          y: center.y + R * Math.sin(endAngleFromCenter),
          z: 0,
        };
        segments.push({ type: 'arc', start: startPt, end: endPt, length: len, radius: R, direction: dir, center });
      }

      totalLength += len;
    }
  }

  // Если IFC-данных нет — создаём тестовую трассу для демонстрации
  if (segments.length === 0) {
    segments.push(
      { type: 'straight', start: { x: 0, y: 0, z: 0 }, end: { x: 30, y: 0, z: 0 }, length: 30 },
      {
        type: 'arc',
        start: { x: 30, y: 0, z: 0 },
        end: { x: 40, y: 10, z: 0 },
        length: 15.7,
        radius: 10,
        direction: 'left',
        center: { x: 30, y: 10, z: 0 },
      },
      { type: 'straight', start: { x: 40, y: 10, z: 0 }, end: { x: 40, y: 40, z: 0 }, length: 30 },
    );
    totalLength = 75.7;
  }

  return { ifcId: ifcObject?.GlobalId ?? 'demo', segments, totalLength };
}
