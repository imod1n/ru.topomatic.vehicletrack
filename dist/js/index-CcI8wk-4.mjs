const M = {
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
function x(n, e, r) {
  return {
    x: n.x + r * Math.cos(e + Math.PI / 2),
    y: n.y + r * Math.sin(e + Math.PI / 2),
    z: n.z
  };
}
function F(n, e) {
  return Math.atan2(e.y - n.y, e.x - n.x);
}
function I(n, e, r, s, a = 32) {
  const t = [];
  let i = s - r;
  for (; i > Math.PI; ) i -= 2 * Math.PI;
  for (; i < -Math.PI; ) i += 2 * Math.PI;
  for (let c = 0; c <= a; c++) {
    const h = r + i * c / a;
    t.push({
      x: n.x + e * Math.cos(h),
      y: n.y + e * Math.sin(h),
      z: n.z
    });
  }
  return t;
}
class z {
  constructor(e) {
    this.vehicle = e;
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
  outerRadius(e) {
    const { wheelbase: r, trackWidth: s, overhangFront: a } = this.vehicle;
    return e + (r / 2 + s / 2 + a);
  }
  /**
   * Внутренний радиус поворота (AutoTURN формула)
   * R_inner = R - (wheelbase/2 + trackWidth/2)
   */
  innerRadius(e) {
    const { wheelbase: r, trackWidth: s } = this.vehicle;
    return Math.max(0.1, e - (r / 2 + s / 2));
  }
  /**
   * Расчёт коридора для одного прямого сегмента трассы
   */
  straightSegmentCorridor(e) {
    const r = F(e.start, e.end), s = this.straightWidth / 2, a = [
      x(e.start, r, s),
      x(e.end, r, s)
    ], t = [
      x(e.start, r, -s),
      x(e.end, r, -s)
    ];
    return { outer: a, inner: t };
  }
  /**
   * Расчёт коридора для дугового сегмента трассы
   */
  arcSegmentCorridor(e) {
    if (!e.center || !e.radius)
      throw new Error("Дуговой сегмент должен содержать center и radius");
    const r = e.radius, s = e.direction === "right", a = this.outerRadius(r), t = this.innerRadius(r), i = F(e.center, e.start), c = F(e.center, e.end), h = s ? a : t, p = s ? t : a, u = I(e.center, h, i, c), g = I(e.center, p, i, c);
    return { outer: u, inner: g };
  }
  /**
   * Расчёт полного коридора движения по трассе
   */
  calculateCorridor(e) {
    const r = [], s = [];
    for (const t of e.segments) {
      let i, c;
      t.type === "straight" ? { outer: i, inner: c } = this.straightSegmentCorridor(t) : { outer: i, inner: c } = this.arcSegmentCorridor(t), r.length > 0 && (i.shift(), c.shift()), r.push(...i), s.push(...c);
    }
    const a = this.vehicle.minTurningRadius;
    return {
      outerRadius: this.outerRadius(a),
      innerRadius: this.innerRadius(a),
      straightWidth: this.straightWidth,
      outerPolyline: r,
      innerPolyline: s
    };
  }
}
function L(n) {
  var t, i, c, h, p, u, g;
  const e = [];
  let r = 0;
  const s = ((c = (i = (t = n == null ? void 0 : n.IsDecomposedBy) == null ? void 0 : t[0]) == null ? void 0 : i.RelatedObjects) == null ? void 0 : c.find(
    (d) => (d == null ? void 0 : d.type) === "IfcAlignmentHorizontal"
  )) ?? n, a = ((p = (h = s == null ? void 0 : s.IsDecomposedBy) == null ? void 0 : h[0]) == null ? void 0 : p.RelatedObjects) ?? [];
  for (const d of a) {
    const l = d == null ? void 0 : d.DesignParameters;
    if (l && l.type === "IfcAlignmentHorizontalSegment") {
      const m = { x: ((u = l.StartPoint) == null ? void 0 : u.x) ?? 0, y: ((g = l.StartPoint) == null ? void 0 : g.y) ?? 0, z: 0 }, o = l.SegmentLength ?? 10;
      if (l.PredefinedType === "LINE") {
        const y = l.StartDirection ?? 0, f = {
          x: m.x + o * Math.cos(y),
          y: m.y + o * Math.sin(y),
          z: 0
        };
        e.push({ type: "straight", start: m, end: f, length: o });
      } else if (l.PredefinedType === "CIRCULARARC") {
        const y = l.Radius ?? 10, f = l.IsCCW ? "left" : "right", v = l.StartDirection ?? 0, k = f === "left" ? 1 : -1, R = {
          x: m.x + y * Math.cos(v + k * Math.PI / 2),
          y: m.y + y * Math.sin(v + k * Math.PI / 2),
          z: 0
        }, P = o / y, b = v - k * Math.PI / 2 + k * P, W = {
          x: R.x + y * Math.cos(b),
          y: R.y + y * Math.sin(b),
          z: 0
        };
        e.push({ type: "arc", start: m, end: W, length: o, radius: y, direction: f, center: R });
      }
      r += o;
    }
  }
  return e.length === 0 && (e.push(
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
  ), r = 75.7), { ifcId: (n == null ? void 0 : n.GlobalId) ?? "demo", segments: e, totalLength: r };
}
async function S(n, e, r, s, a) {
  var h, p, u, g, d, l, m;
  const t = [];
  let i = null;
  try {
    i = (g = (u = (p = (h = n == null ? void 0 : n.model) == null ? void 0 : h.layouts) == null ? void 0 : p.model) == null ? void 0 : u.editor) == null ? void 0 : g.call(u), i ? t.push("editor: OK через app.model") : t.push("editor: null через app.model");
  } catch (o) {
    t.push(`editor error: ${o}`);
  }
  if (!i)
    return t.push("Доступные ключи app.model: " + Object.keys((n == null ? void 0 : n.model) ?? {}).join(", ")), t;
  t.push("editor keys: " + Object.keys(i).join(", "));
  const c = (l = (d = n == null ? void 0 : n.model) == null ? void 0 : d.layouts) == null ? void 0 : l.model;
  t.push("layout.model keys: " + Object.keys(c ?? {}).join(", "));
  try {
    const o = i.layout;
    t.push("editor.layout keys: " + Object.keys(o ?? {}).join(", "));
  } catch (o) {
    t.push("editor.layout error: " + o);
  }
  try {
    const o = i.updates;
    t.push("editor.updates type: " + typeof o + " | isArray: " + Array.isArray(o)), o && typeof o == "object" && t.push("editor.updates keys: " + Object.keys(o).join(", "));
  } catch (o) {
    t.push("editor.updates error: " + o);
  }
  try {
    const o = (m = i.layout) == null ? void 0 : m.$data;
    t.push("layout.$data type: " + typeof o), o && typeof o == "object" && t.push("layout.$data keys: " + Object.keys(o).join(", "));
  } catch (o) {
    t.push("layout.$data error: " + o);
  }
  try {
    const o = Object.getPrototypeOf(i);
    t.push("editor proto methods: " + Object.getOwnPropertyNames(o).join(", "));
  } catch (o) {
    t.push("editor proto error: " + o);
  }
  return t;
}
const T = {
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
      async execute(e, r, s, a) {
        var P, b;
        const t = e.model, i = Object.keys(e).join(", "), c = t ? Object.keys(t).join(", ") : "нет", h = t != null && t.layouts ? Object.keys(t.layouts).join(", ") : "нет", p = !!((b = (P = t == null ? void 0 : t.layouts) == null ? void 0 : P.model) != null && b.editor);
        if (s.set("debug-ctx", [{
          message: n.tr("app keys: {0}", i),
          severity: 2
        }]), s.set("debug-model", [{
          message: n.tr("model keys: {0}", c),
          severity: 2
        }]), s.set("debug-layouts", [{
          message: n.tr("layouts keys: {0} | hasEditor: {1}", h, String(p)),
          severity: 2
        }]), !t) {
          s.set("error", [{
            message: n.tr("Модель не загружена"),
            severity: 0
          }]);
          return;
        }
        let u;
        r.vehiclePreset === "custom" ? u = {
          name: "Пользовательское ТС",
          wheelbase: r.customWheelbase,
          trackWidth: r.customTrackWidth,
          overhangFront: r.customOverhangFront,
          overhangRear: r.customOverhangRear,
          minTurningRadius: r.customTurningRadius,
          totalLength: r.customWheelbase + r.customOverhangFront + r.customOverhangRear
        } : u = M[r.vehiclePreset];
        const g = t.filterLayers(r.filter, !0);
        if (s.set("debug-layers", [{
          message: n.tr("layers.size = {0}", String(g.size)),
          severity: 2
        }]), g.size === 0) {
          s.set("no-alignment", [{
            message: n.tr("Трассы не найдены. Проверьте фильтр трассы."),
            severity: 1
          }]);
          return;
        }
        const d = [...g][0], l = L(d), o = new z(u).calculateCorridor(l), y = l.segments[0], f = y.start, v = y.end, k = Math.atan2(v.y - f.y, v.x - f.x);
        let R = [];
        try {
          R = await S(e, o, u, f, k);
        } catch (W) {
          R = [`ОШИБКА: ${W}`];
        }
        s.set("debug-draw", [{
          message: n.tr("Отрисовка: {0}", R.join(" | ")),
          severity: 2
        }]), s.set("result", [{
          message: n.tr(
            "Коридор построен. ТС: {0}. Ширина: {1} м. R внешний: {2} м. R внутренний: {3} м.",
            u.name,
            o.straightWidth.toFixed(2),
            o.outerRadius.toFixed(2),
            o.innerRadius.toFixed(2)
          ),
          severity: 4
        }]);
      }
    };
  },
  "property:vehiclePreset"(n) {
    return {
      getProperties(e) {
        return [{
          id: "vehicletrack-preset",
          label: n.label ?? "Тип транспортного средства",
          description: n.description,
          group: n.group,
          value() {
            var a;
            const r = (a = e[0]) == null ? void 0 : a.vehiclePreset, s = r !== "custom" ? M[r] : null;
            return { label: (s == null ? void 0 : s.name) ?? "Пользовательский" };
          },
          editor() {
            return {
              type: "editbox",
              buttons: [{ label: "...", icon: "directions_car" }],
              async onDidTriggerItemButton() {
                const r = [
                  { key: "passenger_car", label: "Легковой автомобиль", description: "L=4.5м, R=5.5м" },
                  { key: "truck_16m", label: "Грузовик 16 м", description: "L=16м, R=9.0м" },
                  { key: "truck_20m", label: "Грузовик 20 м", description: "L=20м, R=12.0м" },
                  { key: "bus_12m", label: "Автобус 12 м", description: "L=12м, R=10.5м" },
                  { key: "bus_articulated", label: "Автобус сочленённый 18 м", description: "L=18м, R=11.5м" },
                  { key: "custom", label: "Пользовательский...", description: "Задать параметры вручную" }
                ], s = await n.showQuickPick(r, {
                  placeHolder: "Выберите тип транспортного средства"
                });
                for (const a of e)
                  try {
                    if (a.vehiclePreset = s.key, s.key !== "custom") {
                      const t = M[s.key];
                      a.customWheelbase = t.wheelbase, a.customTrackWidth = t.trackWidth, a.customOverhangFront = t.overhangFront, a.customOverhangRear = t.overhangRear, a.customTurningRadius = t.minTurningRadius;
                    }
                  } catch (t) {
                    console.error(t);
                  }
              },
              commit(r) {
              }
            };
          }
        }];
      }
    };
  },
  "property:numericParam"(n) {
    return {
      getProperties(e) {
        const r = n.field;
        return r ? [{
          id: `vehicletrack-${String(r)}`,
          label: n.label ?? String(r),
          description: n.description,
          group: n.group,
          value() {
            var a;
            const s = (a = e[0]) == null ? void 0 : a[r];
            for (let t = 1; t < e.length; t++)
              if (e[t][r] !== s)
                return { label: "**Различные**", suffix: "м" };
            return { label: String(s), suffix: "м" };
          },
          editor() {
            return {
              type: "editbox",
              commit(s) {
                if (!s) return;
                const a = parseFloat(s);
                if (!(!isFinite(a) || a <= 0))
                  for (const t of e)
                    try {
                      t[r] = a;
                    } catch (i) {
                      console.error(i);
                    }
              },
              validate(s) {
                if (!s) return "Поле не может быть пустым";
                if (!isFinite(parseFloat(s))) return "Введите число";
                if (parseFloat(s) <= 0) return "Значение должно быть больше 0";
              }
            };
          }
        }] : [];
      }
    };
  }
};
export {
  T as default
};
