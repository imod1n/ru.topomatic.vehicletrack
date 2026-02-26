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

const COLOR_GREEN = 3;
const COLOR_RED   = 1;
type vec3 = [number, number, number];

function toVec3(p: Point3D): vec3 {
    return [p.x, p.y, 0];
}

async function drawCorridor(
    app: any,
    result: CorridorResult,
    vehicle: VehicleParams,
    alignmentStart: Point3D,
    alignmentAngle: number,
): Promise<string[]> {
    const log: string[] = [];

    const editor: any = app?.model?.layouts?.model?.editor?.();
    if (!editor) {
        log.push('editor: не найден');
        return log;
    }
    log.push('editor: OK');

    // ── Зондируем addEntity ──────────────────────────────────────────────────
    // Пробуем разные форматы, чтобы понять какой принимает API

    try {
        await editor.beginEdit?.();
        log.push('beginEdit: OK');
    } catch(e) { log.push(`beginEdit error: ${e}`); }

    // Тестовая линия — пробуем несколько вероятных форматов
    const testLine_v1 = {
        type: 'line',
        color: COLOR_RED,
        a: [0, 0, 0] as vec3,
        b: [10, 0, 0] as vec3,
    };
    const testLine_v2 = {
        type: 'AcDbLine',
        color: COLOR_RED,
        startPoint: [0, 0, 0],
        endPoint: [10, 0, 0],
    };
    const testLine_v3 = {
        type: 2, // числовой тип — LINE в DWG/DXF
        color: COLOR_RED,
        points: [[0, 0, 0], [10, 0, 0]],
    };
    const testLine_v4 = {
        entityType: 'line',
        color: COLOR_RED,
        start: { x: 0, y: 0, z: 0 },
        end: { x: 10, y: 0, z: 0 },
    };

    for (const [name, entity] of [
        ['v1 (type:line, a/b)', testLine_v1],
        ['v2 (AcDbLine, startPoint/endPoint)', testLine_v2],
        ['v3 (type:2, points)', testLine_v3],
        ['v4 (entityType:line, start/end)', testLine_v4],
    ] as [string, object][]) {
        try {
            const r = await editor.addEntity(entity);
            log.push(`addEntity ${name}: OK → result: ${JSON.stringify(r)}`);
            break; // нашли рабочий формат — дальше не пробуем
        } catch(e) {
            log.push(`addEntity ${name}: FAIL → ${e}`);
        }
    }

    try {
        await editor.endEdit?.();
        log.push('endEdit: OK');
    } catch(e) { log.push(`endEdit error: ${e}`); }

    return log;
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
                        severity: 0,
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

                // Поиск трасс
                const layers = drawing.filterLayers(rule.filter, true);
                diagnostics.set('debug-layers', [{
                    message: ctx.tr('layers.size = {0}', String(layers.size)),
                    severity: 2,
                }]);

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

                const startSeg = alignment.segments[0];
                const startPt  = startSeg.start;
                const endPt    = startSeg.end;
                const angle    = Math.atan2(endPt.y - startPt.y, endPt.x - startPt.x);

                // Отрисовка с логами в диагностику
                let drawLog: string[] = [];
                try {
                    drawLog = await drawCorridor(app, result, vehicle, startPt, angle);
                } catch (e) {
                    drawLog = [`ОШИБКА: ${e}`];
                }

                diagnostics.set('debug-draw', [{
                    message: ctx.tr('Отрисовка: {0}', drawLog.join(' | ')),
                    severity: 2,
                }]);

                diagnostics.set('result', [{
                    message: ctx.tr(
                        'Коридор построен. ТС: {0}. Ширина: {1} м. R внешний: {2} м. R внутренний: {3} м.',
                        vehicle.name,
                        result.straightWidth.toFixed(2),
                        result.outerRadius.toFixed(2),
                        result.innerRadius.toFixed(2),
                    ),
                    severity: 4,
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
