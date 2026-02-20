import { VehicleTrackCalculator, VEHICLE_PRESETS, parseIfcAlignment } from './calculator';
import type { VehicleParams, CorridorResult, Alignment, PluginOptions } from './types';
import VehicleTrackPanel from './ui/VehicleTrackPanel.vue';

interface PluginManager {
  commands: {
    register(id: string, handler: (...args: any[]) => Promise<void>): void;
    execute(id: string, ...args: any[]): Promise<any>;
  };
  viewport: {
    addPolyline(pts: any[], opts: any): string;
    addPolygon(pts: any[], opts: any): string;
    removeObject(id: string): void;
    refresh(): void;
    getSelection(): any[];
  };
  ui: {
    showPanel(id: string, component: any, opts?: any): void;
    hidePanel(id: string): void;
    showNotification(msg: string, type?: 'info' | 'success' | 'warning' | 'error'): void;
  };
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
}

export class VehicleTrackPlugin {
  static pluginId = 'ru.topomatic.vehicletrack';
  private viewportObjects: string[] = [];
  private pm!: PluginManager;

  async run(pm: PluginManager): Promise<void> {
    this.pm = pm;
    console.log(`[VehicleTrack] Плагин запущен (${VehicleTrackPlugin.pluginId})`);
    pm.commands.register('vehicletrack.calculate', this.handleCalculate.bind(this));
    pm.commands.register('vehicletrack.clear', this.handleClear.bind(this));
    pm.commands.register('vehicletrack.open', this.handleOpen.bind(this));
    await this.handleOpen();
  }

  private async handleOpen(): Promise<void> {
    try {
      this.pm.ui.showPanel('vehicletrack.panel', VehicleTrackPanel, {
        title: 'Коридор движения ТС',
        width: 340,
        resizable: false,
        props: { pluginManager: this.pm },
      });
    } catch (err) {
      console.warn('[VehicleTrack] Ошибка открытия панели', err);
      this.pm.ui.showNotification('VehicleTrack: выберите трассу в модели', 'info');
    }
  }

  private async handleCalculate(args: { vehicle: VehicleParams; options: PluginOptions }): Promise<void> {
    const selection = this.pm.viewport.getSelection();
    const ifcAlignment = selection.find(
      (o: any) => o?.type === 'IfcAlignment' || o?.type === 'IfcPolyline',
    );
    if (!ifcAlignment) {
      this.pm.ui.showNotification('Выберите трассу (IfcAlignment) в модели', 'warning');
      return;
    }
    const alignment: Alignment = parseIfcAlignment(ifcAlignment);
    const calculator = new VehicleTrackCalculator(args.vehicle);
    const result: CorridorResult = calculator.calculateCorridor(alignment);
    this.clearViewportObjects();
    await this.renderCorridor(result, args.options);
    this.pm.ui.showNotification(`Коридор построен. Ширина: ${result.straightWidth.toFixed(2)} м`, 'success');
  }

  private async handleClear(): Promise<void> {
    this.clearViewportObjects();
    this.pm.ui.showNotification('Коридор удалён', 'info');
  }

  private async renderCorridor(result: CorridorResult, options: PluginOptions): Promise<void> {
    const color = options.corridorColor ?? '#FF6600';
    if (options.showOuterContour) {
      const id = this.pm.viewport.addPolyline(result.outerPolyline, { color, lineWidth: 2, label: 'Внешний контур коридора' });
      this.viewportObjects.push(id);
    }
    if (options.showInnerContour) {
      const id = this.pm.viewport.addPolyline(result.innerPolyline, { color, lineWidth: 2, lineDash: [4, 4], label: 'Внутренний контур коридора' });
      this.viewportObjects.push(id);
    }
    const polygonPts = [...result.outerPolyline, ...result.innerPolyline.slice().reverse()];
    const fillId = this.pm.viewport.addPolygon(polygonPts, { fillColor: color, fillOpacity: 0.2, strokeColor: 'transparent', label: 'Коридор движения ТС' });
    this.viewportObjects.push(fillId);
    this.pm.viewport.refresh();
  }

  private clearViewportObjects(): void {
    for (const id of this.viewportObjects) {
      try { this.pm.viewport.removeObject(id); } catch {}
    }
    this.viewportObjects = [];
    this.pm.viewport.refresh();
  }
}

export default VehicleTrackPlugin;
export { VehicleTrackCalculator, VEHICLE_PRESETS, parseIfcAlignment };
export type { VehicleParams, CorridorResult, Alignment, PluginOptions };
