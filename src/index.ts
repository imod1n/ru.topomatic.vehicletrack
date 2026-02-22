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

    // Получаем editor через app.model
    let editor: any = null;
    try {
        editor = app?.model?.layouts?.model?.editor?.();
        if (editor) log.push('editor: OK через app.model');
        else log.push('editor: null через app.model');
    } catch (e) {
        log.push(`editor error: ${e}`);
    }

    if (!editor) {
        log.push('Доступные ключи app.model: ' + Object.keys(app?.model ?? {}).join(', '));
        return log;
    }

    // Логируем методы editor и layout
    log.push('editor keys: ' + Object.keys(editor).join(', '));
    const layoutModel = app?.model?.layouts?.model;
    log.push('layout.model keys: ' + Object.keys(layoutModel ?? {}).join(', '));

    // Коридор внешний контур
    if (result.outerPolyline.length > 1) {
        await editor.addPolyline({
            color: COLOR_GREEN,
            vertices: result.outerPolyline.map(toVec3),
            width: 0.5,
            flags: 0x0,
        });
        log.push(`Внешний контур: ${result.outerPolyline.length} точек`);
    }

    // Коридор внутренний контур
    if (result.innerPolyline.length > 1) {
        await editor.addPolyline({
            color: COLOR_GREEN,
            vertices: result.innerPolyline.map(toVec3),
            width: 0.5,
            flags: 0x0,
        });
        log.push(`Внутренний контур: ${result.innerPolyline.length} точек`);
    }

    // Заливка солидами
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
    log.push(`Заливка: ${count} солидов`);

    // ТС прямоугольник
    const cos = Math.cos(alignmentAngle);
    const sin = Math.sin(alignmentAngle);
    const L  = vehicle.totalLength;
    const W  = vehicle.trackWidth;
    const oF = vehicle.overhangFront;

    function rotated(dx: number, dy: number): vec3 {
        return [
            alignmentStart.x + dx * cos - dy * sin,
            alignmentStart.y + dx * sin + dy * cos,
            0,
        ];
    }

    const vv: vec3[] = [
        rotated(-oF,    -W / 2),
        rotated(L - oF, -W / 2),
        rotated(L - oF,  W / 2),
        rotated(-oF,     W / 2),
    ];

    await editor.addPolyline({ color: COLOR_RED, vertices: vv, width: 0.3, flags: 0x1 });
    await editor.addSolid({ color: COLOR_RED, a: vv[0], b: vv[1], c: vv[3], d: vv[2] });
    await editor.addLine({
        color: COLOR_RED,
        a: [alignmentStart.x, alignmentStart.y, 0] as vec3,
        b: rotated(L - oF, 0),
    });
    log.push('ТС отрисовано');

    // Применяем изменения — сохраняем транзакцию редактора
    try {
        await editor.commit?.();
        log.push('commit: OK');
    } catch (e) {
        log.push(`commit: ${e}`);
    }

    // Пробуем обновить вид
    try {
        app?.model?.layouts?.model?.update?.();
        log.push('update: OK');
    } catch (e) {
        log.push(`update: ${e}`);
    }

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

                // Диагностика: что доступно в app
                const appKeys = Object.keys(app).join(', ');
                const modelKeys = drawing ? Object.keys(drawing).join(', ') : 'нет';
                const layoutsKeys = drawing?.layouts ? Object.keys(drawing.layouts).join(', ') : 'нет';
                const hasEditor = !!drawing?.layouts?.model?.editor;

                diagnostics.set('debug-ctx', [{
                    message: ctx.tr('app keys: {0}', appKeys),
                    severity: 2,
                }]);
                diagnostics.set('debug-model', [{
                    message: ctx.tr('model keys: {0}', modelKeys),
                    severity: 2,
                }]);
                diagnostics.set('debug-layouts', [{
                    message: ctx.tr('layouts keys: {0} | hasEditor: {1}', layoutsKeys, String(hasEditor)),
                    severity: 2,
                }]);

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
