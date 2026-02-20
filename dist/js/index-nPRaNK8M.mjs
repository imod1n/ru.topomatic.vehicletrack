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
function k(r, t, e) {
  return {
    x: r.x + e * Math.cos(t + Math.PI / 2),
    y: r.y + e * Math.sin(t + Math.PI / 2),
    z: r.z
  };
}
function b(r, t) {
  return Math.atan2(t.y - r.y, t.x - r.x);
}
function F(r, t, e, n, i = 32) {
  const a = [];
  let s = n - e;
  for (; s > Math.PI; ) s -= 2 * Math.PI;
  for (; s < -Math.PI; ) s += 2 * Math.PI;
  for (let o = 0; o <= i; o++) {
    const u = e + s * o / i;
    a.push({
      x: r.x + t * Math.cos(u),
      y: r.y + t * Math.sin(u),
      z: r.z
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
    const { wheelbase: e, trackWidth: n, overhangFront: i } = this.vehicle;
    return t + (e / 2 + n / 2 + i);
  }
  /**
   * Внутренний радиус поворота (AutoTURN формула)
   * R_inner = R - (wheelbase/2 + trackWidth/2)
   */
  innerRadius(t) {
    const { wheelbase: e, trackWidth: n } = this.vehicle;
    return Math.max(0.1, t - (e / 2 + n / 2));
  }
  /**
   * Расчёт коридора для одного прямого сегмента трассы
   */
  straightSegmentCorridor(t) {
    const e = b(t.start, t.end), n = this.straightWidth / 2, i = [
      k(t.start, e, n),
      k(t.end, e, n)
    ], a = [
      k(t.start, e, -n),
      k(t.end, e, -n)
    ];
    return { outer: i, inner: a };
  }
  /**
   * Расчёт коридора для дугового сегмента трассы
   */
  arcSegmentCorridor(t) {
    if (!t.center || !t.radius)
      throw new Error("Дуговой сегмент должен содержать center и radius");
    const e = t.radius, n = t.direction === "right", i = this.outerRadius(e), a = this.innerRadius(e), s = b(t.center, t.start), o = b(t.center, t.end), u = n ? i : a, p = n ? a : i, f = F(t.center, u, s, o), m = F(t.center, p, s, o);
    return { outer: f, inner: m };
  }
  /**
   * Расчёт полного коридора движения по трассе
   */
  calculateCorridor(t) {
    const e = [], n = [];
    for (const a of t.segments) {
      let s, o;
      a.type === "straight" ? { outer: s, inner: o } = this.straightSegmentCorridor(a) : { outer: s, inner: o } = this.arcSegmentCorridor(a), e.length > 0 && (s.shift(), o.shift()), e.push(...s), n.push(...o);
    }
    const i = this.vehicle.minTurningRadius;
    return {
      outerRadius: this.outerRadius(i),
      innerRadius: this.innerRadius(i),
      straightWidth: this.straightWidth,
      outerPolyline: e,
      innerPolyline: n
    };
  }
}
function w(r) {
  var a, s, o, u, p, f, m;
  const t = [];
  let e = 0;
  const n = ((o = (s = (a = r == null ? void 0 : r.IsDecomposedBy) == null ? void 0 : a[0]) == null ? void 0 : s.RelatedObjects) == null ? void 0 : o.find(
    (d) => (d == null ? void 0 : d.type) === "IfcAlignmentHorizontal"
  )) ?? r, i = ((p = (u = n == null ? void 0 : n.IsDecomposedBy) == null ? void 0 : u[0]) == null ? void 0 : p.RelatedObjects) ?? [];
  for (const d of i) {
    const c = d == null ? void 0 : d.DesignParameters;
    if (c && c.type === "IfcAlignmentHorizontalSegment") {
      const g = { x: ((f = c.StartPoint) == null ? void 0 : f.x) ?? 0, y: ((m = c.StartPoint) == null ? void 0 : m.y) ?? 0, z: 0 }, h = c.SegmentLength ?? 10;
      if (c.PredefinedType === "LINE") {
        const l = c.StartDirection ?? 0, y = {
          x: g.x + h * Math.cos(l),
          y: g.y + h * Math.sin(l),
          z: 0
        };
        t.push({ type: "straight", start: g, end: y, length: h });
      } else if (c.PredefinedType === "CIRCULARARC") {
        const l = c.Radius ?? 10, y = c.IsCCW ? "left" : "right", R = c.StartDirection ?? 0, v = y === "left" ? 1 : -1, P = {
          x: g.x + l * Math.cos(R + v * Math.PI / 2),
          y: g.y + l * Math.sin(R + v * Math.PI / 2),
          z: 0
        }, W = h / l, I = R - v * Math.PI / 2 + v * W, M = {
          x: P.x + l * Math.cos(I),
          y: P.y + l * Math.sin(I),
          z: 0
        };
        t.push({ type: "arc", start: g, end: M, length: h, radius: l, direction: y, center: P });
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
  ), e = 75.7), { ifcId: (r == null ? void 0 : r.GlobalId) ?? "demo", segments: t, totalLength: e };
}
const L = {
  vehicletrack(r) {
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
      async execute(t, e, n, i) {
        var d, c, g;
        const a = t.model;
        if (!a) {
          n.set("error", [{
            message: r.tr("Модель не загружена"),
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
        const o = [];
        if ((g = (c = (d = a.layouts) == null ? void 0 : d.model) == null ? void 0 : c.walk) == null || g.call(c, (h) => (((h == null ? void 0 : h.type) === "IfcAlignment" || (h == null ? void 0 : h.ifcType) === "IFCALIGNMENT") && o.push(h), !1)), o.length === 0) {
          n.set("no-alignment", [{
            message: r.tr("Трассы (IfcAlignment) не найдены в модели"),
            severity: 1
          }]);
          return;
        }
        let u = o[0];
        if (o.length > 1) {
          const h = o.map((y, R) => ({
            key: String(R),
            label: y.Name ?? y.GlobalId ?? `Трасса ${R + 1}`,
            description: `Длина: ${(y.TotalLength ?? 0).toFixed(1)} м`
          })), l = await r.showQuickPick(h, {
            placeHolder: r.tr("Выберите трассу для расчёта коридора")
          });
          u = o[parseInt(l.key)];
        }
        const p = w(u), m = new T(s).calculateCorridor(p);
        n.set("result", [{
          message: r.tr(
            "Коридор построен. ТС: {0}. Ширина прямой: {1} м. R внешний: {2} м. R внутренний: {3} м.",
            s.name,
            m.straightWidth.toFixed(2),
            m.outerRadius.toFixed(2),
            m.innerRadius.toFixed(2)
          ),
          severity: 0
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
            var i;
            const e = (i = t[0]) == null ? void 0 : i.vehiclePreset, n = e !== "custom" ? x[e] : null;
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
                ], n = await r.showQuickPick(e, {
                  placeHolder: "Выберите тип транспортного средства"
                });
                for (const i of t)
                  try {
                    if (i.vehiclePreset = n.key, n.key !== "custom") {
                      const a = x[n.key];
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
  "property:numericParam"(r) {
    return {
      getProperties(t) {
        const e = r.field;
        return e ? [{
          id: `vehicletrack-${String(e)}`,
          label: r.label ?? String(e),
          description: r.description,
          group: r.group,
          value() {
            var i;
            const n = (i = t[0]) == null ? void 0 : i[e];
            for (let a = 1; a < t.length; a++)
              if (t[a][e] !== n)
                return { label: "**Различные**", suffix: "м" };
            return { label: String(n), suffix: "м" };
          },
          editor() {
            return {
              type: "editbox",
              commit(n) {
                if (!n) return;
                const i = parseFloat(n);
                if (!(!isFinite(i) || i <= 0))
                  for (const a of t)
                    try {
                      a[e] = i;
                    } catch (s) {
                      console.error(s);
                    }
              },
              validate(n) {
                if (!n) return "Поле не может быть пустым";
                if (!isFinite(parseFloat(n))) return "Введите число";
                if (parseFloat(n) <= 0) return "Значение должно быть больше 0";
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
//# sourceMappingURL=index-nPRaNK8M.mjs.map
