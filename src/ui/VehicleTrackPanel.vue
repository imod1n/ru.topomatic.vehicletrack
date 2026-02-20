<template>
  <div class="vehicle-track-panel">
    <h3 class="panel-title">🚛 Коридор движения ТС</h3>

    <!-- Выбор транспортного средства -->
    <div class="form-group">
      <label>Тип транспортного средства</label>
      <select v-model="selectedPreset" @change="onPresetChange">
        <option value="passenger_car">Легковой автомобиль</option>
        <option value="truck_16m">Грузовик 16 м</option>
        <option value="truck_20m">Грузовик 20 м</option>
        <option value="bus_12m">Автобус 12 м</option>
        <option value="bus_articulated">Автобус сочленённый 18 м</option>
        <option value="custom">Пользовательский...</option>
      </select>
    </div>

    <!-- Параметры ТС (редактируемые при custom или для просмотра) -->
    <div class="vehicle-params" :class="{ editable: selectedPreset === 'custom' }">
      <div class="param-row">
        <label>Колёсная база (м)</label>
        <input type="number" v-model.number="vehicle.wheelbase" :disabled="selectedPreset !== 'custom'" step="0.1" min="1" max="15" />
      </div>
      <div class="param-row">
        <label>Ширина колеи (м)</label>
        <input type="number" v-model.number="vehicle.trackWidth" :disabled="selectedPreset !== 'custom'" step="0.05" min="1" max="3" />
      </div>
      <div class="param-row">
        <label>Передний свес (м)</label>
        <input type="number" v-model.number="vehicle.overhangFront" :disabled="selectedPreset !== 'custom'" step="0.1" min="0" max="5" />
      </div>
      <div class="param-row">
        <label>Задний свес (м)</label>
        <input type="number" v-model.number="vehicle.overhangRear" :disabled="selectedPreset !== 'custom'" step="0.1" min="0" max="5" />
      </div>
      <div class="param-row">
        <label>Мин. радиус поворота (м)</label>
        <input type="number" v-model.number="vehicle.minTurningRadius" :disabled="selectedPreset !== 'custom'" step="0.5" min="3" max="30" />
      </div>
    </div>

    <!-- Настройки отображения -->
    <div class="form-group">
      <label class="checkbox-label">
        <input type="checkbox" v-model="options.showOuterContour" />
        Показать внешний контур
      </label>
      <label class="checkbox-label">
        <input type="checkbox" v-model="options.showInnerContour" />
        Показать внутренний контур
      </label>
    </div>

    <div class="form-group">
      <label>Цвет коридора</label>
      <input type="color" v-model="options.corridorColor" />
    </div>

    <!-- Информация о выбранной трассе -->
    <div class="alignment-info" v-if="alignmentInfo">
      <strong>Трасса:</strong> {{ alignmentInfo.name }}<br />
      <strong>Длина:</strong> {{ alignmentInfo.length.toFixed(1) }} м
    </div>
    <div class="alignment-info warning" v-else>
      ⚠️ Выберите трассу в модели
    </div>

    <!-- Расчётные значения -->
    <div class="calc-results" v-if="calcPreview">
      <div class="result-row">
        <span>Ширина коридора (прямая):</span>
        <strong>{{ calcPreview.straightWidth.toFixed(2) }} м</strong>
      </div>
      <div class="result-row">
        <span>Внешний радиус поворота:</span>
        <strong>{{ calcPreview.outerRadius.toFixed(2) }} м</strong>
      </div>
      <div class="result-row">
        <span>Внутренний радиус поворота:</span>
        <strong>{{ calcPreview.innerRadius.toFixed(2) }} м</strong>
      </div>
    </div>

    <!-- Кнопки -->
    <div class="actions">
      <button class="btn-primary" @click="onCalculate" :disabled="isCalculating || !alignmentInfo">
        {{ isCalculating ? '⏳ Расчёт...' : '▶ Рассчитать коридор' }}
      </button>
      <button class="btn-secondary" @click="onClear" :disabled="!hasResult">
        🗑 Очистить
      </button>
    </div>

    <!-- Статус -->
    <div class="status" :class="statusClass" v-if="statusMessage">
      {{ statusMessage }}
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, reactive, computed, onMounted } from 'vue';
import type { VehicleParams, VehiclePreset, PluginOptions } from '../types';
import { VEHICLE_PRESETS, VehicleTrackCalculator } from '../calculator';

export default defineComponent({
  name: 'VehicleTrackPanel',

  props: {
    /** Ссылка на PluginManager Топоматик 360 */
    pluginManager: {
      type: Object,
      required: true,
    },
  },

  setup(props) {
    const selectedPreset = ref<VehiclePreset>('truck_16m');
    const isCalculating = ref(false);
    const hasResult = ref(false);
    const statusMessage = ref('');
    const statusClass = ref('');

    // Текущие параметры ТС
    const vehicle = reactive<VehicleParams>({ ...VEHICLE_PRESETS.truck_16m });

    // Настройки отображения
    const options = reactive<Pick<PluginOptions, 'showOuterContour' | 'showInnerContour' | 'corridorColor'>>({
      showOuterContour: true,
      showInnerContour: true,
      corridorColor: '#FF6600',
    });

    const alignmentInfo = ref<{ name: string; length: number } | null>(null);

    // Предварительный расчёт (отображается без нажатия кнопки)
    const calcPreview = computed(() => {
      const calc = new VehicleTrackCalculator(vehicle);
      const R = vehicle.minTurningRadius;
      return {
        straightWidth: calc.straightWidth,
        outerRadius: calc.outerRadius(R),
        innerRadius: calc.innerRadius(R),
      };
    });

    // Слушаем выбор объекта в модели
    onMounted(() => {
      try {
        props.pluginManager?.on?.('selectionChanged', (selection: any[]) => {
          const align = selection?.find((o: any) =>
            o?.type === 'IfcAlignment' || o?.type === 'IfcPolyline',
          );
          if (align) {
            alignmentInfo.value = {
              name: align.Name ?? align.GlobalId ?? 'Трасса',
              length: align.TotalLength ?? 0,
            };
          } else {
            alignmentInfo.value = null;
          }
        });
      } catch {
        // В демо-режиме без реального API — показываем заглушку
        alignmentInfo.value = { name: 'Демо-трасса', length: 75.7 };
      }
    });

    function onPresetChange() {
      if (selectedPreset.value !== 'custom') {
        Object.assign(vehicle, VEHICLE_PRESETS[selectedPreset.value]);
      }
    }

    async function onCalculate() {
      isCalculating.value = true;
      statusMessage.value = '';
      try {
        await props.pluginManager?.commands?.execute('vehicletrack.calculate', {
          vehicle: { ...vehicle },
          options: { ...options },
        });
        hasResult.value = true;
        statusMessage.value = '✅ Коридор построен успешно';
        statusClass.value = 'success';
      } catch (err: any) {
        statusMessage.value = `❌ Ошибка: ${err?.message ?? 'неизвестная ошибка'}`;
        statusClass.value = 'error';
      } finally {
        isCalculating.value = false;
      }
    }

    async function onClear() {
      try {
        await props.pluginManager?.commands?.execute('vehicletrack.clear');
        hasResult.value = false;
        statusMessage.value = 'Коридор удалён';
        statusClass.value = 'info';
      } catch (err: any) {
        statusMessage.value = `❌ Ошибка: ${err?.message}`;
        statusClass.value = 'error';
      }
    }

    return {
      selectedPreset, vehicle, options, alignmentInfo,
      calcPreview, isCalculating, hasResult, statusMessage, statusClass,
      onPresetChange, onCalculate, onClear,
    };
  },
});
</script>

<style scoped>
.vehicle-track-panel {
  padding: 12px;
  font-family: system-ui, sans-serif;
  font-size: 13px;
  color: #333;
  max-width: 320px;
}
.panel-title { margin: 0 0 12px; font-size: 15px; font-weight: 600; }
.form-group { margin-bottom: 10px; }
.form-group label { display: block; margin-bottom: 4px; font-weight: 500; }
.form-group select,
.form-group input[type="color"] { width: 100%; padding: 4px; border-radius: 4px; border: 1px solid #ccc; }
.vehicle-params { background: #f5f5f5; border-radius: 6px; padding: 8px; margin-bottom: 10px; }
.vehicle-params.editable { background: #fff8e1; border: 1px solid #ffc107; }
.param-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.param-row input { width: 80px; padding: 2px 6px; border: 1px solid #ccc; border-radius: 4px; text-align: right; }
.param-row input:disabled { background: #eee; color: #666; }
.checkbox-label { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; cursor: pointer; }
.alignment-info { background: #e8f4fd; border: 1px solid #90caf9; border-radius: 4px; padding: 8px; margin-bottom: 10px; font-size: 12px; }
.alignment-info.warning { background: #fff3e0; border-color: #ffb74d; }
.calc-results { background: #f0f4f0; border-radius: 6px; padding: 8px; margin-bottom: 10px; }
.result-row { display: flex; justify-content: space-between; margin-bottom: 2px; }
.actions { display: flex; gap: 8px; }
.btn-primary { flex: 1; padding: 8px; background: #1565c0; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
.btn-primary:disabled { background: #90a4ae; cursor: not-allowed; }
.btn-secondary { padding: 8px 12px; background: #e0e0e0; border: none; border-radius: 6px; cursor: pointer; }
.btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
.status { margin-top: 8px; padding: 6px; border-radius: 4px; font-size: 12px; }
.status.success { background: #e8f5e9; color: #2e7d32; }
.status.error { background: #ffebee; color: #c62828; }
.status.info { background: #e3f2fd; color: #1565c0; }
</style>
