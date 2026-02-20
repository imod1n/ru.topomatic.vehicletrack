# ru.topomatic.vehicletrack

Плагин для **Топоматик 360 (Albatros)** — расчёт траекторий движения транспортных средств и построение коридоров движения, аналогично **AutoTURN**.

---

## 📋 Возможности

- Выбор из 5 предустановленных типов ТС (легковой, грузовики 16/20 м, автобусы 12/18 м)
- Задание пользовательских параметров ТС
- Расчёт коридора по **алгоритму AutoTURN**:
  - Прямые участки: `ширина = trackWidth + overhangFront + overhangRear`
  - Повороты: `R_outer = R + (wheelbase/2 + trackWidth/2 + overhangFront)`
- Поддержка трасс `IfcAlignment` и `IfcPolyline`
- Отображение внешнего/внутреннего контуров с заливкой
- Vue.js 3 UI панель

---

## 🚀 Установка и сборка

### Требования

- Node.js 18+
- npm 9+
- Топоматик 360 (Albatros) 1.0+

### Шаги

```bash
# 1. Клонируйте или скопируйте папку плагина
cd ru.topomatic.vehicletrack

# 2. Установите зависимости
npm install

# 3. Соберите плагин
npm run build

# 4. Скопируйте dist/ в папку плагинов Топоматик 360
# Windows: %APPDATA%\Topomatic\Albatros\plugins\ru.topomatic.vehicletrack\
# Linux:   ~/.local/share/topomatic/albatros/plugins/ru.topomatic.vehicletrack/
```

### Разработка (с автоперезагрузкой)

```bash
npm run dev
```

---

## 📁 Структура проекта

```
ru.topomatic.vehicletrack/
├── package.json          # Зависимости и метаданные плагина
├── tsconfig.json         # Конфигурация TypeScript
├── vite.config.ts        # Конфигурация сборки
├── src/
│   ├── index.ts          # Точка входа, регистрация плагина
│   ├── types.ts          # TypeScript-интерфейсы
│   ├── calculator.ts     # Алгоритм AutoTURN
│   └── ui/
│       └── VehicleTrackPanel.vue  # Vue.js панель управления
└── dist/                 # Результат сборки (генерируется)
    ├── index.js
    └── index.esm.js
```

---

## 🔧 Параметры транспортных средств

| ТС | Колёсная база | Ширина колеи | Мин. R поворота |
|----|--------------|--------------|----------------|
| Легковой | 2.7 м | 1.8 м | 5.5 м |
| Грузовик 16 м | 5.5 м | 2.5 м | 9.0 м |
| Грузовик 20 м | 6.0 м | 2.5 м | 12.0 м |
| Автобус 12 м | 5.9 м | 2.3 м | 10.5 м |
| Автобус 18 м | 12.0 м | 2.55 м | 11.5 м |

---

## 📐 Алгоритм AutoTURN

### Прямые участки

```
corridorWidth = trackWidth + overhangFront + overhangRear
```

### Повороты

```
R_outer = R + (wheelbase/2 + trackWidth/2 + overhangFront)
R_inner = R - (wheelbase/2 + trackWidth/2)
```

где `R` — радиус поворота трассы.

---

## 🖥️ Использование в Топоматик 360

1. Откройте модель с трассой (IfcAlignment)
2. Плагин автоматически откроет панель «Коридор движения ТС»
3. Выберите тип ТС или задайте параметры вручную
4. Кликните на трассу в модели
5. Нажмите **«Рассчитать коридор»**
6. Коридор отобразится в viewport

---

## 🛠 Расширение плагина

Добавить собственный тип ТС:

```typescript
import { VEHICLE_PRESETS } from 'ru.topomatic.vehicletrack';

VEHICLE_PRESETS['my_vehicle'] = {
  name: 'Мой автомобиль',
  wheelbase: 3.2,
  trackWidth: 2.0,
  overhangFront: 1.0,
  overhangRear: 1.2,
  minTurningRadius: 6.5,
  totalLength: 6.5,
};
```

---

## 📚 Документация

- [Albatros Plugin API](https://docs-staging.topomatic.ru/albatros/ru/dev/index.html)
- [Пример плагина Топоматик](https://github.com/topomatic-code/ru.topomatic.rule.volume)

---

## 📄 Лицензия

MIT
