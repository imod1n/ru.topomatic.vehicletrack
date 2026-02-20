/**
 * Плагин Топоматик 360: Расчёт траекторий движения ТС и коридоров движения
 * Аналог AutoTURN для платформы Топоматик Albatros
 *
 * Платформа: Топоматик 360 (IFC/BIM)
 * Документация: https://docs-staging.topomatic.ru/albatros/ru/dev/index.html
 */

import { VehicleTrackCalculator, VEHICLE_PRESETS, parseIfcAlignment } from './calculator';
import type { VehicleParams, CorridorResult, Alignment, PluginOptions } from './types';

// ─── Типы Albatros API (минимальный набор) ───────────────────────────────────

interface PluginManager {
  /** Регистрация команды */
  commands: {
    register(id: string, handler: (...args: any[]) => Promise<void>): void;
    execute(id: string, ...args: any[]): Promise<any>;
  };
  /** Доступ к 3D-viewport */
  viewport: {
    addPolyline(pts: any[], opts: any): string;
    addPolygon(pts: any[], opts: any): string;
    removeObject(id: string): void;
    refresh(): void;
    getSelection(): any[];
  };
  /** Диалоги */
  ui: {
    showPanel(id: string, component: any, opts?: any): void;
    hidePanel(id: string): void;
    showNotification(msg: string, type?: 'info' | 'success' | 'warning' | 'error'): void;
  };
  /** События */
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
}

// ─── Плагин ──────────────────────────────────────────────────────────────────

export class VehicleTrackPlugin {
  /** Идентификатор плагина (должен совпадать с именем папки) */
  static pluginId = 'ru.topomatic.vehicletrack';

  /** Идентификаторы созданных объектов в viewport (для очистки) */
  private viewportObjects: string[] = [];

  /** Ссылка на PluginManager */
  private pm!: PluginManager;

  /**
   * Точка входа — вызывается платформой при загрузке плагина
   */
  async run(pm: PluginManager): Promise<void> {
    this.pm = pm;
    console.log(`[VehicleTrack] Плагин запущен (${VehicleTrackPlugin.pluginId})`);

    // Регистрация команд
    pm.commands.register('vehicletrack.calculate', this.handleCalculate.bind(this));
    pm.commands.register('vehicletrack.clear', this.handleClear.bind(this));
    pm.commands.register('vehicletrack.open', this.handleOpen.bind(this));

    // Открываем панель UI при старте
    await this.handleOpen();
  }

  // ─── Обработчики команд ───────────────────────────────────────────────────

  /**
   * Открыть панель управления плагином
   */
  private async handleOpen(): Promise<void> {
    try {
      // Динамический импорт Vue-компонента (lazy loading)
      const { default: VehicleTrackPanel } = await import('./ui/VehicleTrackPanel.vue');

      this.pm.ui.showPanel('vehicletrack.panel', VehicleTrackPanel, {
        title: 'Коридор движения ТС',
        width: 340,
        resizable: false,
        props: { pluginManager: this.pm },
      });
    } catch (err) {
      // Fallback: если Vue не поддерживается — нативный диалог
      console.warn('[VehicleTrack] Vue недоступен, используется нативный UI', err);
      await this.showNativeDialog();
    }
  }

  /**
   * Нативный диалог без Vue (запасной вариант)
   */
  private async showNativeDialog(): Promise<void> {
    // В реальном плагине — pm.ui.showDialog() согласно документации Albatros
    // Здесь просто логируем для демонстрации
    console.log('[VehicleTrack] Нативный диалог: выберите трассу и нажмите "Рассчитать"');
    this.pm.ui.showNotification('VehicleTrack: выберите трассу в модели', 'info');
  }

  /**
   * Основная команда: расчёт и отрисовка коридора
   */
  private async handleCalculate(args: {
    vehicle: VehicleParams;
    options: PluginOptions;
  }): Promise<void> {
    // 1. Получаем выбранный объект (трасса)
    const selection = this.pm.viewport.getSelection();
    const ifcAlignment = selection.find(
      (o: any) => o?.type === 'IfcAlignment' || o?.type === 'IfcPolyline',
    );

    if (!ifcAlignment) {
      this.pm.ui.showNotification('Выберите трассу (IfcAlignment) в модели', 'warning');
      return;
    }

    // 2. Парсим трассу
    const alignment: Alignment = parseIfcAlignment(ifcAlignment);
    console.log(`[VehicleTrack] Трасса: ${alignment.ifcId}, длина ${alignment.totalLength.toFixed(1)} м`);

    // 3. Рассчитываем коридор
    const calculator = new VehicleTrackCalculator(args.vehicle);
    const result: CorridorResult = calculator.calculateCorridor(alignment);

    console.log('[VehicleTrack] Результат:', {
      прямая: `${result.straightWidth.toFixed(2)} м`,
      внешний_R: `${result.outerRadius.toFixed(2)} м`,
      внутренний_R: `${result.innerRadius.toFixed(2)} м`,
      точек_внешний: result.outerPolyline.length,
      точек_внутренний: result.innerPolyline.length,
    });

    // 4. Очищаем предыдущий результат
    this.clearViewportObjects();

    // 5. Отрисовываем в viewport
    await this.renderCorridor(result, args.options);

    this.pm.ui.showNotification(
      `Коридор построен. Ширина: ${result.straightWidth.toFixed(2)} м`,
      'success',
    );
  }

  /**
   * Команда очистки
   */
  private async handleClear(): Promise<void> {
    this.clearViewportObjects();
    this.pm.ui.showNotification('Коридор удалён', 'info');
  }

  // ─── Отрисовка ────────────────────────────────────────────────────────────

  /**
   * Рендер коридора в viewport Топоматик 360
   */
  private async renderCorridor(result: CorridorResult, options: PluginOptions): Promise<void> {
    const color = options.corridorColor ?? '#FF6600';

    // Внешний контур
    if (options.showOuterContour) {
      const id = this.pm.viewport.addPolyline(result.outerPolyline, {
        color,
        lineWidth: 2,
        label: 'Внешний контур коридора',
      });
      this.viewportObjects.push(id);
    }

    // Внутренний контур
    if (options.showInnerContour) {
      const id = this.pm.viewport.addPolyline(result.innerPolyline, {
        color,
        lineWidth: 2,
        lineDash: [4, 4],
        label: 'Внутренний контур коридора',
      });
      this.viewportObjects.push(id);
    }

    // Залитый полигон коридора (соединяем оба контура)
    const polygonPts = [
      ...result.outerPolyline,
      ...result.innerPolyline.slice().reverse(),
    ];
    const fillId = this.pm.viewport.addPolygon(polygonPts, {
      fillColor: color,
      fillOpacity: 0.2,
      strokeColor: 'transparent',
      label: 'Коридор движения ТС',
    });
    this.viewportObjects.push(fillId);

    this.pm.viewport.refresh();
  }

  /**
   * Удаление всех объектов плагина из viewport
   */
  private clearViewportObjects(): void {
    for (const id of this.viewportObjects) {
      try {
        this.pm.viewport.removeObject(id);
      } catch {
        // Объект уже удалён — игнорируем
      }
    }
    this.viewportObjects = [];
    this.pm.viewport.refresh();
  }
}

// ─── Экспорт для Albatros ─────────────────────────────────────────────────────

export default VehicleTrackPlugin;

// Экспорт вспомогательных модулей (для тестирования и расширения)
export { VehicleTrackCalculator, VEHICLE_PRESETS, parseIfcAlignment };
export type { VehicleParams, CorridorResult, Alignment, PluginOptions };
