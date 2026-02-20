"use strict";
Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: "Module" } });
const vue = require("vue");
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
const _sfc_main = vue.defineComponent({
  name: "VehicleTrackPanel",
  props: {
    /** Ссылка на PluginManager Топоматик 360 */
    pluginManager: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    const selectedPreset = vue.ref("truck_16m");
    const isCalculating = vue.ref(false);
    const hasResult = vue.ref(false);
    const statusMessage = vue.ref("");
    const statusClass = vue.ref("");
    const vehicle = vue.reactive({ ...VEHICLE_PRESETS.truck_16m });
    const options = vue.reactive({
      showOuterContour: true,
      showInnerContour: true,
      corridorColor: "#FF6600"
    });
    const alignmentInfo = vue.ref(null);
    const calcPreview = vue.computed(() => {
      const calc = new VehicleTrackCalculator(vehicle);
      const R = vehicle.minTurningRadius;
      return {
        straightWidth: calc.straightWidth,
        outerRadius: calc.outerRadius(R),
        innerRadius: calc.innerRadius(R)
      };
    });
    vue.onMounted(() => {
      var _a, _b;
      try {
        (_b = (_a = props.pluginManager) == null ? void 0 : _a.on) == null ? void 0 : _b.call(_a, "selectionChanged", (selection) => {
          const align = selection == null ? void 0 : selection.find(
            (o) => (o == null ? void 0 : o.type) === "IfcAlignment" || (o == null ? void 0 : o.type) === "IfcPolyline"
          );
          if (align) {
            alignmentInfo.value = {
              name: align.Name ?? align.GlobalId ?? "Трасса",
              length: align.TotalLength ?? 0
            };
          } else {
            alignmentInfo.value = null;
          }
        });
      } catch {
        alignmentInfo.value = { name: "Демо-трасса", length: 75.7 };
      }
    });
    function onPresetChange() {
      if (selectedPreset.value !== "custom") {
        Object.assign(vehicle, VEHICLE_PRESETS[selectedPreset.value]);
      }
    }
    async function onCalculate() {
      var _a, _b;
      isCalculating.value = true;
      statusMessage.value = "";
      try {
        await ((_b = (_a = props.pluginManager) == null ? void 0 : _a.commands) == null ? void 0 : _b.execute("vehicletrack.calculate", {
          vehicle: { ...vehicle },
          options: { ...options }
        }));
        hasResult.value = true;
        statusMessage.value = "✅ Коридор построен успешно";
        statusClass.value = "success";
      } catch (err) {
        statusMessage.value = `❌ Ошибка: ${(err == null ? void 0 : err.message) ?? "неизвестная ошибка"}`;
        statusClass.value = "error";
      } finally {
        isCalculating.value = false;
      }
    }
    async function onClear() {
      var _a, _b;
      try {
        await ((_b = (_a = props.pluginManager) == null ? void 0 : _a.commands) == null ? void 0 : _b.execute("vehicletrack.clear"));
        hasResult.value = false;
        statusMessage.value = "Коридор удалён";
        statusClass.value = "info";
      } catch (err) {
        statusMessage.value = `❌ Ошибка: ${err == null ? void 0 : err.message}`;
        statusClass.value = "error";
      }
    }
    return {
      selectedPreset,
      vehicle,
      options,
      alignmentInfo,
      calcPreview,
      isCalculating,
      hasResult,
      statusMessage,
      statusClass,
      onPresetChange,
      onCalculate,
      onClear
    };
  }
});
const _export_sfc = (sfc, props) => {
  const target = sfc.__vccOpts || sfc;
  for (const [key, val] of props) {
    target[key] = val;
  }
  return target;
};
const _hoisted_1 = { class: "vehicle-track-panel" };
const _hoisted_2 = { class: "form-group" };
const _hoisted_3 = { class: "param-row" };
const _hoisted_4 = ["disabled"];
const _hoisted_5 = { class: "param-row" };
const _hoisted_6 = ["disabled"];
const _hoisted_7 = { class: "param-row" };
const _hoisted_8 = ["disabled"];
const _hoisted_9 = { class: "param-row" };
const _hoisted_10 = ["disabled"];
const _hoisted_11 = { class: "param-row" };
const _hoisted_12 = ["disabled"];
const _hoisted_13 = { class: "form-group" };
const _hoisted_14 = { class: "checkbox-label" };
const _hoisted_15 = { class: "checkbox-label" };
const _hoisted_16 = { class: "form-group" };
const _hoisted_17 = {
  key: 0,
  class: "alignment-info"
};
const _hoisted_18 = {
  key: 1,
  class: "alignment-info warning"
};
const _hoisted_19 = {
  key: 2,
  class: "calc-results"
};
const _hoisted_20 = { class: "result-row" };
const _hoisted_21 = { class: "result-row" };
const _hoisted_22 = { class: "result-row" };
const _hoisted_23 = { class: "actions" };
const _hoisted_24 = ["disabled"];
const _hoisted_25 = ["disabled"];
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return vue.openBlock(), vue.createElementBlock("div", _hoisted_1, [
    _cache[28] || (_cache[28] = vue.createElementVNode("h3", { class: "panel-title" }, "🚛 Коридор движения ТС", -1)),
    vue.createElementVNode("div", _hoisted_2, [
      _cache[13] || (_cache[13] = vue.createElementVNode("label", null, "Тип транспортного средства", -1)),
      vue.withDirectives(vue.createElementVNode("select", {
        "onUpdate:modelValue": _cache[0] || (_cache[0] = ($event) => _ctx.selectedPreset = $event),
        onChange: _cache[1] || (_cache[1] = (...args) => _ctx.onPresetChange && _ctx.onPresetChange(...args))
      }, [..._cache[12] || (_cache[12] = [
        vue.createStaticVNode('<option value="passenger_car" data-v-b8cafffa>Легковой автомобиль</option><option value="truck_16m" data-v-b8cafffa>Грузовик 16 м</option><option value="truck_20m" data-v-b8cafffa>Грузовик 20 м</option><option value="bus_12m" data-v-b8cafffa>Автобус 12 м</option><option value="bus_articulated" data-v-b8cafffa>Автобус сочленённый 18 м</option><option value="custom" data-v-b8cafffa>Пользовательский...</option>', 6)
      ])], 544), [
        [vue.vModelSelect, _ctx.selectedPreset]
      ])
    ]),
    vue.createElementVNode("div", {
      class: vue.normalizeClass(["vehicle-params", { editable: _ctx.selectedPreset === "custom" }])
    }, [
      vue.createElementVNode("div", _hoisted_3, [
        _cache[14] || (_cache[14] = vue.createElementVNode("label", null, "Колёсная база (м)", -1)),
        vue.withDirectives(vue.createElementVNode("input", {
          type: "number",
          "onUpdate:modelValue": _cache[2] || (_cache[2] = ($event) => _ctx.vehicle.wheelbase = $event),
          disabled: _ctx.selectedPreset !== "custom",
          step: "0.1",
          min: "1",
          max: "15"
        }, null, 8, _hoisted_4), [
          [
            vue.vModelText,
            _ctx.vehicle.wheelbase,
            void 0,
            { number: true }
          ]
        ])
      ]),
      vue.createElementVNode("div", _hoisted_5, [
        _cache[15] || (_cache[15] = vue.createElementVNode("label", null, "Ширина колеи (м)", -1)),
        vue.withDirectives(vue.createElementVNode("input", {
          type: "number",
          "onUpdate:modelValue": _cache[3] || (_cache[3] = ($event) => _ctx.vehicle.trackWidth = $event),
          disabled: _ctx.selectedPreset !== "custom",
          step: "0.05",
          min: "1",
          max: "3"
        }, null, 8, _hoisted_6), [
          [
            vue.vModelText,
            _ctx.vehicle.trackWidth,
            void 0,
            { number: true }
          ]
        ])
      ]),
      vue.createElementVNode("div", _hoisted_7, [
        _cache[16] || (_cache[16] = vue.createElementVNode("label", null, "Передний свес (м)", -1)),
        vue.withDirectives(vue.createElementVNode("input", {
          type: "number",
          "onUpdate:modelValue": _cache[4] || (_cache[4] = ($event) => _ctx.vehicle.overhangFront = $event),
          disabled: _ctx.selectedPreset !== "custom",
          step: "0.1",
          min: "0",
          max: "5"
        }, null, 8, _hoisted_8), [
          [
            vue.vModelText,
            _ctx.vehicle.overhangFront,
            void 0,
            { number: true }
          ]
        ])
      ]),
      vue.createElementVNode("div", _hoisted_9, [
        _cache[17] || (_cache[17] = vue.createElementVNode("label", null, "Задний свес (м)", -1)),
        vue.withDirectives(vue.createElementVNode("input", {
          type: "number",
          "onUpdate:modelValue": _cache[5] || (_cache[5] = ($event) => _ctx.vehicle.overhangRear = $event),
          disabled: _ctx.selectedPreset !== "custom",
          step: "0.1",
          min: "0",
          max: "5"
        }, null, 8, _hoisted_10), [
          [
            vue.vModelText,
            _ctx.vehicle.overhangRear,
            void 0,
            { number: true }
          ]
        ])
      ]),
      vue.createElementVNode("div", _hoisted_11, [
        _cache[18] || (_cache[18] = vue.createElementVNode("label", null, "Мин. радиус поворота (м)", -1)),
        vue.withDirectives(vue.createElementVNode("input", {
          type: "number",
          "onUpdate:modelValue": _cache[6] || (_cache[6] = ($event) => _ctx.vehicle.minTurningRadius = $event),
          disabled: _ctx.selectedPreset !== "custom",
          step: "0.5",
          min: "3",
          max: "30"
        }, null, 8, _hoisted_12), [
          [
            vue.vModelText,
            _ctx.vehicle.minTurningRadius,
            void 0,
            { number: true }
          ]
        ])
      ])
    ], 2),
    vue.createElementVNode("div", _hoisted_13, [
      vue.createElementVNode("label", _hoisted_14, [
        vue.withDirectives(vue.createElementVNode("input", {
          type: "checkbox",
          "onUpdate:modelValue": _cache[7] || (_cache[7] = ($event) => _ctx.options.showOuterContour = $event)
        }, null, 512), [
          [vue.vModelCheckbox, _ctx.options.showOuterContour]
        ]),
        _cache[19] || (_cache[19] = vue.createTextVNode(" Показать внешний контур ", -1))
      ]),
      vue.createElementVNode("label", _hoisted_15, [
        vue.withDirectives(vue.createElementVNode("input", {
          type: "checkbox",
          "onUpdate:modelValue": _cache[8] || (_cache[8] = ($event) => _ctx.options.showInnerContour = $event)
        }, null, 512), [
          [vue.vModelCheckbox, _ctx.options.showInnerContour]
        ]),
        _cache[20] || (_cache[20] = vue.createTextVNode(" Показать внутренний контур ", -1))
      ])
    ]),
    vue.createElementVNode("div", _hoisted_16, [
      _cache[21] || (_cache[21] = vue.createElementVNode("label", null, "Цвет коридора", -1)),
      vue.withDirectives(vue.createElementVNode("input", {
        type: "color",
        "onUpdate:modelValue": _cache[9] || (_cache[9] = ($event) => _ctx.options.corridorColor = $event)
      }, null, 512), [
        [vue.vModelText, _ctx.options.corridorColor]
      ])
    ]),
    _ctx.alignmentInfo ? (vue.openBlock(), vue.createElementBlock("div", _hoisted_17, [
      _cache[22] || (_cache[22] = vue.createElementVNode("strong", null, "Трасса:", -1)),
      vue.createTextVNode(" " + vue.toDisplayString(_ctx.alignmentInfo.name), 1),
      _cache[23] || (_cache[23] = vue.createElementVNode("br", null, null, -1)),
      _cache[24] || (_cache[24] = vue.createElementVNode("strong", null, "Длина:", -1)),
      vue.createTextVNode(" " + vue.toDisplayString(_ctx.alignmentInfo.length.toFixed(1)) + " м ", 1)
    ])) : (vue.openBlock(), vue.createElementBlock("div", _hoisted_18, " ⚠️ Выберите трассу в модели ")),
    _ctx.calcPreview ? (vue.openBlock(), vue.createElementBlock("div", _hoisted_19, [
      vue.createElementVNode("div", _hoisted_20, [
        _cache[25] || (_cache[25] = vue.createElementVNode("span", null, "Ширина коридора (прямая):", -1)),
        vue.createElementVNode("strong", null, vue.toDisplayString(_ctx.calcPreview.straightWidth.toFixed(2)) + " м", 1)
      ]),
      vue.createElementVNode("div", _hoisted_21, [
        _cache[26] || (_cache[26] = vue.createElementVNode("span", null, "Внешний радиус поворота:", -1)),
        vue.createElementVNode("strong", null, vue.toDisplayString(_ctx.calcPreview.outerRadius.toFixed(2)) + " м", 1)
      ]),
      vue.createElementVNode("div", _hoisted_22, [
        _cache[27] || (_cache[27] = vue.createElementVNode("span", null, "Внутренний радиус поворота:", -1)),
        vue.createElementVNode("strong", null, vue.toDisplayString(_ctx.calcPreview.innerRadius.toFixed(2)) + " м", 1)
      ])
    ])) : vue.createCommentVNode("", true),
    vue.createElementVNode("div", _hoisted_23, [
      vue.createElementVNode("button", {
        class: "btn-primary",
        onClick: _cache[10] || (_cache[10] = (...args) => _ctx.onCalculate && _ctx.onCalculate(...args)),
        disabled: _ctx.isCalculating || !_ctx.alignmentInfo
      }, vue.toDisplayString(_ctx.isCalculating ? "⏳ Расчёт..." : "▶ Рассчитать коридор"), 9, _hoisted_24),
      vue.createElementVNode("button", {
        class: "btn-secondary",
        onClick: _cache[11] || (_cache[11] = (...args) => _ctx.onClear && _ctx.onClear(...args)),
        disabled: !_ctx.hasResult
      }, " 🗑 Очистить ", 8, _hoisted_25)
    ]),
    _ctx.statusMessage ? (vue.openBlock(), vue.createElementBlock("div", {
      key: 3,
      class: vue.normalizeClass(["status", _ctx.statusClass])
    }, vue.toDisplayString(_ctx.statusMessage), 3)) : vue.createCommentVNode("", true)
  ]);
}
const VehicleTrackPanel = /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-b8cafffa"]]);
const _VehicleTrackPlugin = class _VehicleTrackPlugin {
  constructor() {
    this.viewportObjects = [];
  }
  async run(pm) {
    this.pm = pm;
    console.log(`[VehicleTrack] Плагин запущен (${_VehicleTrackPlugin.pluginId})`);
    pm.commands.register("vehicletrack.calculate", this.handleCalculate.bind(this));
    pm.commands.register("vehicletrack.clear", this.handleClear.bind(this));
    pm.commands.register("vehicletrack.open", this.handleOpen.bind(this));
    await this.handleOpen();
  }
  async handleOpen() {
    try {
      this.pm.ui.showPanel("vehicletrack.panel", VehicleTrackPanel, {
        title: "Коридор движения ТС",
        width: 340,
        resizable: false,
        props: { pluginManager: this.pm }
      });
    } catch (err) {
      console.warn("[VehicleTrack] Ошибка открытия панели", err);
      this.pm.ui.showNotification("VehicleTrack: выберите трассу в модели", "info");
    }
  }
  async handleCalculate(args) {
    const selection = this.pm.viewport.getSelection();
    const ifcAlignment = selection.find(
      (o) => (o == null ? void 0 : o.type) === "IfcAlignment" || (o == null ? void 0 : o.type) === "IfcPolyline"
    );
    if (!ifcAlignment) {
      this.pm.ui.showNotification("Выберите трассу (IfcAlignment) в модели", "warning");
      return;
    }
    const alignment = parseIfcAlignment(ifcAlignment);
    const calculator = new VehicleTrackCalculator(args.vehicle);
    const result = calculator.calculateCorridor(alignment);
    this.clearViewportObjects();
    await this.renderCorridor(result, args.options);
    this.pm.ui.showNotification(`Коридор построен. Ширина: ${result.straightWidth.toFixed(2)} м`, "success");
  }
  async handleClear() {
    this.clearViewportObjects();
    this.pm.ui.showNotification("Коридор удалён", "info");
  }
  async renderCorridor(result, options) {
    const color = options.corridorColor ?? "#FF6600";
    if (options.showOuterContour) {
      const id = this.pm.viewport.addPolyline(result.outerPolyline, { color, lineWidth: 2, label: "Внешний контур коридора" });
      this.viewportObjects.push(id);
    }
    if (options.showInnerContour) {
      const id = this.pm.viewport.addPolyline(result.innerPolyline, { color, lineWidth: 2, lineDash: [4, 4], label: "Внутренний контур коридора" });
      this.viewportObjects.push(id);
    }
    const polygonPts = [...result.outerPolyline, ...result.innerPolyline.slice().reverse()];
    const fillId = this.pm.viewport.addPolygon(polygonPts, { fillColor: color, fillOpacity: 0.2, strokeColor: "transparent", label: "Коридор движения ТС" });
    this.viewportObjects.push(fillId);
    this.pm.viewport.refresh();
  }
  clearViewportObjects() {
    for (const id of this.viewportObjects) {
      try {
        this.pm.viewport.removeObject(id);
      } catch {
      }
    }
    this.viewportObjects = [];
    this.pm.viewport.refresh();
  }
};
_VehicleTrackPlugin.pluginId = "ru.topomatic.vehicletrack";
let VehicleTrackPlugin = _VehicleTrackPlugin;
exports.VEHICLE_PRESETS = VEHICLE_PRESETS;
exports.VehicleTrackCalculator = VehicleTrackCalculator;
exports.VehicleTrackPlugin = VehicleTrackPlugin;
exports.default = VehicleTrackPlugin;
exports.parseIfcAlignment = parseIfcAlignment;
//# sourceMappingURL=index.cjs.js.map
