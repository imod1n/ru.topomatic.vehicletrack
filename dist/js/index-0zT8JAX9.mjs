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
function w(o, t, e) {
  return {
    x: o.x + e * Math.cos(t + Math.PI / 2),
    y: o.y + e * Math.sin(t + Math.PI / 2),
    z: o.z
  };
}
function F(o, t) {
  return Math.atan2(t.y - o.y, t.x - o.x);
}
function z(o, t, e, r, s = 32) {
  const n = [];
  let i = r - e;
  for (; i > Math.PI; ) i -= 2 * Math.PI;
  for (; i < -Math.PI; ) i += 2 * Math.PI;
  for (let a = 0; a <= s; a++) {
    const d = e + i * a / s;
    n.push({
      x: o.x + t * Math.cos(d),
      y: o.y + t * Math.sin(d),
      z: o.z
    });
  }
  return n;
}
class T {
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
    const { wheelbase: e, trackWidth: r, overhangFront: s } = this.vehicle;
    return t + (e / 2 + r / 2 + s);
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
    const e = F(t.start, t.end), r = this.straightWidth / 2, s = [
      w(t.start, e, r),
      w(t.end, e, r)
    ], n = [
      w(t.start, e, -r),
      w(t.end, e, -r)
    ];
    return { outer: s, inner: n };
  }
  /**
   * Расчёт коридора для дугового сегмента трассы
   */
  arcSegmentCorridor(t) {
    if (!t.center || !t.radius)
      throw new Error("Дуговой сегмент должен содержать center и radius");
    const e = t.radius, r = t.direction === "right", s = this.outerRadius(e), n = this.innerRadius(e), i = F(t.center, t.start), a = F(t.center, t.end), d = r ? s : n, p = r ? n : s, g = z(t.center, d, i, a), R = z(t.center, p, i, a);
    return { outer: g, inner: R };
  }
  /**
   * Расчёт полного коридора движения по трассе
   */
  calculateCorridor(t) {
    const e = [], r = [];
    for (const n of t.segments) {
      let i, a;
      n.type === "straight" ? { outer: i, inner: a } = this.straightSegmentCorridor(n) : { outer: i, inner: a } = this.arcSegmentCorridor(n), e.length > 0 && (i.shift(), a.shift()), e.push(...i), r.push(...a);
    }
    const s = this.vehicle.minTurningRadius;
    return {
      outerRadius: this.outerRadius(s),
      innerRadius: this.innerRadius(s),
      straightWidth: this.straightWidth,
      outerPolyline: e,
      innerPolyline: r
    };
  }
}
function C(o) {
  var n, i, a, d, p, g, R;
  const t = [];
  let e = 0;
  const r = ((a = (i = (n = o == null ? void 0 : o.IsDecomposedBy) == null ? void 0 : n[0]) == null ? void 0 : i.RelatedObjects) == null ? void 0 : a.find(
    (y) => (y == null ? void 0 : y.type) === "IfcAlignmentHorizontal"
  )) ?? o, s = ((p = (d = r == null ? void 0 : r.IsDecomposedBy) == null ? void 0 : d[0]) == null ? void 0 : p.RelatedObjects) ?? [];
  for (const y of s) {
    const c = y == null ? void 0 : y.DesignParameters;
    if (c && c.type === "IfcAlignmentHorizontalSegment") {
      const m = { x: ((g = c.StartPoint) == null ? void 0 : g.x) ?? 0, y: ((R = c.StartPoint) == null ? void 0 : R.y) ?? 0, z: 0 }, h = c.SegmentLength ?? 10;
      if (c.PredefinedType === "LINE") {
        const l = c.StartDirection ?? 0, f = {
          x: m.x + h * Math.cos(l),
          y: m.y + h * Math.sin(l),
          z: 0
        };
        t.push({ type: "straight", start: m, end: f, length: h });
      } else if (c.PredefinedType === "CIRCULARARC") {
        const l = c.Radius ?? 10, f = c.IsCCW ? "left" : "right", k = c.StartDirection ?? 0, v = f === "left" ? 1 : -1, P = {
          x: m.x + l * Math.cos(k + v * Math.PI / 2),
          y: m.y + l * Math.sin(k + v * Math.PI / 2),
          z: 0
        }, u = h / l, b = k - v * Math.PI / 2 + v * u, W = {
          x: P.x + l * Math.cos(b),
          y: P.y + l * Math.sin(b),
          z: 0
        };
        t.push({ type: "arc", start: m, end: W, length: h, radius: l, direction: f, center: P });
      }
      e += h;
    }
  }
  return t.length === 0 && (t.push(
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
  ), e = 75.7), { ifcId: (o == null ? void 0 : o.GlobalId) ?? "demo", segments: t, totalLength: e };
}
const L = 3, I = 1;
function x(o) {
  return [o.x, o.y, 0];
}
async function S(o, t, e, r, s) {
  var f, k, v, P;
  const n = [];
  let i = null;
  try {
    i = (P = (v = (k = (f = o == null ? void 0 : o.model) == null ? void 0 : f.layouts) == null ? void 0 : k.model) == null ? void 0 : v.editor) == null ? void 0 : P.call(v), i ? n.push("editor: OK через app.model") : n.push("editor: null через app.model");
  } catch (u) {
    n.push(`editor error: ${u}`);
  }
  if (!i)
    return n.push("Доступные ключи app.model: " + Object.keys((o == null ? void 0 : o.model) ?? {}).join(", ")), n;
  t.outerPolyline.length > 1 && (await i.addPolyline({
    color: L,
    vertices: t.outerPolyline.map(x),
    width: 0.5,
    flags: 0
  }), n.push(`Внешний контур: ${t.outerPolyline.length} точек`)), t.innerPolyline.length > 1 && (await i.addPolyline({
    color: L,
    vertices: t.innerPolyline.map(x),
    width: 0.5,
    flags: 0
  }), n.push(`Внутренний контур: ${t.innerPolyline.length} точек`));
  const a = t.outerPolyline, d = t.innerPolyline, p = Math.min(a.length, d.length) - 1;
  for (let u = 0; u < p; u++)
    await i.addSolid({
      color: L,
      a: x(a[u]),
      b: x(a[u + 1]),
      c: x(d[u]),
      d: x(d[u + 1])
    });
  n.push(`Заливка: ${p} солидов`);
  const g = Math.cos(s), R = Math.sin(s), y = e.totalLength, c = e.trackWidth, m = e.overhangFront;
  function h(u, b) {
    return [
      r.x + u * g - b * R,
      r.y + u * R + b * g,
      0
    ];
  }
  const l = [
    h(-m, -c / 2),
    h(y - m, -c / 2),
    h(y - m, c / 2),
    h(-m, c / 2)
  ];
  return await i.addPolyline({ color: I, vertices: l, width: 0.3, flags: 1 }), await i.addSolid({ color: I, a: l[0], b: l[1], c: l[3], d: l[2] }), await i.addLine({
    color: I,
    a: [r.x, r.y, 0],
    b: h(y - m, 0)
  }), n.push("ТС отрисовано"), n;
}
const _ = {
  vehicletrack(o) {
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
      async execute(t, e, r, s) {
        var u, b;
        const n = t.model, i = Object.keys(t).join(", "), a = n ? Object.keys(n).join(", ") : "нет", d = n != null && n.layouts ? Object.keys(n.layouts).join(", ") : "нет", p = !!((b = (u = n == null ? void 0 : n.layouts) == null ? void 0 : u.model) != null && b.editor);
        if (r.set("debug-ctx", [{
          message: o.tr("app keys: {0}", i),
          severity: 2
        }]), r.set("debug-model", [{
          message: o.tr("model keys: {0}", a),
          severity: 2
        }]), r.set("debug-layouts", [{
          message: o.tr("layouts keys: {0} | hasEditor: {1}", d, String(p)),
          severity: 2
        }]), !n) {
          r.set("error", [{
            message: o.tr("Модель не загружена"),
            severity: 0
          }]);
          return;
        }
        let g;
        e.vehiclePreset === "custom" ? g = {
          name: "Пользовательское ТС",
          wheelbase: e.customWheelbase,
          trackWidth: e.customTrackWidth,
          overhangFront: e.customOverhangFront,
          overhangRear: e.customOverhangRear,
          minTurningRadius: e.customTurningRadius,
          totalLength: e.customWheelbase + e.customOverhangFront + e.customOverhangRear
        } : g = M[e.vehiclePreset];
        const R = n.filterLayers(e.filter, !0);
        if (r.set("debug-layers", [{
          message: o.tr("layers.size = {0}", String(R.size)),
          severity: 2
        }]), R.size === 0) {
          r.set("no-alignment", [{
            message: o.tr("Трассы не найдены. Проверьте фильтр трассы."),
            severity: 1
          }]);
          return;
        }
        const y = [...R][0], c = C(y), h = new T(g).calculateCorridor(c), l = c.segments[0], f = l.start, k = l.end, v = Math.atan2(k.y - f.y, k.x - f.x);
        let P = [];
        try {
          P = await S(t, h, g, f, v);
        } catch (W) {
          P = [`ОШИБКА: ${W}`];
        }
        r.set("debug-draw", [{
          message: o.tr("Отрисовка: {0}", P.join(" | ")),
          severity: 2
        }]), r.set("result", [{
          message: o.tr(
            "Коридор построен. ТС: {0}. Ширина: {1} м. R внешний: {2} м. R внутренний: {3} м.",
            g.name,
            h.straightWidth.toFixed(2),
            h.outerRadius.toFixed(2),
            h.innerRadius.toFixed(2)
          ),
          severity: 4
        }]);
      }
    };
  },
  "property:vehiclePreset"(o) {
    return {
      getProperties(t) {
        return [{
          id: "vehicletrack-preset",
          label: o.label ?? "Тип транспортного средства",
          description: o.description,
          group: o.group,
          value() {
            var s;
            const e = (s = t[0]) == null ? void 0 : s.vehiclePreset, r = e !== "custom" ? M[e] : null;
            return { label: (r == null ? void 0 : r.name) ?? "Пользовательский" };
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
                ], r = await o.showQuickPick(e, {
                  placeHolder: "Выберите тип транспортного средства"
                });
                for (const s of t)
                  try {
                    if (s.vehiclePreset = r.key, r.key !== "custom") {
                      const n = M[r.key];
                      s.customWheelbase = n.wheelbase, s.customTrackWidth = n.trackWidth, s.customOverhangFront = n.overhangFront, s.customOverhangRear = n.overhangRear, s.customTurningRadius = n.minTurningRadius;
                    }
                  } catch (n) {
                    console.error(n);
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
  "property:numericParam"(o) {
    return {
      getProperties(t) {
        const e = o.field;
        return e ? [{
          id: `vehicletrack-${String(e)}`,
          label: o.label ?? String(e),
          description: o.description,
          group: o.group,
          value() {
            var s;
            const r = (s = t[0]) == null ? void 0 : s[e];
            for (let n = 1; n < t.length; n++)
              if (t[n][e] !== r)
                return { label: "**Различные**", suffix: "м" };
            return { label: String(r), suffix: "м" };
          },
          editor() {
            return {
              type: "editbox",
              commit(r) {
                if (!r) return;
                const s = parseFloat(r);
                if (!(!isFinite(s) || s <= 0))
                  for (const n of t)
                    try {
                      n[e] = s;
                    } catch (i) {
                      console.error(i);
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
