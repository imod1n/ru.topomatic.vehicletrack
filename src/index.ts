import { VEHICLE_PRESETS, VehicleTrackCalculator } from './calculator';
import type { VehicleParams, Point3D, CorridorResult, Alignment, AlignmentSegment } from './types';
import { DwgType } from 'albatros/enums';

// ─── Верифицированные пресеты ТС ──────────────────────────────────────────────

const VERIFIED_PRESETS = [
    { preset: VEHICLE_PRESETS.passenger_car   },  // 0
    { preset: VEHICLE_PRESETS.bus_12m         },  // 1
    { preset: VEHICLE_PRESETS.bus_articulated },  // 2
    { preset: VEHICLE_PRESETS.truck_tandem    },  // 3
] as const;

declare interface VehicleTrackRule {
    filter: string;
    vehicleIndex: number;
}

function getPreset(idx: number) {
    return (VERIFIED_PRESETS[idx] ?? VERIFIED_PRESETS[0]).preset;
}

// ─── Константы и утилиты ──────────────────────────────────────────────────────

const COLOR_GREEN = 3;
const COLOR_RED   = 1;

type vec2 = [number, number, number]; // XY-план, z всегда 0

/** Конвертация Point3D в плоский вектор для albatros API (z = 0) */
function toXY(p: Point3D): vec2 { return [p.x, p.y, 0]; }

// ─── Состояние отрисовки ──────────────────────────────────────────────────────
//
// editor API предоставляет только addEntity/beginEdit/endEdit — удаление отсутствует.
// Вместо удаления и пересоздания при каждом запуске:
//   - сохраняем живые объекты сущностей (_entities)
//   - при повторном запуске мутируем entity.$data новыми координатами
//   - лишние сущности схлопываем в точку [0,0,0]
//   - editor держится «живым» между запусками через цикл endEdit→beginEdit

/** Долгоживущий экземпляр editor с открытой сессией. */
let _editor: any = null;

/** Живые объекты сущностей последнего отрисованного коридора. */
let _entities: any[] = [];

// ─── Управление editor-сессией ────────────────────────────────────────────────

/**
 * Возвращает живой editor, переиспользуя существующий или создавая новый.
 *
 * Двойная проверка намеренна: _editor может существовать как объект,
 * но иметь мёртвый layout (например, после закрытия/открытия файла).
 * В этом случае зовём endEdit() для корректного завершения старой сессии
 * перед созданием новой.
 */
async function getOrCreateEditor(app: any): Promise<any> {
    if (_editor !== null && _editor.layout != null) {
        return _editor;
    }
    if (_editor !== null) {
        try { await _editor.endEdit(); } catch {}
        _editor = null;
    }
    const ed = app.model.layouts.model.editor.call(app.model.layouts.model);
    await ed.beginEdit();
    _editor = ed;
    return _editor;
}

// ─── Построение примитивов ────────────────────────────────────────────────────

interface PrimitiveSpec {
    type: DwgType;
    data: Record<string, any>;
}

/**
 * Строит полный список примитивов коридора:
 *   - внешняя и внутренняя полилинии (зелёные)
 *   - заливка коридора солидами (зелёные)
 *   - контур ТС, ось, заливка (красные)
 */
function buildPrimitives(
    result: CorridorResult,
    vehicle: VehicleParams,
    alignmentStart: Point3D,
    alignmentAngle: number,
): PrimitiveSpec[] {
    const specs: PrimitiveSpec[] = [];

    if (result.outerPolyline.length > 1)
        specs.push({ type: DwgType.polyline, data: { color: COLOR_GREEN, vertices: result.outerPolyline.map(toXY) } });
    if (result.innerPolyline.length > 1)
        specs.push({ type: DwgType.polyline, data: { color: COLOR_GREEN, vertices: result.innerPolyline.map(toXY) } });

    const oP = result.outerPolyline, iP = result.innerPolyline;
    for (let i = 0; i < Math.min(oP.length, iP.length) - 1; i++)
        specs.push({ type: DwgType.solid, data: { color: COLOR_GREEN,
            a: toXY(oP[i]), b: toXY(oP[i+1]), c: toXY(iP[i]), d: toXY(iP[i+1]) } });

    const cos = Math.cos(alignmentAngle), sin = Math.sin(alignmentAngle);
    const { totalLength: L, trackWidth: W, overhangFront: oF } = vehicle;
    const rot = (dx: number, dy: number): vec2 => [
        alignmentStart.x + dx * cos - dy * sin,
        alignmentStart.y + dx * sin + dy * cos,
        0,
    ];
    const vv: vec2[] = [rot(-oF,-W/2), rot(L-oF,-W/2), rot(L-oF,W/2), rot(-oF,W/2), rot(-oF,-W/2)];
    specs.push({ type: DwgType.polyline, data: { color: COLOR_RED, vertices: vv } });
    specs.push({ type: DwgType.line,     data: { color: COLOR_RED, a: [alignmentStart.x, alignmentStart.y, 0] as vec2, b: rot(L-oF, 0) } });
    specs.push({ type: DwgType.solid,    data: { color: COLOR_RED, a: vv[0], b: vv[1], c: vv[3], d: vv[2] } });

    return specs;
}

// ─── Отрисовка коридора ───────────────────────────────────────────────────────

/**
 * Схлопывает сущность в невидимую точку путём мутации $data.
 * Используется для «скрытия» лишних сущностей без их удаления.
 */
function collapseEntity(entity: any): void {
    const data = entity?.$data;
    if (!data) return;
    const ZERO: vec2 = [0, 0, 0];
    if (Array.isArray(data.vertices)) {
        data.vertices = [ZERO, ZERO];
    } else if (data.c !== undefined) {
        data.a = ZERO; data.b = ZERO; data.c = ZERO; data.d = ZERO;
    } else if (data.b !== undefined) {
        data.a = ZERO; data.b = ZERO;
    }
}

/**
 * Отрисовывает коридор через persistent editor.
 *
 * При первом запуске — создаёт сущности через addEntity.
 * При повторных — переиспользует существующие, обновляя $data напрямую.
 * Лишние старые сущности схлопываются в точку.
 */
async function drawCorridor(
    editor: any,
    result: CorridorResult,
    vehicle: VehicleParams,
    alignmentStart: Point3D,
    alignmentAngle: number,
): Promise<void> {
    const specs = buildPrimitives(result, vehicle, alignmentStart, alignmentAngle);
    const newEntities: any[] = [];

    for (let i = 0; i < specs.length; i++) {
        const spec     = specs[i];
        const existing = _entities[i];

        if (existing) {
            const existingIsPolyline = Array.isArray(existing.$data?.vertices);
            const existingIsSolid    = existing.$data?.c !== undefined;
            const specIsPolyline     = spec.data.vertices !== undefined;
            const specIsSolid        = spec.data.c !== undefined;
            const typesMatch = existingIsPolyline === specIsPolyline && existingIsSolid === specIsSolid;

            if (typesMatch) {
                const data = existing.$data;
                for (const [k, v] of Object.entries(spec.data)) data[k] = v;
                newEntities.push(existing);
            } else {
                collapseEntity(existing);
                newEntities.push(await editor.addEntity(spec.type, spec.data));
            }
        } else {
            newEntities.push(await editor.addEntity(spec.type, spec.data));
        }
    }

    for (let i = specs.length; i < _entities.length; i++) {
        collapseEntity(_entities[i]);
    }

    _entities = newEntities;
}

// ─── Парсинг трассы ───────────────────────────────────────────────────────────

function alignmentFromNative(entity: any): Alignment {
    const segments: AlignmentSegment[] = [];
    let totalLength = 0;

    for (const seg of entity.plan as any[]) {
        const { x, y, direction: dir, length: len } = seg;
        const kStart: number = seg.startCurvature ?? 0;
        const kEnd: number   = seg.endCurvature   ?? 0;
        const start: Point3D = { x, y, z: 0 };
        const kAvg = (Math.abs(kStart) + Math.abs(kEnd)) / 2;

        if (kAvg < 1e-9) {
            segments.push({
                type: 'straight',
                start,
                end: { x: x + len * Math.cos(dir), y: y + len * Math.sin(dir), z: 0 },
                length: len,
            });
        } else {
            const R      = 1 / kAvg;
            const isLeft = (kStart + kEnd) < 0;
            const sign   = isLeft ? 1 : -1;
            const cx     = x + R * Math.cos(dir + sign * Math.PI / 2);
            const cy     = y + R * Math.sin(dir + sign * Math.PI / 2);
            const endAngle = Math.atan2(y - cy, x - cx) + sign * len / R;
            segments.push({
                type: 'arc',
                start,
                end: { x: cx + R * Math.cos(endAngle), y: cy + R * Math.sin(endAngle), z: 0 },
                length: len,
                radius: R,
                direction: isLeft ? 'left' : 'right',
                center: { x: cx, y: cy, z: 0 },
            });
        }
        totalLength += len;
    }

    return { ifcId: entity.$id ?? 'native', segments, totalLength };
}

// ─── Экспорт плагина ──────────────────────────────────────────────────────────

export default {

    'vehicletrack'(ctx: Context): DiagnosticRule<VehicleTrackRule> {
        return {
            async createRule() {
                return { filter: '', vehicleIndex: 0 };
            },

            async execute(app, rule, diagnostics, _progress) {
                const drawing = app.model as any;
                if (!drawing) {
                    diagnostics.set('error', [{ message: ctx.tr('Модель не загружена'), severity: 0 }]);
                    return;
                }

                const vehicle = getPreset(rule.vehicleIndex ?? 0);

                const layers = drawing.filterLayers(rule.filter, true);
                if (layers.size === 0) {
                    diagnostics.set('no-alignment', [{ message: ctx.tr('Трассы не найдены.'), severity: 1 }]);
                    return;
                }

                const layer = [...layers][0];
                const layoutModel = drawing?.layouts?.model;
                let alignmentEntity: any = null;
                layoutModel?.walk?.((entity: any) => {
                    const entLayer = entity?.$data?.layer ?? entity?.layer;
                    if (entLayer && (entLayer === layer || entLayer?.$id === layer?.$id))
                        if (alignmentEntity === null) alignmentEntity = entity;
                });
                if (!alignmentEntity) {
                    diagnostics.set('error', [{ message: ctx.tr('Объект трассы не найден в layout'), severity: 0 }]);
                    return;
                }

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

                const result = new VehicleTrackCalculator(vehicle).calculateCorridor(alignment);
                const startSeg = alignment.segments[0];
                const angle = Math.atan2(
                    startSeg.end.y - startSeg.start.y,
                    startSeg.end.x - startSeg.start.x,
                );

                try {
                    const editor = await getOrCreateEditor(app);
                    await drawCorridor(editor, result, vehicle, startSeg.start, angle);
                    await editor.endEdit();
                    await editor.beginEdit();
                    app.manager?.cadview?.invalidate?.();
                } catch (e) {
                    diagnostics.set('error', [{ message: ctx.tr('Ошибка отрисовки: {0}', String(e)), severity: 0 }]);
                    return;
                }

                diagnostics.set('Список коридоров', [{
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

    // ── Свойство "Тип ТС" ─────────────────────────────────────────────────────
    //
    // Персистентность: прямая мутация obj.vehicleIndex внутри onDidTriggerItemButton —
    // единственный рабочий способ сохранить выбор (commit() фреймворком не вызывается).
    //
    'property:vehiclePreset'(e: Context & ManifestPropertyProvider): ObjectPropertyProvider {
        return {
            getProperties(objects: VehicleTrackRule[]) {
                return [{
                    id: 'vehicletrack-preset',
                    label: e.label ?? 'Тип транспортного средства',
                    description: e.description,
                    group: e.group,
                    value() {
                        return { label: getPreset(objects[0]?.vehicleIndex ?? 0).name };
                    },
                    editor() {
                        return {
                            type: 'editbox' as const,
                            buttons: [{ label: '...', icon: 'directions_car' }],
                            async onDidTriggerItemButton() {
                                const items = VERIFIED_PRESETS.map(({ preset }, idx) => ({
                                    label: preset.name,
                                    description: `wb=${preset.wheelbase}м  колея=${preset.trackWidth}м  R=${preset.minTurningRadius}м`,
                                    key: String(idx),
                                }));
                                const picked = await e.showQuickPick(items, { placeHolder: 'Выберите тип транспортного средства' });
                                if (!picked) return undefined;
                                const idx = parseInt(picked.key, 10);
                                for (const obj of objects) obj.vehicleIndex = idx;
                                return picked.key;
                            },
                            commit(_value: string) {},
                        };
                    },
                }];
            },
        };
    },

};
