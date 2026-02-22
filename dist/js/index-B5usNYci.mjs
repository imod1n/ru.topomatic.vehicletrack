const L = {
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
function F(r, t, n) {
  return {
    x: r.x + n * Math.cos(t + Math.PI / 2),
    y: r.y + n * Math.sin(t + Math.PI / 2),
    z: r.z
  };
}
function I(r, t) {
  return Math.atan2(t.y - r.y, t.x - r.x);
}
function A(r, t, n, o, s = 32) {
  const e = [];
  let i = o - n;
  for (; i > Math.PI; ) i -= 2 * Math.PI;
  for (; i < -Math.PI; ) i += 2 * Math.PI;
  for (let a = 0; a <= s; a++) {
    const y = n + i * a / s;
    e.push({
      x: r.x + t * Math.cos(y),
      y: r.y + t * Math.sin(y),
      z: r.z
    });
  }
  return e;
}
class $ {
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
    const { wheelbase: n, trackWidth: o, overhangFront: s } = this.vehicle;
    return t + (n / 2 + o / 2 + s);
  }
  /**
   * Внутренний радиус поворота (AutoTURN формула)
   * R_inner = R - (wheelbase/2 + trackWidth/2)
   */
  innerRadius(t) {
    const { wheelbase: n, trackWidth: o } = this.vehicle;
    return Math.max(0.1, t - (n / 2 + o / 2));
  }
  /**
   * Расчёт коридора для одного прямого сегмента трассы
   */
  straightSegmentCorridor(t) {
    const n = I(t.start, t.end), o = this.straightWidth / 2, s = [
      F(t.start, n, o),
      F(t.end, n, o)
    ], e = [
      F(t.start, n, -o),
      F(t.end, n, -o)
    ];
    return { outer: s, inner: e };
  }
  /**
   * Расчёт коридора для дугового сегмента трассы
   */
  arcSegmentCorridor(t) {
    if (!t.center || !t.radius)
      throw new Error("Дуговой сегмент должен содержать center и radius");
    const n = t.radius, o = t.direction === "right", s = this.outerRadius(n), e = this.innerRadius(n), i = I(t.center, t.start), a = I(t.center, t.end), y = o ? s : e, P = o ? e : s, g = A(t.center, y, i, a), v = A(t.center, P, i, a);
    return { outer: g, inner: v };
  }
  /**
   * Расчёт полного коридора движения по трассе
   */
  calculateCorridor(t) {
    const n = [], o = [];
    for (const e of t.segments) {
      let i, a;
      e.type === "straight" ? { outer: i, inner: a } = this.straightSegmentCorridor(e) : { outer: i, inner: a } = this.arcSegmentCorridor(e), n.length > 0 && (i.shift(), a.shift()), n.push(...i), o.push(...a);
    }
    const s = this.vehicle.minTurningRadius;
    return {
      outerRadius: this.outerRadius(s),
      innerRadius: this.innerRadius(s),
      straightWidth: this.straightWidth,
      outerPolyline: n,
      innerPolyline: o
    };
  }
}
function D(r) {
  var e, i, a, y, P, g, v;
  const t = [];
  let n = 0;
  const o = ((a = (i = (e = r == null ? void 0 : r.IsDecomposedBy) == null ? void 0 : e[0]) == null ? void 0 : i.RelatedObjects) == null ? void 0 : a.find(
    (m) => (m == null ? void 0 : m.type) === "IfcAlignmentHorizontal"
  )) ?? r, s = ((P = (y = o == null ? void 0 : o.IsDecomposedBy) == null ? void 0 : y[0]) == null ? void 0 : P.RelatedObjects) ?? [];
  for (const m of s) {
    const c = m == null ? void 0 : m.DesignParameters;
    if (c && c.type === "IfcAlignmentHorizontalSegment") {
      const R = { x: ((g = c.StartPoint) == null ? void 0 : g.x) ?? 0, y: ((v = c.StartPoint) == null ? void 0 : v.y) ?? 0, z: 0 }, h = c.SegmentLength ?? 10;
      if (c.PredefinedType === "LINE") {
        const l = c.StartDirection ?? 0, d = {
          x: R.x + h * Math.cos(l),
          y: R.y + h * Math.sin(l),
          z: 0
        };
        t.push({ type: "straight", start: R, end: d, length: h });
      } else if (c.PredefinedType === "CIRCULARARC") {
        const l = c.Radius ?? 10, d = c.IsCCW ? "left" : "right", k = c.StartDirection ?? 0, b = d === "left" ? 1 : -1, f = {
          x: R.x + l * Math.cos(k + b * Math.PI / 2),
          y: R.y + l * Math.sin(k + b * Math.PI / 2),
          z: 0
        }, x = h / l, p = k - b * Math.PI / 2 + b * x, w = {
          x: f.x + l * Math.cos(p),
          y: f.y + l * Math.sin(p),
          z: 0
        };
        t.push({ type: "arc", start: R, end: w, length: h, radius: l, direction: d, center: f });
      }
      n += h;
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
  ), n = 75.7), { ifcId: (r == null ? void 0 : r.GlobalId) ?? "demo", segments: t, totalLength: n };
}
const z = 3, T = 1;
function M(r) {
  return [r.x, r.y, 0];
}
async function K(r, t, n, o, s) {
  var k, b, f, x, p, w, C, S, _, W, O;
  const e = [];
  let i = null;
  try {
    i = (x = (f = (b = (k = r == null ? void 0 : r.model) == null ? void 0 : k.layouts) == null ? void 0 : b.model) == null ? void 0 : f.editor) == null ? void 0 : x.call(f), i ? e.push("editor: OK через app.model") : e.push("editor: null через app.model");
  } catch (u) {
    e.push(`editor error: ${u}`);
  }
  if (!i)
    return e.push("Доступные ключи app.model: " + Object.keys((r == null ? void 0 : r.model) ?? {}).join(", ")), e;
  e.push("editor keys: " + Object.keys(i).join(", "));
  const a = (w = (p = r == null ? void 0 : r.model) == null ? void 0 : p.layouts) == null ? void 0 : w.model;
  e.push("layout.model keys: " + Object.keys(a ?? {}).join(", ")), t.outerPolyline.length > 1 && (await i.addPolyline({
    color: z,
    vertices: t.outerPolyline.map(M),
    width: 0.5,
    flags: 0
  }), e.push(`Внешний контур: ${t.outerPolyline.length} точек`)), t.innerPolyline.length > 1 && (await i.addPolyline({
    color: z,
    vertices: t.innerPolyline.map(M),
    width: 0.5,
    flags: 0
  }), e.push(`Внутренний контур: ${t.innerPolyline.length} точек`));
  const y = t.outerPolyline, P = t.innerPolyline, g = Math.min(y.length, P.length) - 1;
  for (let u = 0; u < g; u++)
    await i.addSolid({
      color: z,
      a: M(y[u]),
      b: M(y[u + 1]),
      c: M(P[u]),
      d: M(P[u + 1])
    });
  e.push(`Заливка: ${g} солидов`);
  const v = Math.cos(s), m = Math.sin(s), c = n.totalLength, R = n.trackWidth, h = n.overhangFront;
  function l(u, E) {
    return [
      o.x + u * v - E * m,
      o.y + u * m + E * v,
      0
    ];
  }
  const d = [
    l(-h, -R / 2),
    l(c - h, -R / 2),
    l(c - h, R / 2),
    l(-h, R / 2)
  ];
  await i.addPolyline({ color: T, vertices: d, width: 0.3, flags: 1 }), await i.addSolid({ color: T, a: d[0], b: d[1], c: d[3], d: d[2] }), await i.addLine({
    color: T,
    a: [o.x, o.y, 0],
    b: l(c - h, 0)
  }), e.push("ТС отрисовано");
  try {
    await ((C = i.commit) == null ? void 0 : C.call(i)), e.push("commit: OK");
  } catch (u) {
    e.push(`commit: ${u}`);
  }
  try {
    (O = (W = (_ = (S = r == null ? void 0 : r.model) == null ? void 0 : S.layouts) == null ? void 0 : _.model) == null ? void 0 : W.update) == null || O.call(W), e.push("update: OK");
  } catch (u) {
    e.push(`update: ${u}`);
  }
  return e;
}
const H = {
  vehicletrack(r) {
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
      async execute(t, n, o, s) {
        var x, p;
        const e = t.model, i = Object.keys(t).join(", "), a = e ? Object.keys(e).join(", ") : "нет", y = e != null && e.layouts ? Object.keys(e.layouts).join(", ") : "нет", P = !!((p = (x = e == null ? void 0 : e.layouts) == null ? void 0 : x.model) != null && p.editor);
        if (o.set("debug-ctx", [{
          message: r.tr("app keys: {0}", i),
          severity: 2
        }]), o.set("debug-model", [{
          message: r.tr("model keys: {0}", a),
          severity: 2
        }]), o.set("debug-layouts", [{
          message: r.tr("layouts keys: {0} | hasEditor: {1}", y, String(P)),
          severity: 2
        }]), !e) {
          o.set("error", [{
            message: r.tr("Модель не загружена"),
            severity: 0
          }]);
          return;
        }
        let g;
        n.vehiclePreset === "custom" ? g = {
          name: "Пользовательское ТС",
          wheelbase: n.customWheelbase,
          trackWidth: n.customTrackWidth,
          overhangFront: n.customOverhangFront,
          overhangRear: n.customOverhangRear,
          minTurningRadius: n.customTurningRadius,
          totalLength: n.customWheelbase + n.customOverhangFront + n.customOverhangRear
        } : g = L[n.vehiclePreset];
        const v = e.filterLayers(n.filter, !0);
        if (o.set("debug-layers", [{
          message: r.tr("layers.size = {0}", String(v.size)),
          severity: 2
        }]), v.size === 0) {
          o.set("no-alignment", [{
            message: r.tr("Трассы не найдены. Проверьте фильтр трассы."),
            severity: 1
          }]);
          return;
        }
        const m = [...v][0], c = D(m), h = new $(g).calculateCorridor(c), l = c.segments[0], d = l.start, k = l.end, b = Math.atan2(k.y - d.y, k.x - d.x);
        let f = [];
        try {
          f = await K(t, h, g, d, b);
        } catch (w) {
          f = [`ОШИБКА: ${w}`];
        }
        o.set("debug-draw", [{
          message: r.tr("Отрисовка: {0}", f.join(" | ")),
          severity: 2
        }]), o.set("result", [{
          message: r.tr(
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
  "property:vehiclePreset"(r) {
    return {
      getProperties(t) {
        return [{
          id: "vehicletrack-preset",
          label: r.label ?? "Тип транспортного средства",
          description: r.description,
          group: r.group,
          value() {
            var s;
            const n = (s = t[0]) == null ? void 0 : s.vehiclePreset, o = n !== "custom" ? L[n] : null;
            return { label: (o == null ? void 0 : o.name) ?? "Пользовательский" };
          },
          editor() {
            return {
              type: "editbox",
              buttons: [{ label: "...", icon: "directions_car" }],
              async onDidTriggerItemButton() {
                const n = [
                  { key: "passenger_car", label: "Легковой автомобиль", description: "L=4.5м, R=5.5м" },
                  { key: "truck_16m", label: "Грузовик 16 м", description: "L=16м, R=9.0м" },
                  { key: "truck_20m", label: "Грузовик 20 м", description: "L=20м, R=12.0м" },
                  { key: "bus_12m", label: "Автобус 12 м", description: "L=12м, R=10.5м" },
                  { key: "bus_articulated", label: "Автобус сочленённый 18 м", description: "L=18м, R=11.5м" },
                  { key: "custom", label: "Пользовательский...", description: "Задать параметры вручную" }
                ], o = await r.showQuickPick(n, {
                  placeHolder: "Выберите тип транспортного средства"
                });
                for (const s of t)
                  try {
                    if (s.vehiclePreset = o.key, o.key !== "custom") {
                      const e = L[o.key];
                      s.customWheelbase = e.wheelbase, s.customTrackWidth = e.trackWidth, s.customOverhangFront = e.overhangFront, s.customOverhangRear = e.overhangRear, s.customTurningRadius = e.minTurningRadius;
                    }
                  } catch (e) {
                    console.error(e);
                  }
              },
              commit(n) {
              }
            };
          }
        }];
      }
    };
  },
  "property:numericParam"(r) {
    return {
      getProperties(t) {
        const n = r.field;
        return n ? [{
          id: `vehicletrack-${String(n)}`,
          label: r.label ?? String(n),
          description: r.description,
          group: r.group,
          value() {
            var s;
            const o = (s = t[0]) == null ? void 0 : s[n];
            for (let e = 1; e < t.length; e++)
              if (t[e][n] !== o)
                return { label: "**Различные**", suffix: "м" };
            return { label: String(o), suffix: "м" };
          },
          editor() {
            return {
              type: "editbox",
              commit(o) {
                if (!o) return;
                const s = parseFloat(o);
                if (!(!isFinite(s) || s <= 0))
                  for (const e of t)
                    try {
                      e[n] = s;
                    } catch (i) {
                      console.error(i);
                    }
              },
              validate(o) {
                if (!o) return "Поле не может быть пустым";
                if (!isFinite(parseFloat(o))) return "Введите число";
                if (parseFloat(o) <= 0) return "Значение должно быть больше 0";
              }
            };
          }
        }] : [];
      }
    };
  }
};
export {
  H as default
};
