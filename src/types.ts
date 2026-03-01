/**
 * Типы данных для плагина расчёта траекторий движения ТС
 */

/**
 * Конфигурация осей транспортного средства.
 *
 * Определяет как вычисляется эффективная колёсная база L_eff:
 *   '2'       — 2 оси:  L_eff = wheelbase
 *   '3_bus'   — 3 оси автобусного типа:  L_eff = wheelbase (до первой задней оси тандема)
 *   '3_truck' — 3 оси грузового типа:   L_eff = wheelbase (до последней оси жёсткого тандема)
 */
export type AxleConfig = '2' | '3_bus' | '3_truck';

/** Параметры транспортного средства */
export interface VehicleParams {
  /** Название ТС */
  name: string;

  /**
   * Эффективная колёсная база L_eff (м).
   *
   * Для 2-осных ТС: расстояние между передней и задней осью.
   * Для 3-осных автобусов: расстояние от передней до первой задней оси.
   * Для 3-осных грузовиков: расстояние от передней до последней задней оси.
   *
   * Входит в формулы:
   *   R_outer = √((R + trackWidth/2)² + (wheelbase + overhangFront)²)
   *   R_front = √((R + trackWidth/2)² + wheelbase²)
   */
  wheelbase: number;

  /**
   * Ширина колеи (м) — расстояние между серединами следов колёс.
   *
   * Это НЕ ширина кузова.
   *
   * Входит в формулы:
   *   R_outer = √((R + trackWidth/2)² + ...)
   *   R_inner = √((R - trackWidth/2)² + ...)
   */
  trackWidth: number;

  /** Передний свес — от передней оси до переднего бампера (м) */
  overhangFront: number;

  /**
   * Задний свес (м).
   *
   * Для 2-осных ТС: от задней оси до заднего бампера.
   * Для 3-осных ТС: от последней задней оси до заднего бампера.
   */
  overhangRear: number;

  /**
   * Минимальный радиус поворота по центру задней (эффективной) оси (м).
   *
   * R в формулах:
   *   R_outer = √((R + trackWidth/2)² + (wheelbase + overhangFront)²)
   *   R_inner = √((R - trackWidth/2)² + overhangRear²)
   */
  minTurningRadius: number;

  /** Полная длина ТС (м) */
  totalLength: number;

  /**
   * Конфигурация осей — определяет логику расчёта L_eff.
   * По умолчанию '2' (двухосное ТС).
   */
  axleConfig?: AxleConfig;
}

/** Результат расчёта коридора движения */
export interface CorridorResult {
  /** Внешний радиус поворота — траектория внешней передней габаритной точки (м) */
  outerRadius: number;
  /** Внутренний радиус поворота — траектория внутренней задней габаритной точки (м) */
  innerRadius: number;
  /** Радиус переднего забегающего колеса (м) */
  frontWheelRadius: number;
  /** Ширина коридора на прямом участке = trackWidth (м) */
  straightWidth: number;
  /** Геометрия внешней границы коридора */
  outerPolyline: Point3D[];
  /** Геометрия внутренней границы коридора */
  innerPolyline: Point3D[];
}

/** 3D точка (z всегда 0 — отрисовка ведётся в плане) */
export interface Point3D {
  x: number;
  y: number;
  z: number;
}

/** Сегмент трассы */
export interface AlignmentSegment {
  type: 'straight' | 'arc';
  start: Point3D;
  end: Point3D;
  /** Длина участка (м) */
  length: number;
  /** Радиус (только для дуговых участков, м) */
  radius?: number;
  direction?: 'left' | 'right';
  /** Центр дуги (только для дуговых участков) */
  center?: Point3D;
}

/** Трасса движения */
export interface Alignment {
  /** Идентификатор объекта */
  ifcId: string;
  segments: AlignmentSegment[];
  /** Общая длина (м) */
  totalLength: number;
}


