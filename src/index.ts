import { VEHICLE_PRESETS, VehicleTrackCalculator, parseIfcAlignment } from './calculator';
import type { VehicleParams, VehiclePreset } from './types';

// ─── Вспомогательные типы (на основе реального API Albatros) ─────────────────

declare interface VehicleTrackRule {
  vehiclePreset: VehiclePreset;
  customWheelbase: number;
  customTrackWidth: number;
  customOverhangFront: number;
  customOverhangRear: number;
  customTurningRadius: number;
  showOuter: boolean;
  showInner: boolean;
}

// ─── Экспорт плагина (реальный паттерн Albatros) ─────────────────────────────

export default {

  /**
   * Главная команда — расчёт коридора движения ТС
   * Вызывается из манифеста как команда плагина
   */
  'vehicletrack:calculate'(ctx: Context): DiagnosticRule<VehicleTrackRule> {
    return {

      // Параметры по умолчанию при создании правила
      async createRule() {
        return {
          vehiclePreset: 'truck_16m' as VehiclePreset,
          customWheelbase: 5.5,
          customTrackWidth: 2.5,
          customOverhangFront: 1.2,
          customOverhangRear: 1.5,
          customTurningRadius: 9.0,
          showOuter: true,
          showInner: true,
        };
      },

      // Основная логика расчёта
      async execute(app, rule, diagnostics, _progress) {
        const drawing = app.model as any;
        if (!drawing) {
          diagnostics.set('error', [{
            message: ctx.tr('Модель не загружена'),
            severity: 2, // Warning
          }]);
          return;
        }

        // Определяем параметры ТС
        let vehicle: VehicleParams;
        if (rule.vehiclePreset === 'custom') {
          vehicle = {
            name: ctx.tr('Пользовательское ТС'),
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

        // Ищем трассы (IfcAlignment) в модели
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
            severity: 1, // Warning
          }]);
          return;
        }

        // Если несколько трасс — предлагаем выбор
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

        // Парсим и рассчитываем коридор
        const alignment = parseIfcAlignment(selectedAlignment);
        const calculator = new VehicleTrackCalculator(vehicle);
        const result = calculator.calculateCorridor(alignment);

        // Отображаем результат в модели
        if (rule.showOuter && result.outerPolyline.length > 0) {
          ctx.manager.eval('ru.topomatic.vehicletrack/draw:polyline', {
            points: result.outerPolyline,
            color: '#FF6600',
            lineWidth: 2,
            label: ctx.tr('Внешний контур коридора'),
          });
        }

        if (rule.showInner && result.innerPolyline.length > 0) {
          ctx.manager.eval('ru.topomatic.vehicletrack/draw:polyline', {
            points: result.innerPolyline,
            color: '#FF6600',
            lineWidth: 2,
            dashed: true,
            label: ctx.tr('Внутренний контур коридора'),
          });
        }

        // Выводим итог в диагностику
        diagnostics.set('result', [{
          message: ctx.tr(
            'Коридор построен. ТС: {0}. Ширина: {1} м. Внешний R: {2} м. Внутренний R: {3} м.',
            vehicle.name,
            result.straightWidth.toFixed(2),
            result.outerRadius.toFixed(2),
            result.innerRadius.toFixed(2),
          ),
          severity: 0, // Info
        }]);
      },
    };
  },

  // ─── Провайдер свойств: выбор типа ТС ──────────────────────────────────────

  'property:vehiclePreset'(e: Context & ManifestPropertyProvider): ObjectPropertyProvider {
    return {
      getProperties(objects: VehicleTrackRule[]) {
        return [{
          id: 'vehicletrack-preset',
          label: e.label ?? e.tr('Тип транспортного средства'),
          description: e.description,
          group: e.group,
          value() {
            const val = objects[0]?.vehiclePreset;
            const preset = val !== 'custom' ? VEHICLE_PRESETS[val as Exclude<VehiclePreset, 'custom'>] : null;
            return { label: preset?.name ?? e.tr('Пользовательский') };
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
                  placeHolder: e.tr('Выберите тип транспортного средства'),
                });
                for (const obj of objects) {
                  try {
                    obj.vehiclePreset = picked.key as VehiclePreset;
                    // Автозаполняем поля из пресета
                    if (picked.key !== 'custom') {
                      const p = VEHICLE_PRESETS[picked.key as Exclude<VehiclePreset, 'custom'>];
                      obj.customWheelbase       = p.wheelbase;
                      obj.customTrackWidth      = p.trackWidth;
                      obj.customOverhangFront   = p.overhangFront;
                      obj.customOverhangRear    = p.overhangRear;
                      obj.customTurningRadius   = p.minTurningRadius;
                    }
                  } catch (err) {
                    console.error(err);
                  }
                }
              },
              commit(value) {
                // Ручной ввод не используется — только через кнопку
              },
            };
          },
        }];
      },
    };
  },

  // ─── Провайдер свойств: числовые параметры ТС ──────────────────────────────

  'property:numericParam'(e: Context & ManifestPropertyProvider): ObjectPropertyProvider {
    return {
      getProperties(objects: VehicleTrackRule[]) {
        const field = e.field as keyof VehicleTrackRule;
        if (!field) return [];
        return [{
          id: `vehicletrack-${field}`,
          label: e.label ?? String(field),
          description: e.description,
          group: e.group,
          value() {
            const val = objects[0]?.[field];
            for (let i = 1; i < objects.length; i++) {
              if (objects[i][field] !== val) {
                return { label: e.tr('**Различные**'), suffix: 'м' };
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
                if (!isFinite(num)) return;
                for (const obj of objects) {
                  try { (obj as any)[field] = num; } catch (err) { console.error(err); }
                }
              },
              validate(value) {
                if (!value) return e.tr('Поле не может быть пустым');
                if (!isFinite(parseFloat(value))) return e.tr('Введите число');
                if (parseFloat(value) <= 0) return e.tr('Значение должно быть больше 0');
              },
            };
          },
        }];
      },
    };
  },
};
