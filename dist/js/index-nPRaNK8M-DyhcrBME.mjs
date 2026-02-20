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
function R(n, t, e) {
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
  let o = r - e;
  for (; o > Math.PI; ) o -= 2 * Math.PI;
  for (; o < -Math.PI; ) o += 2 * Math.PI;
  for (let s = 0; s <= i; s++) {
    const u = e + o * s / i;
    a.push({
      x: n.x + t * Math.cos(u),
      y: n.y + t * Math.sin(u),
      z: n.z
    });
  }
  return a;
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
      R(t.start, e, r),
      R(t.end, e, r)
    ], a = [
      R(t.start, e, -r),
      R(t.end, e, -r)
    ];
    return { outer: i, inner: a };
  }
  /**
   * Расчёт коридора для дугового сегмента трассы
   */
  arcSegmentCorridor(t) {
    if (!t.center || !t.radius)
      throw new Error("Дуговой сегмент должен содержать center и radius");
    const e = t.radius, r = t.direction === "right", i = this.outerRadius(e), a = this.innerRadius(e), o = P(t.center, t.start), s = P(t.center, t.end), u = r ? i : a, g = r ? a : i, d = F(t.center, u, o, s), p = F(t.center, g, o, s);
    return { outer: d, inner: p };
  }
  /**
   * Расчёт полного коридора движения по трассе
   */
  calculateCorridor(t) {
    const e = [], r = [];
    for (const a of t.segments) {
      let o, s;
      a.type === "straight" ? { outer: o, inner: s } = this.straightSegmentCorridor(a) : { outer: o, inner: s } = this.arcSegmentCorridor(a), e.length > 0 && (o.shift(), s.shift()), e.push(...o), r.push(...s);
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
function w(n) {
  var t, e, r, i, a, o, s;
  const u = [];
  let g = 0;
  const d = ((r = (e = (t = n == null ? void 0 : n.IsDecomposedBy) == null ? void 0 : t[0]) == null ? void 0 : e.RelatedObjects) == null ? void 0 : r.find(
    (v) => (v == null ? void 0 : v.type) === "IfcAlignmentHorizontal"
  )) ?? n, p = ((a = (i = d == null ? void 0 : d.IsDecomposedBy) == null ? void 0 : i[0]) == null ? void 0 : a.RelatedObjects) ?? [];
  for (const v of p) {
    const l = v == null ? void 0 : v.DesignParameters;
    if (l && l.type === "IfcAlignmentHorizontalSegment") {
      const c = { x: ((o = l.StartPoint) == null ? void 0 : o.x) ?? 0, y: ((s = l.StartPoint) == null ? void 0 : s.y) ?? 0, z: 0 }, m = l.SegmentLength ?? 10;
      if (l.PredefinedType === "LINE") {
        const h = l.StartDirection ?? 0, y = {
          x: c.x + m * Math.cos(h),
          y: c.y + m * Math.sin(h),
          z: 0
        };
        u.push({ type: "straight", start: c, end: y, length: m });
      } else if (l.PredefinedType === "CIRCULARARC") {
        const h = l.Radius ?? 10, y = l.IsCCW ? "left" : "right", b = l.StartDirection ?? 0, f = y === "left" ? 1 : -1, k = {
          x: c.x + h * Math.cos(b + f * Math.PI / 2),
          y: c.y + h * Math.sin(b + f * Math.PI / 2),
          z: 0
        }, W = m / h, I = b - f * Math.PI / 2 + f * W, M = {
          x: k.x + h * Math.cos(I),
          y: k.y + h * Math.sin(I),
          z: 0
        };
        u.push({ type: "arc", start: c, end: M, length: m, radius: h, direction: y, center: k });
      }
      g += m;
    }
  }
  return u.length === 0 && (u.push(
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
  ), g = 75.7), { ifcId: (n == null ? void 0 : n.GlobalId) ?? "demo", segments: u, totalLength: g };
}
const L = {
  vehicletrack(n) {
    return {
      async createRule() {
        return {
          vehiclePreset: "truck_16m",
          customWheelbase: 5.5,
          customTrackWidth: 2.5,
          customOverhangFront: 1.2,
          customOverhangRear: 1.5,
          customTurningRadius: 9
        };
      },
      async execute(t, e, r, i) {
        var a, o, s;
        const u = t.model;
        if (!u) {
          r.set("error", [{
            message: n.tr("Модель не загружена"),
            severity: 1
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
        } : g = x[e.vehiclePreset];
        const d = [];
        if ((s = (o = (a = u.layouts) == null ? void 0 : a.model) == null ? void 0 : o.walk) == null || s.call(o, (c) => (((c == null ? void 0 : c.type) === "IfcAlignment" || (c == null ? void 0 : c.ifcType) === "IFCALIGNMENT") && d.push(c), !1)), d.length === 0) {
          r.set("no-alignment", [{
            message: n.tr("Трассы (IfcAlignment) не найдены в модели"),
            severity: 1
          }]);
          return;
        }
        let p = d[0];
        if (d.length > 1) {
          const c = d.map((h, y) => ({
            key: String(y),
            label: h.Name ?? h.GlobalId ?? `Трасса ${y + 1}`,
            description: `Длина: ${(h.TotalLength ?? 0).toFixed(1)} м`
          })), m = await n.showQuickPick(c, {
            placeHolder: n.tr("Выберите трассу для расчёта коридора")
          });
          p = d[parseInt(m.key)];
        }
        const v = w(p), l = new T(g).calculateCorridor(v);
        r.set("result", [{
          message: n.tr(
            "Коридор построен. ТС: {0}. Ширина прямой: {1} м. R внешний: {2} м. R внутренний: {3} м.",
            g.name,
            l.straightWidth.toFixed(2),
            l.outerRadius.toFixed(2),
            l.innerRadius.toFixed(2)
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
  L as default
};
//# sourceMappingURL=index-nPRaNK8M-DyhcrBME.mjs.map
