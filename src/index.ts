import { VEHICLE_PRESETS, VehicleTrackCalculator, parseIfcAlignment } from './calculator';
import type { VehicleParams, VehiclePreset } from './types';

declare interface VehicleTrackRule {
    vehiclePreset: VehiclePreset;
    customWheelbase: number;
    customTrackWidth: number;
    customOverhangFront: number;
    customOverhangRear: number;
    customTurningRadius: number;
}

export default {

    'vehicletrack:calculate'(ctx: Context): DiagnosticRule<VehicleTrackRule> {
        return {

            async createRule() {
                return {
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

                // Определяем параметры ТС
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

                // Ищем трассы в модели
                const alignments: any[] = [];
                drawing.layouts?.model?.walk?.((e: any) => {
                    if (e?.type === 'IfcAlignment' || e?.ifcType === 'IFCALIGNMENT') {
                        alignments.push(e);
                    }
                    return false;
                });

                if (alignments.length === 0) {
                    diagnostics.set('no-alignment', [{
                        message: ctx.tr('Трассы (IfcAlignment) не найдены в модели'),
                        severity: 1,
                    }]);
                    return;
                }

                // Выбор трассы если их несколько
                let selectedAlignment = alignments[0];
                if (alignments.length > 1) {
                    const items = alignments.map((a, i) => ({
                        key: String(i),
                        label: a.Name ?? a.GlobalId ?? `Трасса ${i + 1}`,
                        description: `Длина: ${(a.TotalLength ?? 0).toFixed(1)} м`,
                    }));
                    const picked = await ctx.showQuickPick(items, {
                        placeHolder: ctx.tr('Выберите трассу для расчёта коридора'),
                    });
                    selectedAlignment = alignments[parseInt(picked.key)];
                }

                // Расчёт коридора
                const alignment = parseIfcAlignment(selectedAlignment);
                const calculator = new VehicleTrackCalculator(vehicle);
                const result = calculator.calculateCorridor(alignment);

                // Результат в диагностику
                diagnostics.set('result', [{
                    message: ctx.tr(
                        'Коридор построен. ТС: {0}. Ширина прямой: {1} м. R внешний: {2} м. R внутренний: {3} м.',
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
