/**
 * Типы данных для плагина расчёта траекторий движения ТС
 */

/** Параметры транспортного средства */
export interface VehicleParams {
  /** Название ТС */
  name: string;
  /** Колёсная база (м) */
  wheelbase: number;
  /** Ширина колеи (м) */
  trackWidth: number;
  /** Передний свес (м) */
  overhangFront: number;
  /** Задний свес (м) */
  overhangRear: number;
  /** Минимальный радиус поворота по оси (м) */
  minTurningRadius: number;
  /** Полная длина ТС (м) */
  totalLength: number;
}

/** Результат расчёта коридора движения */
export interface CorridorResult {
  /** Внешний радиус поворота (м) */
  outerRadius: number;
  /** Внутренний радиус поворота (м) */
  innerRadius: number;
  /** Ширина коридора на прямом участке (м) */
  straightWidth: number;
  /** Геометрия внешней границы коридора */
  outerPolyline: Point3D[];
  /** Геометрия внутренней границы коридора */
  innerPolyline: Point3D[];
}

/** 3D точка */
export interface Point3D {
  x: number;
  y: number;
  z: number;
}

/** Сегмент трассы */
export interface AlignmentSegment {
  /** Тип участка */
  type: 'straight' | 'arc';
  /** Начальная точка */
  start: Point3D;
  /** Конечная точка */
  end: Point3D;
  /** Длина участка (м) */
  length: number;
  /** Радиус (только для дуговых участков, м) */
  radius?: number;
  /** Направление поворота */
  direction?: 'left' | 'right';
  /** Центр дуги (только для дуговых участков) */
  center?: Point3D;
}

/** Трасса движения */
export interface Alignment {
  /** Идентификатор IFC-объекта */
  ifcId: string;
  /** Сегменты трассы */
  segments: AlignmentSegment[];
  /** Общая длина (м) */
  totalLength: number;
}

/** Предустановленные типы ТС */
export type VehiclePreset =
  | 'passenger_car'
  | 'truck_16m'
  | 'truck_20m'
  | 'bus_12m'
  | 'bus_articulated'
  | 'custom';

/** Опции плагина */
export interface PluginOptions {
  /** Выбранный пресет ТС */
  vehiclePreset: VehiclePreset;
  /** Пользовательские параметры ТС (если preset = 'custom') */
  customVehicle?: VehicleParams;
  /** Показывать ли внутренний контур */
  showInnerContour: boolean;
  /** Показывать ли внешний контур */
  showOuterContour: boolean;
  /** Цвет коридора */
  corridorColor: string;
  /** Прозрачность заливки */
  fillOpacity: number;
}
