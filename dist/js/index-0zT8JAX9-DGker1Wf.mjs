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
function w(n, e, t) {
  return {
    x: n.x + t * Math.cos(e + Math.PI / 2),
    y: n.y + t * Math.sin(e + Math.PI / 2),
    z: n.z
  };
}
function W(n, e) {
  return Math.atan2(e.y - n.y, e.x - n.x);
}
function I(n, e, t, r, i = 32) {
  const a = [];
  let o = r - t;
  for (; o > Math.PI; ) o -= 2 * Math.PI;
  for (; o < -Math.PI; ) o += 2 * Math.PI;
  for (let s = 0; s <= i; s++) {
    const g = t + o * s / i;
    a.push({
      x: n.x + e * Math.cos(g),
      y: n.y + e * Math.sin(g),
      z: n.z
    });
  }
  return a;
}
class S {
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
    const { wheelbase: t, trackWidth: r, overhangFront: i } = this.vehicle;
    return e + (t / 2 + r / 2 + i);
  }
  /**
   * Внутренний радиус поворота (AutoTURN формула)
   * R_inner = R - (wheelbase/2 + trackWidth/2)
   */
  innerRadius(e) {
    const { wheelbase: t, trackWidth: r } = this.vehicle;
    return Math.max(0.1, e - (t / 2 + r / 2));
  }
  /**
   * Расчёт коридора для одного прямого сегмента трассы
   */
  straightSegmentCorridor(e) {
    const t = W(e.start, e.end), r = this.straightWidth / 2, i = [
      w(e.start, t, r),
      w(e.end, t, r)
    ], a = [
      w(e.start, t, -r),
      w(e.end, t, -r)
    ];
    return { outer: i, inner: a };
  }
  /**
   * Расчёт коридора для дугового сегмента трассы
   */
  arcSegmentCorridor(e) {
    if (!e.center || !e.radius)
      throw new Error("Дуговой сегмент должен содержать center и radius");
    const t = e.radius, r = e.direction === "right", i = this.outerRadius(t), a = this.innerRadius(t), o = W(e.center, e.start), s = W(e.center, e.end), g = r ? i : a, l = r ? a : i, d = I(e.center, g, o, s), k = I(e.center, l, o, s);
    return { outer: d, inner: k };
  }
  /**
   * Расчёт полного коридора движения по трассе
   */
  calculateCorridor(e) {
    const t = [], r = [];
    for (const a of e.segments) {
      let o, s;
      a.type === "straight" ? { outer: o, inner: s } = this.straightSegmentCorridor(a) : { outer: o, inner: s } = this.arcSegmentCorridor(a), t.length > 0 && (o.shift(), s.shift()), t.push(...o), r.push(...s);
    }
    const i = this.vehicle.minTurningRadius;
    return {
      outerRadius: this.outerRadius(i),
      innerRadius: this.innerRadius(i),
      straightWidth: this.straightWidth,
      outerPolyline: t,
      innerPolyline: r
    };
  }
}
function T(n) {
  var e, t, r, i, a, o, s;
  const g = [];
  let l = 0;
  const d = ((r = (t = (e = n == null ? void 0 : n.IsDecomposedBy) == null ? void 0 : e[0]) == null ? void 0 : t.RelatedObjects) == null ? void 0 : r.find(
    (y) => (y == null ? void 0 : y.type) === "IfcAlignmentHorizontal"
  )) ?? n, k = ((a = (i = d == null ? void 0 : d.IsDecomposedBy) == null ? void 0 : i[0]) == null ? void 0 : a.RelatedObjects) ?? [];
  for (const y of k) {
    const u = y == null ? void 0 : y.DesignParameters;
    if (u && u.type === "IfcAlignmentHorizontalSegment") {
      const R = { x: ((o = u.StartPoint) == null ? void 0 : o.x) ?? 0, y: ((s = u.StartPoint) == null ? void 0 : s.y) ?? 0, z: 0 }, p = u.SegmentLength ?? 10;
      if (u.PredefinedType === "LINE") {
        const c = u.StartDirection ?? 0, f = {
          x: R.x + p * Math.cos(c),
          y: R.y + p * Math.sin(c),
          z: 0
        };
        g.push({ type: "straight", start: R, end: f, length: p });
      } else if (u.PredefinedType === "CIRCULARARC") {
        const c = u.Radius ?? 10, f = u.IsCCW ? "left" : "right", m = u.StartDirection ?? 0, v = f === "left" ? 1 : -1, b = {
          x: R.x + c * Math.cos(m + v * Math.PI / 2),
          y: R.y + c * Math.sin(m + v * Math.PI / 2),
          z: 0
        }, h = p / c, P = m - v * Math.PI / 2 + v * h, L = {
          x: b.x + c * Math.cos(P),
          y: b.y + c * Math.sin(P),
          z: 0
        };
        g.push({ type: "arc", start: R, end: L, length: p, radius: c, direction: f, center: b });
      }
      l += p;
    }
  }
  return g.length === 0 && (g.push(
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
  ), l = 75.7), { ifcId: (n == null ? void 0 : n.GlobalId) ?? "demo", segments: g, totalLength: l };
}
const F = 3, z = 1;
function x(n) {
  return [n.x, n.y, 0];
}
async function O(n, e, t, r, i) {
  var a, o, s, g;
  const l = [];
  let d = null;
  try {
    d = (g = (s = (o = (a = n == null ? void 0 : n.model) == null ? void 0 : a.layouts) == null ? void 0 : o.model) == null ? void 0 : s.editor) == null ? void 0 : g.call(s), d ? l.push("editor: OK через app.model") : l.push("editor: null через app.model");
  } catch (h) {
    l.push(`editor error: ${h}`);
  }
  if (!d)
    return l.push("Доступные ключи app.model: " + Object.keys((n == null ? void 0 : n.model) ?? {}).join(", ")), l;
  e.outerPolyline.length > 1 && (await d.addPolyline({
    color: F,
    vertices: e.outerPolyline.map(x),
    width: 0.5,
    flags: 0
  }), l.push(`Внешний контур: ${e.outerPolyline.length} точек`)), e.innerPolyline.length > 1 && (await d.addPolyline({
    color: F,
    vertices: e.innerPolyline.map(x),
    width: 0.5,
    flags: 0
  }), l.push(`Внутренний контур: ${e.innerPolyline.length} точек`));
  const k = e.outerPolyline, y = e.innerPolyline, u = Math.min(k.length, y.length) - 1;
  for (let h = 0; h < u; h++)
    await d.addSolid({
      color: F,
      a: x(k[h]),
      b: x(k[h + 1]),
      c: x(y[h]),
      d: x(y[h + 1])
    });
  l.push(`Заливка: ${u} солидов`);
  const R = Math.cos(i), p = Math.sin(i), c = t.totalLength, f = t.trackWidth, m = t.overhangFront;
  function v(h, P) {
    return [
      r.x + h * R - P * p,
      r.y + h * p + P * R,
      0
    ];
  }
  const b = [
    v(-m, -f / 2),
    v(c - m, -f / 2),
    v(c - m, f / 2),
    v(-m, f / 2)
  ];
  return await d.addPolyline({ color: z, vertices: b, width: 0.3, flags: 1 }), await d.addSolid({ color: z, a: b[0], b: b[1], c: b[3], d: b[2] }), await d.addLine({
    color: z,
    a: [r.x, r.y, 0],
    b: v(c - m, 0)
  }), l.push("ТС отрисовано"), l;
}
const _ = {
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
      async execute(e, t, r, i) {
        var a, o;
        const s = e.model, g = Object.keys(e).join(", "), l = s ? Object.keys(s).join(", ") : "нет", d = s != null && s.layouts ? Object.keys(s.layouts).join(", ") : "нет", k = !!((o = (a = s == null ? void 0 : s.layouts) == null ? void 0 : a.model) != null && o.editor);
        if (r.set("debug-ctx", [{
          message: n.tr("app keys: {0}", g),
          severity: 2
        }]), r.set("debug-model", [{
          message: n.tr("model keys: {0}", l),
          severity: 2
        }]), r.set("debug-layouts", [{
          message: n.tr("layouts keys: {0} | hasEditor: {1}", d, String(k)),
          severity: 2
        }]), !s) {
          r.set("error", [{
            message: n.tr("Модель не загружена"),
            severity: 0
          }]);
          return;
        }
        let y;
        t.vehiclePreset === "custom" ? y = {
          name: "Пользовательское ТС",
          wheelbase: t.customWheelbase,
          trackWidth: t.customTrackWidth,
          overhangFront: t.customOverhangFront,
          overhangRear: t.customOverhangRear,
          minTurningRadius: t.customTurningRadius,
          totalLength: t.customWheelbase + t.customOverhangFront + t.customOverhangRear
        } : y = M[t.vehiclePreset];
        const u = s.filterLayers(t.filter, !0);
        if (r.set("debug-layers", [{
          message: n.tr("layers.size = {0}", String(u.size)),
          severity: 2
        }]), u.size === 0) {
          r.set("no-alignment", [{
            message: n.tr("Трассы не найдены. Проверьте фильтр трассы."),
            severity: 1
          }]);
          return;
        }
        const R = [...u][0], p = T(R), c = new S(y).calculateCorridor(p), f = p.segments[0], m = f.start, v = f.end, b = Math.atan2(v.y - m.y, v.x - m.x);
        let h = [];
        try {
          h = await O(e, c, y, m, b);
        } catch (P) {
          h = [`ОШИБКА: ${P}`];
        }
        r.set("debug-draw", [{
          message: n.tr("Отрисовка: {0}", h.join(" | ")),
          severity: 2
        }]), r.set("result", [{
          message: n.tr(
            "Коридор построен. ТС: {0}. Ширина: {1} м. R внешний: {2} м. R внутренний: {3} м.",
            y.name,
            c.straightWidth.toFixed(2),
            c.outerRadius.toFixed(2),
            c.innerRadius.toFixed(2)
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
            var t;
            const r = (t = e[0]) == null ? void 0 : t.vehiclePreset, i = r !== "custom" ? M[r] : null;
            return { label: (i == null ? void 0 : i.name) ?? "Пользовательский" };
          },
          editor() {
            return {
              type: "editbox",
              buttons: [{ label: "...", icon: "directions_car" }],
              async onDidTriggerItemButton() {
                const t = [
                  { key: "passenger_car", label: "Легковой автомобиль", description: "L=4.5м, R=5.5м" },
                  { key: "truck_16m", label: "Грузовик 16 м", description: "L=16м, R=9.0м" },
                  { key: "truck_20m", label: "Грузовик 20 м", description: "L=20м, R=12.0м" },
                  { key: "bus_12m", label: "Автобус 12 м", description: "L=12м, R=10.5м" },
                  { key: "bus_articulated", label: "Автобус сочленённый 18 м", description: "L=18м, R=11.5м" },
                  { key: "custom", label: "Пользовательский...", description: "Задать параметры вручную" }
                ], r = await n.showQuickPick(t, {
                  placeHolder: "Выберите тип транспортного средства"
                });
                for (const i of e)
                  try {
                    if (i.vehiclePreset = r.key, r.key !== "custom") {
                      const a = M[r.key];
                      i.customWheelbase = a.wheelbase, i.customTrackWidth = a.trackWidth, i.customOverhangFront = a.overhangFront, i.customOverhangRear = a.overhangRear, i.customTurningRadius = a.minTurningRadius;
                    }
                  } catch (a) {
                    console.error(a);
                  }
              },
              commit(t) {
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
        const t = n.field;
        return t ? [{
          id: `vehicletrack-${String(t)}`,
          label: n.label ?? String(t),
          description: n.description,
          group: n.group,
          value() {
            var r;
            const i = (r = e[0]) == null ? void 0 : r[t];
            for (let a = 1; a < e.length; a++)
              if (e[a][t] !== i)
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
                  for (const a of e)
                    try {
                      a[t] = i;
                    } catch (o) {
                      console.error(o);
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
  _ as default
};
