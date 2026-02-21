const x = {
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
function p(n, t, e) {
  return {
    x: n.x + e * Math.cos(t + Math.PI / 2),
    y: n.y + e * Math.sin(t + Math.PI / 2),
    z: n.z
  };
}
function P(n, t) {
  return Math.atan2(t.y - n.y, t.x - n.x);
}
function F(n, t, e, r, i = 32) {
  const a = [];
  let s = r - e;
  for (; s > Math.PI; ) s -= 2 * Math.PI;
  for (; s < -Math.PI; ) s += 2 * Math.PI;
  for (let o = 0; o <= i; o++) {
    const c = e + s * o / i;
    a.push({
      x: n.x + t * Math.cos(c),
      y: n.y + t * Math.sin(c),
      z: n.z
    });
  }
  return a;
}
class z {
  constructor(t) {
    this.vehicle = t;
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
  outerRadius(t) {
    const { wheelbase: e, trackWidth: r, overhangFront: i } = this.vehicle;
    return t + (e / 2 + r / 2 + i);
  }
  /**
   * Внутренний радиус поворота (AutoTURN формула)
   * R_inner = R - (wheelbase/2 + trackWidth/2)
   */
  innerRadius(t) {
    const { wheelbase: e, trackWidth: r } = this.vehicle;
    return Math.max(0.1, t - (e / 2 + r / 2));
  }
  /**
   * Расчёт коридора для одного прямого сегмента трассы
   */
  straightSegmentCorridor(t) {
    const e = P(t.start, t.end), r = this.straightWidth / 2, i = [
      p(t.start, e, r),
      p(t.end, e, r)
    ], a = [
      p(t.start, e, -r),
      p(t.end, e, -r)
    ];
    return { outer: i, inner: a };
  }
  /**
   * Расчёт коридора для дугового сегмента трассы
   */
  arcSegmentCorridor(t) {
    if (!t.center || !t.radius)
      throw new Error("Дуговой сегмент должен содержать center и radius");
    const e = t.radius, r = t.direction === "right", i = this.outerRadius(e), a = this.innerRadius(e), s = P(t.center, t.start), o = P(t.center, t.end), c = r ? i : a, d = r ? a : i, h = F(t.center, c, s, o), R = F(t.center, d, s, o);
    return { outer: h, inner: R };
  }
  /**
   * Расчёт полного коридора движения по трассе
   */
  calculateCorridor(t) {
    const e = [], r = [];
    for (const a of t.segments) {
      let s, o;
      a.type === "straight" ? { outer: s, inner: o } = this.straightSegmentCorridor(a) : { outer: s, inner: o } = this.arcSegmentCorridor(a), e.length > 0 && (s.shift(), o.shift()), e.push(...s), r.push(...o);
    }
    const i = this.vehicle.minTurningRadius;
    return {
      outerRadius: this.outerRadius(i),
      innerRadius: this.innerRadius(i),
      straightWidth: this.straightWidth,
      outerPolyline: e,
      innerPolyline: r
    };
  }
}
function T(n) {
  var t, e, r, i, a, s, o;
  const c = [];
  let d = 0;
  const h = ((r = (e = (t = n == null ? void 0 : n.IsDecomposedBy) == null ? void 0 : t[0]) == null ? void 0 : e.RelatedObjects) == null ? void 0 : r.find(
    (v) => (v == null ? void 0 : v.type) === "IfcAlignmentHorizontal"
  )) ?? n, R = ((a = (i = h == null ? void 0 : h.IsDecomposedBy) == null ? void 0 : i[0]) == null ? void 0 : a.RelatedObjects) ?? [];
  for (const v of R) {
    const u = v == null ? void 0 : v.DesignParameters;
    if (u && u.type === "IfcAlignmentHorizontalSegment") {
      const g = { x: ((s = u.StartPoint) == null ? void 0 : s.x) ?? 0, y: ((o = u.StartPoint) == null ? void 0 : o.y) ?? 0, z: 0 }, m = u.SegmentLength ?? 10;
      if (u.PredefinedType === "LINE") {
        const l = u.StartDirection ?? 0, y = {
          x: g.x + m * Math.cos(l),
          y: g.y + m * Math.sin(l),
          z: 0
        };
        c.push({ type: "straight", start: g, end: y, length: m });
      } else if (u.PredefinedType === "CIRCULARARC") {
        const l = u.Radius ?? 10, y = u.IsCCW ? "left" : "right", b = u.StartDirection ?? 0, f = y === "left" ? 1 : -1, k = {
          x: g.x + l * Math.cos(b + f * Math.PI / 2),
          y: g.y + l * Math.sin(b + f * Math.PI / 2),
          z: 0
        }, M = m / l, W = b - f * Math.PI / 2 + f * M, I = {
          x: k.x + l * Math.cos(W),
          y: k.y + l * Math.sin(W),
          z: 0
        };
        c.push({ type: "arc", start: g, end: I, length: m, radius: l, direction: y, center: k });
      }
      d += m;
    }
  }
  return c.length === 0 && (c.push(
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
  ), d = 75.7), { ifcId: (n == null ? void 0 : n.GlobalId) ?? "demo", segments: c, totalLength: d };
}
const L = {
  vehicletrack(n) {
    return {
      async createRule() {
        return {
          filter: "",
          vehiclePreset: "truck_16m",
          customWheelbase: 5.5,
          customTrackWidth: 2.5,
          customOverhangFront: 1.2,
          customOverhangRear: 1.5,
          customTurningRadius: 9
        };
      },
      async execute(t, e, r, i) {
        const a = t.model;
        if (!a) {
          r.set("error", [{
            message: n.tr("Модель не загружена"),
            severity: 1
          }]);
          return;
        }
        let s;
        e.vehiclePreset === "custom" ? s = {
          name: "Пользовательское ТС",
          wheelbase: e.customWheelbase,
          trackWidth: e.customTrackWidth,
          overhangFront: e.customOverhangFront,
          overhangRear: e.customOverhangRear,
          minTurningRadius: e.customTurningRadius,
          totalLength: e.customWheelbase + e.customOverhangFront + e.customOverhangRear
        } : s = x[e.vehiclePreset];
        const o = a.filterLayers(e.filter, !0);
        if (o.size === 0) {
          r.set("no-alignment", [{
            message: n.tr("Трассы не найдены. Проверьте фильтр трассы."),
            severity: 1
          }]);
          return;
        }
        const c = [...o][0], d = T(c), h = new z(s).calculateCorridor(d);
        r.set("result", [{
          message: n.tr(
            "Коридор построен. ТС: {0}. Ширина прямой: {1} м. R внешний: {2} м. R внутренний: {3} м.",
            s.name,
            h.straightWidth.toFixed(2),
            h.outerRadius.toFixed(2),
            h.innerRadius.toFixed(2)
          ),
          severity: 0
        }]);
      }
    };
  },
  "property:vehiclePreset"(n) {
    return {
      getProperties(t) {
        return [{
          id: "vehicletrack-preset",
          label: n.label ?? "Тип транспортного средства",
          description: n.description,
          group: n.group,
          value() {
            var e;
            const r = (e = t[0]) == null ? void 0 : e.vehiclePreset, i = r !== "custom" ? x[r] : null;
            return { label: (i == null ? void 0 : i.name) ?? "Пользовательский" };
          },
          editor() {
            return {
              type: "editbox",
              buttons: [{ label: "...", icon: "directions_car" }],
              async onDidTriggerItemButton() {
                const e = [
                  { key: "passenger_car", label: "Легковой автомобиль", description: "L=4.5м, R=5.5м" },
                  { key: "truck_16m", label: "Грузовик 16 м", description: "L=16м, R=9.0м" },
                  { key: "truck_20m", label: "Грузовик 20 м", description: "L=20м, R=12.0м" },
                  { key: "bus_12m", label: "Автобус 12 м", description: "L=12м, R=10.5м" },
                  { key: "bus_articulated", label: "Автобус сочленённый 18 м", description: "L=18м, R=11.5м" },
                  { key: "custom", label: "Пользовательский...", description: "Задать параметры вручную" }
                ], r = await n.showQuickPick(e, {
                  placeHolder: "Выберите тип транспортного средства"
                });
                for (const i of t)
                  try {
                    if (i.vehiclePreset = r.key, r.key !== "custom") {
                      const a = x[r.key];
                      i.customWheelbase = a.wheelbase, i.customTrackWidth = a.trackWidth, i.customOverhangFront = a.overhangFront, i.customOverhangRear = a.overhangRear, i.customTurningRadius = a.minTurningRadius;
                    }
                  } catch (a) {
                    console.error(a);
                  }
              },
              commit(e) {
              }
            };
          }
        }];
      }
    };
  },
  "property:numericParam"(n) {
    return {
      getProperties(t) {
        const e = n.field;
        return e ? [{
          id: `vehicletrack-${String(e)}`,
          label: n.label ?? String(e),
          description: n.description,
          group: n.group,
          value() {
            var r;
            const i = (r = t[0]) == null ? void 0 : r[e];
            for (let a = 1; a < t.length; a++)
              if (t[a][e] !== i)
                return { label: "**Различные**", suffix: "м" };
            return { label: String(i), suffix: "м" };
          },
          editor() {
            return {
              type: "editbox",
              commit(r) {
                if (!r) return;
                const i = parseFloat(r);
                if (!(!isFinite(i) || i <= 0))
                  for (const a of t)
                    try {
                      a[e] = i;
                    } catch (s) {
                      console.error(s);
                    }
              },
              validate(r) {
                if (!r) return "Поле не может быть пустым";
                if (!isFinite(parseFloat(r))) return "Введите число";
                if (parseFloat(r) <= 0) return "Значение должно быть больше 0";
              }
            };
          }
        }] : [];
      }
    };
  }
};
export {
  L as default
};
//# sourceMappingURL=index-BzJ5onfP-C8125nU3.mjs.map
