import { VEHICLE_PRESETS, VehicleTrackCalculator, parseIfcAlignment } from './calculator';
import type { VehicleParams, VehiclePreset, Point3D, CorridorResult } from './types';

declare interface VehicleTrackRule {
    filter: string;
    vehiclePreset: VehiclePreset;
    customWheelbase: number;
    customTrackWidth: number;
    customOverhangFront: number;
    customOverhangRear: number;
    customTurningRadius: number;
}

// CAD цвета: 1=красный, 2=жёлтый, 3=зелёный, 4=голубой, 5=синий, 6=пурпурный, 7=белый
const COLOR_GREEN = 3;  // коридор
const COLOR_RED   = 1;  // ТС

type vec3 = [number, number, number];

function toVec3(p: Point3D): vec3 {
    return [p.x, p.y, 0];
}

/**
 * Рисует коридор движения (зелёный) и контур ТС (красный) через API Albatros
 */
async function drawCorridor(
    ctx: Context,
    result: CorridorResult,
    vehicle: VehicleParams,
    alignmentStart: Point3D,
    alignmentAngle: number,
): Promise<void> {
    const cadview = ctx.cadview;
    if (!cadview) {
        console.warn('[VehicleTrack] cadview недоступен');
        return;
    }

    const drawing = cadview.layer.drawing!.layout.drawing!;
    const editor = drawing.layouts.model!.editor();

    // ── 1. Коридор: внешний контур (зелёный, замкнутая полилиния) ──────────
    if (result.outerPolyline.length > 1) {
        await editor.addPolyline({
            color: COLOR_GREEN,
            vertices: result.outerPolyline.map(toVec3),
            width: 0.5,
            flags: 0x0, // разомкнутая — это граница
        });
    }

    // ── 2. Коридор: внутренний контур (зелёный пунктир через ширину=0) ─────
    if (result.innerPolyline.length > 1) {
        await editor.addPolyline({
            color: COLOR_GREEN,
            vertices: result.innerPolyline.map(toVec3),
            width: 0.5,
            flags: 0x0,
        });
    }

    // ── 3. Заливка коридора солидами (зелёный) ──────────────────────────────
    // Разбиваем коридор на четырёхугольники между соседними точками контуров
    const outerPts = result.outerPolyline;
    const innerPts = result.innerPolyline;
    const count = Math.min(outerPts.length, innerPts.length) - 1;

    for (let i = 0; i < count; i++) {
        await editor.addSolid({
            color: COLOR_GREEN,
            a: toVec3(outerPts[i]),
            b: toVec3(outerPts[i + 1]),
            c: toVec3(innerPts[i]),
            d: toVec3(innerPts[i + 1]),
        });
    }

    // ── 4. Контур ТС (красный прямоугольник) ────────────────────────────────
    // Рисуем ТС в начале трассы
    const cos = Math.cos(alignmentAngle);
    const sin = Math.sin(alignmentAngle);
    const L  = vehicle.totalLength;
    const W  = vehicle.trackWidth;
    const oF = vehicle.overhangFront;

    // Четыре угла прямоугольника ТС относительно начала трассы
    function rotated(dx: number, dy: number): vec3 {
        return [
            alignmentStart.x + dx * cos - dy * sin,
            alignmentStart.y + dx * sin + dy * cos,
            0,
        ];
    }

    const vehicleVertices: vec3[] = [
        rotated(-oF,       -W / 2),  // зад-лево
        rotated(L - oF,    -W / 2),  // перед-лево
        rotated(L - oF,     W / 2),  // перед-право
        rotated(-oF,        W / 2),  // зад-право
    ];

    // Замкнутая полилиния — контур ТС
    await editor.addPolyline({
        color: COLOR_RED,
        vertices: vehicleVertices,
        width: 0.3,
        flags: 0x1, // замкнутая
    });

    // Заливка ТС двумя солидами (делим прямоугольник по диагонали)
    await editor.addSolid({
        color: COLOR_RED,
        a: vehicleVertices[0],
        b: vehicleVertices[1],
        c: vehicleVertices[3],
        d: vehicleVertices[2],
    });

    // Стрелка направления движения (линия от центра к переду)
    const cx = alignmentStart.x;
    const cy = alignmentStart.y;
    await editor.addLine({
        color: COLOR_RED,
        a: [cx, cy, 0] as vec3,
        b: rotated(L - oF, 0),
    });
}

export default {

    'vehicletrack'(ctx: Context): DiagnosticRule<VehicleTrackRule> {
        return {

            async createRule() {
                return {
                    filter: '',
                    vehiclePreset: 'truck_16m' as VehiclePreset,
                    customWheelbase: 5.5,
                    customTrackWidth: 2.5,
                    customOverhangFront: 1.2,
                    customOverhangRear: 1.5,
                    customTurningRadius: 9.0,
                };
            },

            async execute(app, rule, diagnostics, _progress) {
                const drawing = app.model as any;
                if (!drawing) {
                    diagnostics.set('error', [{
                        message: ctx.tr('Модель не загружена'),
                        severity: 1,
                    }]);
                    return;
                }

                // Параметры ТС
                let vehicle: VehicleParams;
                if (rule.vehiclePreset === 'custom') {
                    vehicle = {
                        name: 'Пользовательское ТС',
                        wheelbase: rule.customWheelbase,
                        trackWidth: rule.customTrackWidth,
                        overhangFront: rule.customOverhangFront,
                        overhangRear: rule.customOverhangRear,
                        minTurningRadius: rule.customTurningRadius,
                        totalLength: rule.customWheelbase + rule.customOverhangFront + rule.customOverhangRear,
                    };
                } else {
                    vehicle = VEHICLE_PRESETS[rule.vehiclePreset];
                }

                // Поиск трасс через filterLayers
                const layers = drawing.filterLayers(rule.filter, true);
                if (layers.size === 0) {
                    diagnostics.set('no-alignment', [{
                        message: ctx.tr('Трассы не найдены. Проверьте фильтр трассы.'),
                        severity: 1,
                    }]);
                    return;
                }

                const layer = [...layers][0];
                const alignment = parseIfcAlignment(layer);
                const calculator = new VehicleTrackCalculator(vehicle);
                const result = calculator.calculateCorridor(alignment);

                // Начало трассы и угол для позиционирования ТС
                const startSeg = alignment.segments[0];
                const startPt  = startSeg.start;
                const endPt    = startSeg.end;
                const angle    = Math.atan2(endPt.y - startPt.y, endPt.x - startPt.x);

                // Отрисовка в cadview
                try {
                    await drawCorridor(ctx, result, vehicle, startPt, angle);
                } catch (drawErr) {
                    console.warn('[VehicleTrack] Ошибка отрисовки:', drawErr);
                }

                // Результат в диагностику
                diagnostics.set('result', [{
                    message: ctx.tr(
                        'Коридор построен. ТС: {0}. Ширина: {1} м. R внешний: {2} м. R внутренний: {3} м.',
                        vehicle.name,
                        result.straightWidth.toFixed(2),
                        result.outerRadius.toFixed(2),
                        result.innerRadius.toFixed(2),
                    ),
                    severity: 0,
                }]);
            },
        };
    },

    'property:vehiclePreset'(e: Context & ManifestPropertyProvider): ObjectPropertyProvider {
        return {
            getProperties(objects: VehicleTrackRule[]) {
                return [{
                    id: 'vehicletrack-preset',
                    label: e.label ?? 'Тип транспортного средства',
                    description: e.description,
                    group: e.group,
                    value() {
                        const val = objects[0]?.vehiclePreset;
                        const preset = val !== 'custom'
                            ? VEHICLE_PRESETS[val as Exclude<VehiclePreset, 'custom'>]
                            : null;
                        return { label: preset?.name ?? 'Пользовательский' };
                    },
                    editor() {
                        return {
                            type: 'editbox' as const,
                            buttons: [{ label: '...', icon: 'directions_car' }],
                            async onDidTriggerItemButton() {
                                const items = [
                                    { key: 'passenger_car',   label: 'Легковой автомобиль',      description: 'L=4.5м, R=5.5м' },
                                    { key: 'truck_16m',       label: 'Грузовик 16 м',            description: 'L=16м, R=9.0м' },
                                    { key: 'truck_20m',       label: 'Грузовик 20 м',            description: 'L=20м, R=12.0м' },
                                    { key: 'bus_12m',         label: 'Автобус 12 м',             description: 'L=12м, R=10.5м' },
                                    { key: 'bus_articulated', label: 'Автобус сочленённый 18 м', description: 'L=18м, R=11.5м' },
                                    { key: 'custom',          label: 'Пользовательский...',       description: 'Задать параметры вручную' },
                                ];
                                const picked = await e.showQuickPick(items, {
                                    placeHolder: 'Выберите тип транспортного средства',
                                });
                                for (const obj of objects) {
                                    try {
                                        obj.vehiclePreset = picked.key as VehiclePreset;
                                        if (picked.key !== 'custom') {
                                            const p = VEHICLE_PRESETS[picked.key as Exclude<VehiclePreset, 'custom'>];
                                            obj.customWheelbase     = p.wheelbase;
                                            obj.customTrackWidth    = p.trackWidth;
                                            obj.customOverhangFront = p.overhangFront;
                                            obj.customOverhangRear  = p.overhangRear;
                                            obj.customTurningRadius = p.minTurningRadius;
                                        }
                                    } catch (err) { console.error(err); }
                                }
                            },
                            commit(_value) {},
                        };
                    },
                }];
            },
        };
    },

    'property:numericParam'(e: Context & ManifestPropertyProvider): ObjectPropertyProvider {
        return {
            getProperties(objects: VehicleTrackRule[]) {
                const field = e.field as keyof VehicleTrackRule;
                if (!field) return [];
                return [{
                    id: `vehicletrack-${String(field)}`,
                    label: e.label ?? String(field),
                    description: e.description,
                    group: e.group,
                    value() {
                        const val = objects[0]?.[field];
                        for (let i = 1; i < objects.length; i++) {
                            if (objects[i][field] !== val) {
                                return { label: '**Различные**', suffix: 'м' };
                            }
                        }
                        return { label: String(val), suffix: 'м' };
                    },
                    editor() {
                        return {
                            type: 'editbox' as const,
                            commit(value) {
                                if (!value) return;
                                const num = parseFloat(value);
                                if (!isFinite(num) || num <= 0) return;
                                for (const obj of objects) {
                                    try { (obj as any)[field] = num; } catch (err) { console.error(err); }
                                }
                            },
                            validate(value) {
                                if (!value) return 'Поле не может быть пустым';
                                if (!isFinite(parseFloat(value))) return 'Введите число';
                                if (parseFloat(value) <= 0) return 'Значение должно быть больше 0';
                            },
                        };
                    },
                }];
            },
        };
    },
};
