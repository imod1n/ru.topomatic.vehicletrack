"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const VEHICLE_PRESETS = {
  passenger_car: {
    name: "Легковой автомобиль",
    wheelbase: 2.7,
    trackWidth: 1.8,
    overhangFront: 0.9,
    overhangRear: 0.9,
    minTurningRadius: 5.5,
    totalLength: 4.5
  },
  truck_16m: {
    name: "Грузовик 16 м",
    wheelbase: 5.5,
    trackWidth: 2.5,
    overhangFront: 1.2,
    overhangRear: 1.5,
    minTurningRadius: 9,
    totalLength: 16
  },
  truck_20m: {
    name: "Грузовик 20 м",
    wheelbase: 6,
    trackWidth: 2.5,
    overhangFront: 1.3,
    overhangRear: 2,
    minTurningRadius: 12,
    totalLength: 20
  },
  bus_12m: {
    name: "Автобус 12 м",
    wheelbase: 5.9,
    trackWidth: 2.3,
    overhangFront: 2.5,
    overhangRear: 2,
    minTurningRadius: 10.5,
    totalLength: 12
  },
  bus_articulated: {
    name: "Автобус сочленённый 18 м",
    wheelbase: 12,
    trackWidth: 2.55,
    overhangFront: 2.7,
    overhangRear: 2.3,
    minTurningRadius: 11.5,
    totalLength: 18
  }
};
function offsetPoint(pt, angle, dist) {
  return {
    x: pt.x + dist * Math.cos(angle + Math.PI / 2),
    y: pt.y + dist * Math.sin(angle + Math.PI / 2),
    z: pt.z
  };
}
function bearing(a, b) {
  return Math.atan2(b.y - a.y, b.x - a.x);
}
function arcPoints(center, radius, startAngle, endAngle, steps = 32) {
  const pts = [];
  let delta = endAngle - startAngle;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  for (let i = 0; i <= steps; i++) {
    const angle = startAngle + delta * i / steps;
    pts.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
      z: center.z
    });
  }
  return pts;
}
class VehicleTrackCalculator {
  constructor(vehicle) {
    this.vehicle = vehicle;
  }
  /**
   * Ширина коридора на прямом участке
   */
  get straightWidth() {
    return this.vehicle.trackWidth + this.vehicle.overhangFront + this.vehicle.overhangRear;
  }
  /**
   * Внешний радиус поворота (AutoTURN формула)
   * R_outer = R + (wheelbase/2 + trackWidth/2 + overhangFront)
   */
  outerRadius(turningRadius) {
    const { wheelbase, trackWidth, overhangFront } = this.vehicle;
    return turningRadius + (wheelbase / 2 + trackWidth / 2 + overhangFront);
  }
  /**
   * Внутренний радиус поворота (AutoTURN формула)
   * R_inner = R - (wheelbase/2 + trackWidth/2)
   */
  innerRadius(turningRadius) {
    const { wheelbase, trackWidth } = this.vehicle;
    return Math.max(0.1, turningRadius - (wheelbase / 2 + trackWidth / 2));
  }
  /**
   * Расчёт коридора для одного прямого сегмента трассы
   */
  straightSegmentCorridor(seg) {
    const angle = bearing(seg.start, seg.end);
    const halfWidth = this.straightWidth / 2;
    const outer = [
      offsetPoint(seg.start, angle, halfWidth),
      offsetPoint(seg.end, angle, halfWidth)
    ];
    const inner = [
      offsetPoint(seg.start, angle, -halfWidth),
      offsetPoint(seg.end, angle, -halfWidth)
    ];
    return { outer, inner };
  }
  /**
   * Расчёт коридора для дугового сегмента трассы
   */
  arcSegmentCorridor(seg) {
    if (!seg.center || !seg.radius) {
      throw new Error("Дуговой сегмент должен содержать center и radius");
    }
    const R = seg.radius;
    const isRight = seg.direction === "right";
    const Ro = this.outerRadius(R);
    const Ri = this.innerRadius(R);
    const startAngle = bearing(seg.center, seg.start);
    const endAngle = bearing(seg.center, seg.end);
    const outerRadius = isRight ? Ro : Ri;
    const innerRadius = isRight ? Ri : Ro;
    const outer = arcPoints(seg.center, outerRadius, startAngle, endAngle);
    const inner = arcPoints(seg.center, innerRadius, startAngle, endAngle);
    return { outer, inner };
  }
  /**
   * Расчёт полного коридора движения по трассе
   */
  calculateCorridor(alignment) {
    const outerPolyline = [];
    const innerPolyline = [];
    for (const seg of alignment.segments) {
      let outer;
      let inner;
      if (seg.type === "straight") {
        ({ outer, inner } = this.straightSegmentCorridor(seg));
      } else {
        ({ outer, inner } = this.arcSegmentCorridor(seg));
      }
      if (outerPolyline.length > 0) {
        outer.shift();
        inner.shift();
      }
      outerPolyline.push(...outer);
      innerPolyline.push(...inner);
    }
    const R = this.vehicle.minTurningRadius;
    return {
      outerRadius: this.outerRadius(R),
      innerRadius: this.innerRadius(R),
      straightWidth: this.straightWidth,
      outerPolyline,
      innerPolyline
    };
  }
}
function parseIfcAlignment(ifcObject) {
  var _a, _b, _c, _d, _e, _f, _g;
  const segments = [];
  let totalLength = 0;
  const horizontal = ((_c = (_b = (_a = ifcObject == null ? void 0 : ifcObject.IsDecomposedBy) == null ? void 0 : _a[0]) == null ? void 0 : _b.RelatedObjects) == null ? void 0 : _c.find(
    (o) => (o == null ? void 0 : o.type) === "IfcAlignmentHorizontal"
  )) ?? ifcObject;
  const elements = ((_e = (_d = horizontal == null ? void 0 : horizontal.IsDecomposedBy) == null ? void 0 : _d[0]) == null ? void 0 : _e.RelatedObjects) ?? [];
  for (const el of elements) {
    const design = el == null ? void 0 : el.DesignParameters;
    if (!design) continue;
    if (design.type === "IfcAlignmentHorizontalSegment") {
      const startPt = { x: ((_f = design.StartPoint) == null ? void 0 : _f.x) ?? 0, y: ((_g = design.StartPoint) == null ? void 0 : _g.y) ?? 0, z: 0 };
      const len = design.SegmentLength ?? 10;
      if (design.PredefinedType === "LINE") {
        const angle = design.StartDirection ?? 0;
        const endPt = {
          x: startPt.x + len * Math.cos(angle),
          y: startPt.y + len * Math.sin(angle),
          z: 0
        };
        segments.push({ type: "straight", start: startPt, end: endPt, length: len });
      } else if (design.PredefinedType === "CIRCULARARC") {
        const R = design.Radius ?? 10;
        const dir = design.IsCCW ? "left" : "right";
        const startAngle = design.StartDirection ?? 0;
        const sign = dir === "left" ? 1 : -1;
        const center = {
          x: startPt.x + R * Math.cos(startAngle + sign * Math.PI / 2),
          y: startPt.y + R * Math.sin(startAngle + sign * Math.PI / 2),
          z: 0
        };
        const deltaAngle = len / R;
        const endAngleFromCenter = startAngle - sign * Math.PI / 2 + sign * deltaAngle;
        const endPt = {
          x: center.x + R * Math.cos(endAngleFromCenter),
          y: center.y + R * Math.sin(endAngleFromCenter),
          z: 0
        };
        segments.push({ type: "arc", start: startPt, end: endPt, length: len, radius: R, direction: dir, center });
      }
      totalLength += len;
    }
  }
  if (segments.length === 0) {
    segments.push(
      { type: "straight", start: { x: 0, y: 0, z: 0 }, end: { x: 30, y: 0, z: 0 }, length: 30 },
      {
        type: "arc",
        start: { x: 30, y: 0, z: 0 },
        end: { x: 40, y: 10, z: 0 },
        length: 15.7,
        radius: 10,
        direction: "left",
        center: { x: 30, y: 10, z: 0 }
      },
      { type: "straight", start: { x: 40, y: 10, z: 0 }, end: { x: 40, y: 40, z: 0 }, length: 30 }
    );
    totalLength = 75.7;
  }
  return { ifcId: (ifcObject == null ? void 0 : ifcObject.GlobalId) ?? "demo", segments, totalLength };
}
const index = {
  /**
   * Главная команда — расчёт коридора движения ТС
   * Вызывается из манифеста как команда плагина
   */
  "vehicletrack:calculate"(ctx) {
    return {
      // Параметры по умолчанию при создании правила
      async createRule() {
        return {
          vehiclePreset: "truck_16m",
          customWheelbase: 5.5,
          customTrackWidth: 2.5,
          customOverhangFront: 1.2,
          customOverhangRear: 1.5,
          customTurningRadius: 9,
          showOuter: true,
          showInner: true
        };
      },
      // Основная логика расчёта
      async execute(app, rule, diagnostics, _progress) {
        var _a, _b, _c;
        const drawing = app.model;
        if (!drawing) {
          diagnostics.set("error", [{
            message: ctx.tr("Модель не загружена"),
            severity: 2
            // Warning
          }]);
          return;
        }
        let vehicle;
        if (rule.vehiclePreset === "custom") {
          vehicle = {
            name: ctx.tr("Пользовательское ТС"),
            wheelbase: rule.customWheelbase,
            trackWidth: rule.customTrackWidth,
            overhangFront: rule.customOverhangFront,
            overhangRear: rule.customOverhangRear,
            minTurningRadius: rule.customTurningRadius,
            totalLength: rule.customWheelbase + rule.customOverhangFront + rule.customOverhangRear
          };
        } else {
          vehicle = VEHICLE_PRESETS[rule.vehiclePreset];
        }
        const alignments = [];
        (_c = (_b = (_a = drawing.layouts) == null ? void 0 : _a.model) == null ? void 0 : _b.walk) == null ? void 0 : _c.call(_b, (e) => {
          if ((e == null ? void 0 : e.type) === "IfcAlignment" || (e == null ? void 0 : e.ifcType) === "IFCALIGNMENT") {
            alignments.push(e);
          }
          return false;
        });
        if (alignments.length === 0) {
          diagnostics.set("no-alignment", [{
            message: ctx.tr("Трассы (IfcAlignment) не найдены в модели"),
            severity: 1
            // Warning
          }]);
          return;
        }
        let selectedAlignment = alignments[0];
        if (alignments.length > 1) {
          const items = alignments.map((a, i) => ({
            key: String(i),
            label: a.Name ?? a.GlobalId ?? `Трасса ${i + 1}`,
            description: `Длина: ${(a.TotalLength ?? 0).toFixed(1)} м`
          }));
          const picked = await ctx.showQuickPick(items, {
            placeHolder: ctx.tr("Выберите трассу для расчёта коридора")
          });
          selectedAlignment = alignments[parseInt(picked.key)];
        }
        const alignment = parseIfcAlignment(selectedAlignment);
        const calculator = new VehicleTrackCalculator(vehicle);
        const result = calculator.calculateCorridor(alignment);
        if (rule.showOuter && result.outerPolyline.length > 0) {
          ctx.manager.eval("ru.topomatic.vehicletrack/draw:polyline", {
            points: result.outerPolyline,
            color: "#FF6600",
            lineWidth: 2,
            label: ctx.tr("Внешний контур коридора")
          });
        }
        if (rule.showInner && result.innerPolyline.length > 0) {
          ctx.manager.eval("ru.topomatic.vehicletrack/draw:polyline", {
            points: result.innerPolyline,
            color: "#FF6600",
            lineWidth: 2,
            dashed: true,
            label: ctx.tr("Внутренний контур коридора")
          });
        }
        diagnostics.set("result", [{
          message: ctx.tr(
            "Коридор построен. ТС: {0}. Ширина: {1} м. Внешний R: {2} м. Внутренний R: {3} м.",
            vehicle.name,
            result.straightWidth.toFixed(2),
            result.outerRadius.toFixed(2),
            result.innerRadius.toFixed(2)
          ),
          severity: 0
          // Info
        }]);
      }
    };
  },
  // ─── Провайдер свойств: выбор типа ТС ──────────────────────────────────────
  "property:vehiclePreset"(e) {
    return {
      getProperties(objects) {
        return [{
          id: "vehicletrack-preset",
          label: e.label ?? e.tr("Тип транспортного средства"),
          description: e.description,
          group: e.group,
          value() {
            var _a;
            const val = (_a = objects[0]) == null ? void 0 : _a.vehiclePreset;
            const preset = val !== "custom" ? VEHICLE_PRESETS[val] : null;
            return { label: (preset == null ? void 0 : preset.name) ?? e.tr("Пользовательский") };
          },
          editor() {
            return {
              type: "editbox",
              buttons: [{ label: "...", icon: "directions_car" }],
              async onDidTriggerItemButton() {
                const items = [
                  { key: "passenger_car", label: "Легковой автомобиль", description: "L=4.5м, R=5.5м" },
                  { key: "truck_16m", label: "Грузовик 16 м", description: "L=16м, R=9.0м" },
                  { key: "truck_20m", label: "Грузовик 20 м", description: "L=20м, R=12.0м" },
                  { key: "bus_12m", label: "Автобус 12 м", description: "L=12м, R=10.5м" },
                  { key: "bus_articulated", label: "Автобус сочленённый 18 м", description: "L=18м, R=11.5м" },
                  { key: "custom", label: "Пользовательский...", description: "Задать параметры вручную" }
                ];
                const picked = await e.showQuickPick(items, {
                  placeHolder: e.tr("Выберите тип транспортного средства")
                });
                for (const obj of objects) {
                  try {
                    obj.vehiclePreset = picked.key;
                    if (picked.key !== "custom") {
                      const p = VEHICLE_PRESETS[picked.key];
                      obj.customWheelbase = p.wheelbase;
                      obj.customTrackWidth = p.trackWidth;
                      obj.customOverhangFront = p.overhangFront;
                      obj.customOverhangRear = p.overhangRear;
                      obj.customTurningRadius = p.minTurningRadius;
                    }
                  } catch (err) {
                    console.error(err);
                  }
                }
              },
              commit(value) {
              }
            };
          }
        }];
      }
    };
  },
  // ─── Провайдер свойств: числовые параметры ТС ──────────────────────────────
  "property:numericParam"(e) {
    return {
      getProperties(objects) {
        const field = e.field;
        if (!field) return [];
        return [{
          id: `vehicletrack-${field}`,
          label: e.label ?? String(field),
          description: e.description,
          group: e.group,
          value() {
            var _a;
            const val = (_a = objects[0]) == null ? void 0 : _a[field];
            for (let i = 1; i < objects.length; i++) {
              if (objects[i][field] !== val) {
                return { label: e.tr("**Различные**"), suffix: "м" };
              }
            }
            return { label: String(val), suffix: "м" };
          },
          editor() {
            return {
              type: "editbox",
              commit(value) {
                if (!value) return;
                const num = parseFloat(value);
                if (!isFinite(num)) return;
                for (const obj of objects) {
                  try {
                    obj[field] = num;
                  } catch (err) {
                    console.error(err);
                  }
                }
              },
              validate(value) {
                if (!value) return e.tr("Поле не может быть пустым");
                if (!isFinite(parseFloat(value))) return e.tr("Введите число");
                if (parseFloat(value) <= 0) return e.tr("Значение должно быть больше 0");
              }
            };
          }
        }];
      }
    };
  }
};
exports.default = index;
//# sourceMappingURL=index.cjs.js.map
