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

/** Добавляет линию через addEntity (формат v1 — проверен) */
async function addLine(editor: any, color: number, a: vec3, b: vec3): Promise<void> {
    await editor.addEntity({ type: 'line', color, a, b });
}

/**
 * Добавляет полилинию.
 * Пробует 'polyline' → 'lwpolyline' → fallback через отдельные линии.
 */
async function addPolyline(
    editor: any,
    color: number,
    vertices: vec3[],
    closed: boolean = false,
    log: string[] = [],
): Promise<void> {
    if (vertices.length < 2) return;

    // Попытка 1: type:'polyline'
    try {
        await editor.addEntity({ type: 'polyline', color, vertices, closed });
        log.push('polyline: OK (type:polyline)');
        return;
    } catch (_) { /* пробуем дальше */ }

    // Попытка 2: type:'lwpolyline'
    try {
        await editor.addEntity({ type: 'lwpolyline', color, vertices, closed });
        log.push('polyline: OK (type:lwpolyline)');
        return;
    } catch (_) { /* пробуем дальше */ }

    // Попытка 3: type:'spline' с points
    try {
        await editor.addEntity({ type: 'spline', color, points: vertices });
        log.push('polyline: OK (type:spline)');
        return;
    } catch (_) { /* пробуем дальше */ }

    // Fallback: рисуем как набор линий
    for (let i = 0; i < vertices.length - 1; i++) {
        await addLine(editor, color, vertices[i], vertices[i + 1]);
    }
    if (closed && vertices.length > 2) {
        await addLine(editor, color, vertices[vertices.length - 1], vertices[0]);
    }
    log.push(`polyline: fallback (${vertices.length - 1} lines)`);
}

/**
 * Добавляет заливку между двумя контурами.
 * Пробует 'solid' → 'hatch' → пропускает.
 */
async function addFill(
    editor: any,
    color: number,
    outer: Point3D[],
    inner: Point3D[],
    log: string[] = [],
): Promise<void> {
    const count = Math.min(outer.length, inner.length) - 1;
    if (count <= 0) return;

    // Пробуем solid на первом сегменте — если сработает, рисуем все
    let solidWorked = false;
    try {
        await editor.addEntity({
            type: 'solid',
            color,
            a: toVec3(outer[0]),
            b: toVec3(outer[1]),
            c: toVec3(inner[0]),
            d: toVec3(inner[1]),
        });
        solidWorked = true;
    } catch (_) { /* пробуем hatch */ }

    if (solidWorked) {
        for (let i = 1; i < count; i++) {
            await editor.addEntity({
                type: 'solid',
                color,
                a: toVec3(outer[i]),
                b: toVec3(outer[i + 1]),
                c: toVec3(inner[i]),
                d: toVec3(inner[i + 1]),
            });
        }
        log.push(`fill: OK (${count} solids)`);
        return;
    }

    // Пробуем hatch с boundary
    try {
        const boundary = [
            ...outer.map(toVec3),
            ...[...inner].reverse().map(toVec3),
        ];
        await editor.addEntity({ type: 'hatch', color, boundary, patternName: 'SOLID' });
        log.push('fill: OK (hatch)');
        return;
    } catch (_) { /* игнорируем */ }

    log.push('fill: skipped (no solid/hatch support)');
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
    if (!editor) { log.push('editor: не найден'); return log; }

    try { await editor.beginEdit?.(); } catch(e) { log.push(`beginEdit error: ${e}`); return log; }

    // ── Внешний контур ─────────────────────────────────────────────────────
    if (result.outerPolyline.length > 1) {
        await addPolyline(editor, COLOR_GREEN, result.outerPolyline.map(toVec3), false, log);
        log.push(`outer: ${result.outerPolyline.length} pts`);
    }

    // ── Внутренний контур ──────────────────────────────────────────────────
    if (result.innerPolyline.length > 1) {
        await addPolyline(editor, COLOR_GREEN, result.innerPolyline.map(toVec3), false, log);
        log.push(`inner: ${result.innerPolyline.length} pts`);
    }

    // ── Заливка коридора ───────────────────────────────────────────────────
    await addFill(editor, COLOR_GREEN, result.outerPolyline, result.innerPolyline, log);

    // ── Прямоугольник ТС ───────────────────────────────────────────────────
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

    // Контур ТС (замкнутая полилиния)
    await addPolyline(editor, COLOR_RED, [...vv, vv[0]], false, log);

    // Центральная ось ТС
    await addLine(editor, COLOR_RED,
        [alignmentStart.x, alignmentStart.y, 0],
        rotated(L - oF, 0),
    );

    // Заливка ТС
    try {
        await editor.addEntity({ type: 'solid', color: COLOR_RED, a: vv[0], b: vv[1], c: vv[3], d: vv[2] });
        log.push('vehicle solid: OK');
    } catch(_) { log.push('vehicle solid: skipped'); }

    log.push('ТС отрисовано');

    try { await editor.endEdit?.(); log.push('endEdit: OK'); }
    catch(e) { log.push(`endEdit error: ${e}`); }

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
