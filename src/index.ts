import { VEHICLE_PRESETS, VehicleTrackCalculator } from './calculator';
import type { VehicleParams, VehiclePreset, Point3D, CorridorResult, Alignment, AlignmentSegment } from './types';
import { DwgType } from 'albatros/enums';

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

function toVec3(p: Point3D): vec3 { return [p.x, p.y, 0]; }

async function drawCorridor(app: any, result: CorridorResult, vehicle: VehicleParams, alignmentStart: Point3D, alignmentAngle: number): Promise<string[]> {
    const log: string[] = [];
    const editor: any = app?.model?.layouts?.model?.editor?.();
    if (!editor) { log.push('editor: не найден'); return log; }
    await editor.beginEdit();
    if (result.outerPolyline.length > 1) await editor.addEntity(DwgType.polyline, { color: COLOR_GREEN, vertices: result.outerPolyline.map(toVec3) });
    if (result.innerPolyline.length > 1) await editor.addEntity(DwgType.polyline, { color: COLOR_GREEN, vertices: result.innerPolyline.map(toVec3) });
    const oP = result.outerPolyline, iP = result.innerPolyline;
    for (let i = 0; i < Math.min(oP.length, iP.length) - 1; i++) {
        await editor.addEntity(DwgType.solid, { color: COLOR_GREEN, a: toVec3(oP[i]), b: toVec3(oP[i+1]), c: toVec3(iP[i]), d: toVec3(iP[i+1]) });
    }
    const cos = Math.cos(alignmentAngle), sin = Math.sin(alignmentAngle);
    const L = vehicle.totalLength, W = vehicle.trackWidth, oF = vehicle.overhangFront;
    const rot = (dx: number, dy: number): vec3 => [alignmentStart.x + dx*cos - dy*sin, alignmentStart.y + dx*sin + dy*cos, 0];
    const vv: vec3[] = [rot(-oF,-W/2), rot(L-oF,-W/2), rot(L-oF,W/2), rot(-oF,W/2), rot(-oF,-W/2)];
    await editor.addEntity(DwgType.polyline, { color: COLOR_RED, vertices: vv });
    await editor.addEntity(DwgType.line, { color: COLOR_RED, a: [alignmentStart.x, alignmentStart.y, 0] as vec3, b: rot(L-oF,0) });
    await editor.addEntity(DwgType.solid, { color: COLOR_RED, a: vv[0], b: vv[1], c: vv[3], d: vv[2] });
    await editor.endEdit();
    log.push(`start=(${alignmentStart.x.toFixed(1)},${alignmentStart.y.toFixed(1)})`);
    return log;
}

/**
 * Строит Alignment из нативного объекта трассы Топоматик.
 *
 * entity.plan — массив сегментов:
 *   { x, y, direction, length, startCurvature, endCurvature }
 * где x,y — начало сегмента в WCS, direction — угол в радианах,
 * curvature = 1/R (0 = прямая).
 */
function alignmentFromNative(entity: any): Alignment {
    const plan: any[] = entity.plan;
    const segments: AlignmentSegment[] = [];
    let totalLength = 0;

    for (let i = 0; i < plan.length; i++) {
        const seg = plan[i];
        const x: number = seg.x;
        const y: number = seg.y;
        const dir: number = seg.direction;  // угол в радианах
        const len: number = seg.length;
        const kStart: number = seg.startCurvature ?? 0;
        const kEnd: number   = seg.endCurvature ?? 0;

        const start: Point3D = { x, y, z: 0 };

        // Определяем тип: прямая если кривизна ~0, дуга иначе
        const kAvg = (Math.abs(kStart) + Math.abs(kEnd)) / 2;
        const isStraight = kAvg < 1e-9;

        if (isStraight) {
            const end: Point3D = {
                x: x + len * Math.cos(dir),
                y: y + len * Math.sin(dir),
                z: 0,
            };
            segments.push({ type: 'straight', start, end, length: len });
        } else {
            // R = 1/k (берём среднее)
            const k = kAvg;
            const R = 1 / k;
            const isLeft = (kStart + kEnd) > 0;  // положительная кривизна = поворот влево
            const sign = isLeft ? 1 : -1;

            // Центр дуги перпендикулярно направлению
            const cx = x + R * Math.cos(dir + sign * Math.PI / 2);
            const cy = y + R * Math.sin(dir + sign * Math.PI / 2);
            const center: Point3D = { x: cx, y: cy, z: 0 };

            const deltaAngle = len / R;
            const endAngleFromCenter = Math.atan2(y - cy, x - cx) + sign * deltaAngle;
            const end: Point3D = {
                x: cx + R * Math.cos(endAngleFromCenter),
                y: cy + R * Math.sin(endAngleFromCenter),
                z: 0,
            };

            segments.push({
                type: 'arc',
                start,
                end,
                length: len,
                radius: R,
                direction: isLeft ? 'left' : 'right',
                center,
            });
        }
        totalLength += len;
    }

    return { ifcId: entity.$id ?? 'native', segments, totalLength };
}

export default {
    'vehicletrack'(ctx: Context): DiagnosticRule<VehicleTrackRule> {
        return {
            async createRule() {
                return { filter: '', vehiclePreset: 'truck_16m' as VehiclePreset, customWheelbase: 5.5, customTrackWidth: 2.5, customOverhangFront: 1.2, customOverhangRear: 1.5, customTurningRadius: 9.0 };
            },

            async execute(app, rule, diagnostics, _progress) {
                const drawing = app.model as any;
                if (!drawing) { diagnostics.set('error', [{ message: ctx.tr('Модель не загружена'), severity: 0 }]); return; }

                let vehicle: VehicleParams;
                if (rule.vehiclePreset === 'custom') {
                    vehicle = { name: 'Пользовательское ТС', wheelbase: rule.customWheelbase, trackWidth: rule.customTrackWidth, overhangFront: rule.customOverhangFront, overhangRear: rule.customOverhangRear, minTurningRadius: rule.customTurningRadius, totalLength: rule.customWheelbase + rule.customOverhangFront + rule.customOverhangRear };
                } else {
                    vehicle = VEHICLE_PRESETS[rule.vehiclePreset];
                }

                const layers = drawing.filterLayers(rule.filter, true);
                if (layers.size === 0) { diagnostics.set('no-alignment', [{ message: ctx.tr('Трассы не найдены.'), severity: 1 }]); return; }

                const layer = [...layers][0];

                // Находим entity трассы через walk
                const layoutModel = drawing?.layouts?.model;
                let alignmentEntity: any = null;
                layoutModel?.walk?.((entity: any) => {
                    const entLayer = entity?.$data?.layer ?? entity?.layer;
                    if (entLayer && (entLayer === layer || entLayer?.$id === layer?.$id)) {
                        if (alignmentEntity === null) alignmentEntity = entity;
                    }
                });

                if (!alignmentEntity) {
                    diagnostics.set('error', [{ message: ctx.tr('Объект трассы не найден в layout'), severity: 0 }]);
                    return;
                }

                // Строим alignment из нативных данных
                let alignment: Alignment;
                try {
                    alignment = alignmentFromNative(alignmentEntity);
                } catch (e) {
                    diagnostics.set('error', [{ message: ctx.tr('Ошибка парсинга трассы: {0}', String(e)), severity: 0 }]);
                    return;
                }

                if (alignment.segments.length === 0) {
                    diagnostics.set('error', [{ message: ctx.tr('Трасса не содержит сегментов'), severity: 0 }]);
                    return;
                }

                diagnostics.set('debug-alignment', [{
                    message: ctx.tr('segs={0} totalLen={1}m | seg0: type={2} start=({3},{4}) end=({5},{6})',
                        String(alignment.segments.length),
                        alignment.totalLength.toFixed(1),
                        alignment.segments[0].type,
                        alignment.segments[0].start.x.toFixed(2),
                        alignment.segments[0].start.y.toFixed(2),
                        alignment.segments[0].end.x.toFixed(2),
                        alignment.segments[0].end.y.toFixed(2),
                    ),
                    severity: 2,
                }]);

                const calculator = new VehicleTrackCalculator(vehicle);
                const result = calculator.calculateCorridor(alignment);
                const startSeg = alignment.segments[0];
                const angle = Math.atan2(
                    startSeg.end.y - startSeg.start.y,
                    startSeg.end.x - startSeg.start.x,
                );

                let drawLog: string[] = [];
                try { drawLog = await drawCorridor(app, result, vehicle, startSeg.start, angle); }
                catch (e) { drawLog = [`ОШИБКА: ${e}`]; }

                const planDump = (alignmentEntity.plan as any[])
                     .map((s, i) => `[${i}] type=${Math.abs(s.startCurvature??0)<1e-9?'line':'arc'} dir=${s.direction?.toFixed(3)} len=${s.length?.toFixed(1)} kS=${s.startCurvature?.toFixed(6)} kE=${s.endCurvature?.toFixed(6)}`)
                      .join(' | ');
                diagnostics.set('debug-plan-dump', [{ message: ctx.tr(planDump), severity: 2 }]);

                diagnostics.set('debug-draw', [{ message: ctx.tr('draw: {0}', drawLog.join(' | ')), severity: 2 }]);
                diagnostics.set('result', [{
                    message: ctx.tr('Коридор построен. ТС: {0}. Ширина: {1} м. R внешний: {2} м. R внутренний: {3} м.',
                        vehicle.name, result.straightWidth.toFixed(2), result.outerRadius.toFixed(2), result.innerRadius.toFixed(2)),
                    severity: 4,
                }]);
            },
        };
    },

    'property:vehiclePreset'(e: Context & ManifestPropertyProvider): ObjectPropertyProvider {
        return {
            getProperties(objects: VehicleTrackRule[]) {
                return [{
                    id: 'vehicletrack-preset', label: e.label ?? 'Тип транспортного средства', description: e.description, group: e.group,
                    value() {
                        const val = objects[0]?.vehiclePreset;
                        const preset = val !== 'custom' ? VEHICLE_PRESETS[val as Exclude<VehiclePreset, 'custom'>] : null;
                        return { label: preset?.name ?? 'Пользовательский' };
                    },
                    editor() {
                        return {
                            type: 'editbox' as const,
                            buttons: [{ label: '...', icon: 'directions_car' }],
                            async onDidTriggerItemButton() {
                                const items = [
                                    { key: 'passenger_car', label: 'Легковой автомобиль', description: 'L=4.5м, R=5.5м' },
                                    { key: 'truck_16m', label: 'Грузовик 16 м', description: 'L=16м, R=9.0м' },
                                    { key: 'truck_20m', label: 'Грузовик 20 м', description: 'L=20м, R=12.0м' },
                                    { key: 'bus_12m', label: 'Автобус 12 м', description: 'L=12м, R=10.5м' },
                                    { key: 'bus_articulated', label: 'Автобус сочленённый 18 м', description: 'L=18м, R=11.5м' },
                                    { key: 'custom', label: 'Пользовательский...', description: 'Задать параметры вручную' },
                                ];
                                const picked = await e.showQuickPick(items, { placeHolder: 'Выберите тип ТС' });
                                for (const obj of objects) {
                                    try {
                                        obj.vehiclePreset = picked.key as VehiclePreset;
                                        if (picked.key !== 'custom') {
                                            const p = VEHICLE_PRESETS[picked.key as Exclude<VehiclePreset, 'custom'>];
                                            obj.customWheelbase = p.wheelbase; obj.customTrackWidth = p.trackWidth;
                                            obj.customOverhangFront = p.overhangFront; obj.customOverhangRear = p.overhangRear;
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
                    id: `vehicletrack-${String(field)}`, label: e.label ?? String(field), description: e.description, group: e.group,
                    value() {
                        const val = objects[0]?.[field];
                        for (let i = 1; i < objects.length; i++) { if (objects[i][field] !== val) return { label: '**Различные**', suffix: 'м' }; }
                        return { label: String(val), suffix: 'м' };
                    },
                    editor() {
                        return {
                            type: 'editbox' as const,
                            commit(value) {
                                if (!value) return;
                                const num = parseFloat(value);
                                if (!isFinite(num) || num <= 0) return;
                                for (const obj of objects) { try { (obj as any)[field] = num; } catch (err) { console.error(err); } }
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
