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
function w(i, t, e) {
  return {
    x: i.x + e * Math.cos(t + Math.PI / 2),
    y: i.y + e * Math.sin(t + Math.PI / 2),
    z: i.z
  };
}
function W(i, t) {
  return Math.atan2(t.y - i.y, t.x - i.x);
}
function I(i, t, e, r, n = 32) {
  const a = [];
  let s = r - e;
  for (; s > Math.PI; ) s -= 2 * Math.PI;
  for (; s < -Math.PI; ) s += 2 * Math.PI;
  for (let o = 0; o <= n; o++) {
    const g = e + s * o / n;
    a.push({
      x: i.x + t * Math.cos(g),
      y: i.y + t * Math.sin(g),
      z: i.z
    });
  }
  return a;
}
class S {
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
    const { wheelbase: e, trackWidth: r, overhangFront: n } = this.vehicle;
    return t + (e / 2 + r / 2 + n);
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
    const e = W(t.start, t.end), r = this.straightWidth / 2, n = [
      w(t.start, e, r),
      w(t.end, e, r)
    ], a = [
      w(t.start, e, -r),
      w(t.end, e, -r)
    ];
    return { outer: n, inner: a };
  }
  /**
   * Расчёт коридора для дугового сегмента трассы
   */
  arcSegmentCorridor(t) {
    if (!t.center || !t.radius)
      throw new Error("Дуговой сегмент должен содержать center и radius");
    const e = t.radius, r = t.direction === "right", n = this.outerRadius(e), a = this.innerRadius(e), s = W(t.center, t.start), o = W(t.center, t.end), g = r ? n : a, l = r ? a : n, d = I(t.center, g, s, o), k = I(t.center, l, s, o);
    return { outer: d, inner: k };
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
    const n = this.vehicle.minTurningRadius;
    return {
      outerRadius: this.outerRadius(n),
      innerRadius: this.innerRadius(n),
      straightWidth: this.straightWidth,
      outerPolyline: e,
      innerPolyline: r
    };
  }
}
function T(i) {
  var t, e, r, n, a, s, o;
  const g = [];
  let l = 0;
  const d = ((r = (e = (t = i == null ? void 0 : i.IsDecomposedBy) == null ? void 0 : t[0]) == null ? void 0 : e.RelatedObjects) == null ? void 0 : r.find(
    (y) => (y == null ? void 0 : y.type) === "IfcAlignmentHorizontal"
  )) ?? i, k = ((a = (n = d == null ? void 0 : d.IsDecomposedBy) == null ? void 0 : n[0]) == null ? void 0 : a.RelatedObjects) ?? [];
  for (const y of k) {
    const u = y == null ? void 0 : y.DesignParameters;
    if (u && u.type === "IfcAlignmentHorizontalSegment") {
      const b = { x: ((s = u.StartPoint) == null ? void 0 : s.x) ?? 0, y: ((o = u.StartPoint) == null ? void 0 : o.y) ?? 0, z: 0 }, p = u.SegmentLength ?? 10;
      if (u.PredefinedType === "LINE") {
        const c = u.StartDirection ?? 0, f = {
          x: b.x + p * Math.cos(c),
          y: b.y + p * Math.sin(c),
          z: 0
        };
        g.push({ type: "straight", start: b, end: f, length: p });
      } else if (u.PredefinedType === "CIRCULARARC") {
        const c = u.Radius ?? 10, f = u.IsCCW ? "left" : "right", m = u.StartDirection ?? 0, v = f === "left" ? 1 : -1, R = {
          x: b.x + c * Math.cos(m + v * Math.PI / 2),
          y: b.y + c * Math.sin(m + v * Math.PI / 2),
          z: 0
        }, h = p / c, x = m - v * Math.PI / 2 + v * h, L = {
          x: R.x + c * Math.cos(x),
          y: R.y + c * Math.sin(x),
          z: 0
        };
        g.push({ type: "arc", start: b, end: L, length: p, radius: c, direction: f, center: R });
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
  ), l = 75.7), { ifcId: (i == null ? void 0 : i.GlobalId) ?? "demo", segments: g, totalLength: l };
}
const F = 3, z = 1;
function P(i) {
  return [i.x, i.y, 0];
}
async function O(i, t, e, r, n) {
  var a, s, o, g;
  const l = [];
  let d = null;
  try {
    d = (g = (o = (s = (a = i == null ? void 0 : i.model) == null ? void 0 : a.layouts) == null ? void 0 : s.model) == null ? void 0 : o.editor) == null ? void 0 : g.call(o), d ? l.push("editor: OK через app.model") : l.push("editor: null через app.model");
  } catch (h) {
    l.push(`editor error: ${h}`);
  }
  if (!d)
    return l.push("Доступные ключи app.model: " + Object.keys((i == null ? void 0 : i.model) ?? {}).join(", ")), l;
  t.outerPolyline.length > 1 && (await d.addPolyline({
    color: F,
    vertices: t.outerPolyline.map(P),
    width: 0.5,
    flags: 0
  }), l.push(`Внешний контур: ${t.outerPolyline.length} точек`)), t.innerPolyline.length > 1 && (await d.addPolyline({
    color: F,
    vertices: t.innerPolyline.map(P),
    width: 0.5,
    flags: 0
  }), l.push(`Внутренний контур: ${t.innerPolyline.length} точек`));
  const k = t.outerPolyline, y = t.innerPolyline, u = Math.min(k.length, y.length) - 1;
  for (let h = 0; h < u; h++)
    await d.addSolid({
      color: F,
      a: P(k[h]),
      b: P(k[h + 1]),
      c: P(y[h]),
      d: P(y[h + 1])
    });
  l.push(`Заливка: ${u} солидов`);
  const b = Math.cos(n), p = Math.sin(n), c = e.totalLength, f = e.trackWidth, m = e.overhangFront;
  function v(h, x) {
    return [
      r.x + h * b - x * p,
      r.y + h * p + x * b,
      0
    ];
  }
  const R = [
    v(-m, -f / 2),
    v(c - m, -f / 2),
    v(c - m, f / 2),
    v(-m, f / 2)
  ];
  return await d.addPolyline({ color: z, vertices: R, width: 0.3, flags: 1 }), await d.addSolid({ color: z, a: R[0], b: R[1], c: R[3], d: R[2] }), await d.addLine({
    color: z,
    a: [r.x, r.y, 0],
    b: v(c - m, 0)
  }), l.push("ТС отрисовано"), l;
}
const _ = {
  vehicletrack(i) {
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
      async execute(t, e, r, n) {
        var a, s;
        const o = t.model, g = Object.keys(t).join(", "), l = o ? Object.keys(o).join(", ") : "нет", d = o != null && o.layouts ? Object.keys(o.layouts).join(", ") : "нет", k = !!((s = (a = o == null ? void 0 : o.layouts) == null ? void 0 : a.model) != null && s.editor);
        if (r.set("debug-ctx", [{
          message: i.tr("app keys: {0}", g),
          severity: 2
        }]), r.set("debug-model", [{
          message: i.tr("model keys: {0}", l),
          severity: 2
        }]), r.set("debug-layouts", [{
          message: i.tr("layouts keys: {0} | hasEditor: {1}", d, String(k)),
          severity: 2
        }]), !o) {
          r.set("error", [{
            message: i.tr("Модель не загружена"),
            severity: 0
          }]);
          return;
        }
        let y;
        e.vehiclePreset === "custom" ? y = {
          name: "Пользовательское ТС",
          wheelbase: e.customWheelbase,
          trackWidth: e.customTrackWidth,
          overhangFront: e.customOverhangFront,
          overhangRear: e.customOverhangRear,
          minTurningRadius: e.customTurningRadius,
          totalLength: e.customWheelbase + e.customOverhangFront + e.customOverhangRear
        } : y = M[e.vehiclePreset];
        const u = o.filterLayers(e.filter, !0);
        if (r.set("debug-layers", [{
          message: i.tr("layers.size = {0}", String(u.size)),
          severity: 2
        }]), u.size === 0) {
          r.set("no-alignment", [{
            message: i.tr("Трассы не найдены. Проверьте фильтр трассы."),
            severity: 1
          }]);
          return;
        }
        const b = [...u][0], p = T(b), c = new S(y).calculateCorridor(p), f = p.segments[0], m = f.start, v = f.end, R = Math.atan2(v.y - m.y, v.x - m.x);
        let h = [];
        try {
          h = await O(t, c, y, m, R);
        } catch (x) {
          h = [`ОШИБКА: ${x}`];
        }
        r.set("debug-draw", [{
          message: i.tr("Отрисовка: {0}", h.join(" | ")),
          severity: 2
        }]), r.set("result", [{
          message: i.tr(
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
  "property:vehiclePreset"(i) {
    return {
      getProperties(t) {
        return [{
          id: "vehicletrack-preset",
          label: i.label ?? "Тип транспортного средства",
          description: i.description,
          group: i.group,
          value() {
            var e;
            const r = (e = t[0]) == null ? void 0 : e.vehiclePreset, n = r !== "custom" ? M[r] : null;
            return { label: (n == null ? void 0 : n.name) ?? "Пользовательский" };
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
                ], r = await i.showQuickPick(e, {
                  placeHolder: "Выберите тип транспортного средства"
                });
                for (const n of t)
                  try {
                    if (n.vehiclePreset = r.key, r.key !== "custom") {
                      const a = M[r.key];
                      n.customWheelbase = a.wheelbase, n.customTrackWidth = a.trackWidth, n.customOverhangFront = a.overhangFront, n.customOverhangRear = a.overhangRear, n.customTurningRadius = a.minTurningRadius;
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
  "property:numericParam"(i) {
    return {
      getProperties(t) {
        const e = i.field;
        return e ? [{
          id: `vehicletrack-${String(e)}`,
          label: i.label ?? String(e),
          description: i.description,
          group: i.group,
          value() {
            var r;
            const n = (r = t[0]) == null ? void 0 : r[e];
            for (let a = 1; a < t.length; a++)
              if (t[a][e] !== n)
                return { label: "**Различные**", suffix: "м" };
            return { label: String(n), suffix: "м" };
          },
          editor() {
            return {
              type: "editbox",
              commit(r) {
                if (!r) return;
                const n = parseFloat(r);
                if (!(!isFinite(n) || n <= 0))
                  for (const a of t)
                    try {
                      a[e] = n;
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
  _ as default
};
