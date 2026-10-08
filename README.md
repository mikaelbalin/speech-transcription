# Speech Transcription

Десктопное приложение для распознавания речи. Записывает аудио с микрофона, стримит его
в realtime-API Mistral AI и вставляет распознанный текст в то текстовое поле, в котором
сейчас находится курсор пользователя.

Построено на Tauri 2 (Rust backend + React/TypeScript frontend). В качестве референса по
архитектуре используется Handy (https://github.com/cjpais/Handy).

## Ключевые архитектурные решения

- **Одно окно настроек** + **оверлей-слой** (см. этап «Оверлей» ниже): маленький
  слой (gtk-layer-shell), прижатый к верхнему краю экрана, с карточкой живой
  транскрипции — вместо попыток позиционировать отдельное окно на Wayland.
- **Только API Mistral** — локальные модели не используются. Используется
  `voxtral-mini-transcribe-realtime-2602` через WebSocket (`wss://api.mistral.ai`).
- **Стратегия вставки: «финальная фиксация»** — накапливаем дельты распознавания,
  показываем живой текст в UI, а в активное поле вставляем финальную фразу по событию
  `transcription.done`. (Realtime-дельты модель может пересматривать, поэтому вставка
  их напрямую оставляла бы неисправимый мусор во внешнем поле.)
- **Кроссплатформенная вставка** (см. «Вставка текста» ниже): эмуляция вставки через
  `enigo` на Windows/macOS/X11 и через `uinput` на Wayland. Fallback — только в буфер
  обмена, если нужные права недоступны.

## Ограничения платформ (важно)

### Wayland не позволяет позиционировать окна

На Wayland позицию окна определяет композитор (а не приложение): `set_position`
игнорируется, а `always_on_top` не гарантирован. Это осознанное дизайнерское решение
Wayland ради безопасности, а не ограничение нашего кода.

### Wayland не позволяет эмулировать ввод без привилегий

Отправка нажатий клавиш (например, Ctrl+V) в другие приложения на Wayland заблокирована.
Единственный универсальный обходной путь — `uinput` (виртуальное устройство ввода на
уровне ядра), который работает на любом композиторе (KDE, GNOME, wlroots), но требует
доступа на запись к `/dev/uinput` (root, либо группа `input` через udev-правило).
Интерактивного «запроса разрешения» для этого не существует — это статическое право,
а не диалог подтверждения.

Во время разработки систему (этот агент) изменять **запрещено**. Настраивать эти права
должен **установщик** (не разработчик) при установке, и убирать их при удалении.

---

# План реализации

Этапы выполняются по порядку. Каждый этап завершается проверкой (checkpoint) перед
переходом к следующему.

- [x] Настройки (Rust store + React-форма)

  - `settings.rs`: структура `AppSettings` — `api_key`, `model`
    (по умолчанию `voxtral-mini-transcribe-realtime-2602`), `sample_rate` (по умолчанию
    16000), `target_delay_ms` (опционально), `shortcut`, `base_url` (по умолчанию
    `wss://api.mistral.ai`).
  - Хранение через `tauri-plugin-store`.
  - Frontend: форма настроек — поле API-ключа, выбор модели, `base_url` и горячей
    клавиши. (Выбор микрофона и редактирование `sample_rate`/`target_delay_ms` пока
    не выведены в форму — хотя `get_devices` уже реализован.)

  **Требования к форме:**
  - Использовать **TanStack Form** (`@tanstack/react-form`) + **Zod** для валидации.
  - Компоненты — **shadcn** (`Field`, `FieldLabel`, `Input`, `Select`, `Button`, `Card`
    и т.д.), по гайду: https://ui.shadcn.com/docs/forms/tanstack-form
  - Валидация схемы через Zod (`formSchema`), вывод ошибок через `<FieldError />`,
    атрибуты `data-invalid` / `aria-invalid`.
  
  **Checkpoint:** настройки сохраняются, загружаются и переживают перезапуск приложения;
  форма валидирует через Zod и показывает ошибки.

- [x] Захват аудио

  Захват микрофона и приведение к `pcm_s16le` mono 16 кГц.

  - **Linux**: использовать `parec` (PulseAudio/PipeWire), запуск процесса `parec --format=s16le --rate=<rate>
    --channels=1`, чтение stdout как потока `Uint8Array`-чанков (в Rust — чтение stdout
    подпроцесса).
  - **Windows / macOS**: `parec` недоступен, поэтому использовать `cpal` для захвата и
    нормализации в тот же `pcm_s16le` mono 16 кГц.
  
  > Примечание: `parec` — Linux-only. Для кроссплатформенности захват разветвляется по
  > ОС: `parec` на Linux, `cpal` на Windows/macOS.
  
  - Команда `list_input_devices()` для выбора устройства в настройках.
  
  **Checkpoint:** аудио-чанки корректного формата (16 кГц, mono, s16le) текут в WebSocket.

- [x] Mistral realtime WebSocket

  - `mistral.rs`: подключение к
    `wss://api.mistral.ai/v1/audio/transcriptions/realtime?model=...`.
  - Аутентификация через заголовок `Authorization: Bearer <api_key>` (нативный клиент —
    `client_auth`/`rt_`-токен не нужен, в отличие от браузерных клиентов).
  - Отправка аудио-чанков; разбор событий `transcription.text.delta`,
    `transcription.done`, `error`.
  
  **Зависимости:** `tokio`, `tokio-tungstenite` (+ `rustls`), `futures-util`, `serde_json`.
  
  **Checkpoint:** говорим в микрофон -> получаем и логируем дельты и `done`.

- [x] Вставка текста в активное поле

  - `paste.rs`: сохранить буфер → записать текст → отправить вставку → восстановить буфер.
  - Windows/macOS/X11: `enigo` (Ctrl+V / Cmd+V).
  - Linux Wayland: сырой `libc`-`uinput` (виртуальная клавиатура) для отправки Ctrl+V.
  - Fallback: если `/dev/uinput` недоступен — писать текст только в буфер (пользователь
    жмёт Ctrl+V вручную).
  
  **Зависимости:** `enigo`, `tauri-plugin-clipboard-manager`, `libc` (только Linux).

  **Почему uinput требует udev-правило (важный вывод)**
  
  На Wayland (KDE KWin/GNOME) `uinput` сам по себе **недостаточен** — устройство
  создаётся и классифицируется как клавиатура, но compositor его игнорирует. Цепочка
  причин:
  
  1. uinput-устройство должно заявлять **полный диапазон клавиш `KEY_ESC..KEY_D`
    (keycodes 1–31)** + `EV_REP` + `EV_LED`, иначе udev-`input_id` не выставит
    `ID_INPUT_KEYBOARD=1` (крейт `evdev` этого не умеет — поэтому используется
    сырой `libc` ioctl).
  2. Но даже с `ID_INPUT_KEYBOARD=1` устройство не получает `ID_SEAT=seat0`:
    у него нет физического пути (`phys` пуст), и udev-`path_id` не может вывести
    `ID_PATH_TAG` → `ID_SEAT`.
  3. `libinput` (внутри compositor) создан для `seat0` и **игнорирует** любое
    устройство без `ID_SEAT`.
  
  Поэтому нужен udev-правило, явно задающее `ID_SEAT=seat0` + теги `seat`/`uaccess`
  для наших устройств. Его ставит **установщик** (этап 7) и **скрипт разработки**
  (`scripts/dev-udev-enable.sh`). Правило в `~/.config/udev/rules.d/` НЕ читается
  udev-демоном — нужен `/etc/udev/rules.d/` (root).

  4. Дополнительно: KWin/libinput подхватывает uinput-устройство **не мгновенно** —
    после `UI_DEV_CREATE` нужна пауза (~1с) перед отправкой клавиш, иначе события
    молча теряются. Поэтому `send_paste()` спит 1с между созданием устройства и
    отправкой Ctrl+V.

**Checkpoint:** текст появляется в фокусном внешнем приложении; буфер восстановлен. ✅

- [x] Глобальная горячая клавиша
  
  - `shortcut.rs`: регистрация глобального хоткея через `tauri-plugin-global-shortcut`.
  - Запуск/остановка диктовки; перерегистрация при смене настройки.
  
  **Зависимости:** `tauri-plugin-global-shortcut`.
  
  **Checkpoint:** хоткей переключает диктовку из любого приложения.

- [x] Связывание воедино (state + команды + события)

  - `TranscriptionManager` (Rust state): владеет WebSocket, аудио-потоком, буфером текста.
  - Команды: `start_transcription`, `stop_transcription`, `get_devices`,
    `get_settings`, `set_settings`.
  - События во frontend: `toggle-dictation` (от хоткея), `transcription-delta`,
    `transcription-done`, `transcription-error`.
  
  **Checkpoint:** полный цикл диктовки работает end-to-end.

- [ ] Упаковка + установщик

  - Основной формат для проверки — **AppImage** (самодостаточный файл, без установки).
  - Настройка автопаста (udev-правило + группа `input`) выполняется **из приложения**
    при первом запуске через `pkexec` (экран `Onboarding`), а не через
    `postinst`/`postrm` (у AppImage нет шага установки).

  **Статус:** частично реализовано. AppImage-таргет настроен (`targets: ["appimage"]`),
  onboarding-экран + команды `check_setup_status` / `run_setup` / `revert_setup`
  готовы (`src-tauri/src/setup.rs`, `src/components/pages/onboarding.tsx`).
  `.deb`/`.rpm` с `postinst`/`postrm` для авто-отката на native-системах — не сделано.

  **Checkpoint:** чистая установка на свежую систему → автопаст работает; удаление
  откатывает udev-правило и членство в группе.

- [x] Оверлей

  Показывать живой текст распознавания в отдельном окне поверх активного приложения.
  На Wayland позиционировать окно нельзя, поэтому используется **маленький слой**
  (gtk-layer-shell), прижатый к верхнему краю экрана по центру — как в Handy.

  **Почему так, а не полноэкранное прозрачное окно.** На Wayland композитор сам решает,
  где окну стоять, а `set_position` игнорируется (см. «Ограничения платформ»). Полноэкранный
  прозрачный слой с «клик-сквозью» (пустым input region) оказался неработоспособен:
  GDK не применяет input region к layer-shell поверхностям, а сырой FFI к `wl_surface`
  требовал ручного кодирования opcode'ов Wayland-протокола и был слишком хрупким.
  Вместо этого окно-слой делается маленьким и прижимается к верхнему краю — оно занимает
  только свою площадь и не перехватывает клики по остальному экрану.

  **Стек и зависимости (Linux):** `gtk-layer-shell` (рантайм-библиотека `libgtk-layer-shell.so.0`;
  на Fedora/Bazzite пакет `gtk-layer-shell`, для сборки `gtk-layer-shell-devel`).
  Для распространения через Flatpak библиотека упаковывается внутрь Flatpak.

  **Этапы:**

  1. **Второе окно-слой.** Создать `WebviewWindowBuilder` с label `recording_overlay`
     и отдельной точкой входа `src/overlay/` (как в Handy): `decorations(false)`,
     `transparent(true)`, `focusable(false)`, `skip_taskbar(true)`, изначально
     `visible(false)`. Добавить вторую entry в `rollupOptions.input` в Vite.
  2. **Превратить окно в слой** (gtk-layer-shell): `init_layer_shell()`,
     `set_layer(Layer::Overlay)`, `set_keyboard_mode(KeyboardMode::None)`,
     `set_exclusive_zone(0)`. Окно привязывается **к верхнему краю**
     (`set_anchor(Edge::Top, true)`), размер задаётся через `set_size_request` +
     `resize(1, 1)` (у layer-shell размер берётся из size request, а не `set_size`).
  3. **Прозрачность.** Webview с прозрачным фоном — видна только карточка оверлея.
  4. **Карточка сверху по центру.** Оверлей — обычный HTML-элемент, растянутый на всю
     площадь маленького окна; перетаскивание не требуется.
  5. **Показ/скрытие по событиям.** `show-overlay` / `hide-overlay`, показ по началу
     диктовки, скрытие по завершении.
  6. **Fallback.** Если `gtk_layer_shell::is_supported()` вернул `false` (например, GNOME
     или X11) — обычное `always_on_top` окно (без гарантий позиции).

  **Ограничение (KDE/Wayland).** Маленький слой не перехватывает фокус ввода
  (`focusable(false)` + `set_keyboard_mode(None)`), поэтому вставка текста в активное
  поле продолжает работать. Handy по этой же причине держит оверлей маленьким, а не
  полноэкранным.

  **Checkpoint:** карточка появляется поверх всех окон сверху по центру во время
  диктовки; вставка текста и клики в активном приложении работают как раньше.

---

# Структура Rust-бэкенда

Бэкенд организован по образцу Handy (менеджеры + команды + модули-утилиты), но
значительно меньше: у нас нет локальных моделей, VAD и истории. Принципы:

- **Менеджеры** — состояние и бизнес-логика (владеют ресурсами, `Arc<...>` в Tauri state).
- **Команды** — тонкие `#[tauri::command]`- обработчики, вызывающие менеджеры.
- **Модули-утилиты** — чистая логика без состояния (формат аудио, платформы и т.п.).
- **Файлы небольшие** — один файл = одна зона ответственности, без «всё в одном».

```
src-tauri/src/
├── main.rs              # точка входа (вызывает lib::run)
├── lib.rs               # сборка приложения: плагины, setup, state, invoke_handler
├── settings.rs          # AppSettings + чтение/запись в store (чистые функции)
├── commands/            # Tauri-команды (тонкие обёртки над менеджерами)
│   ├── mod.rs           # re-export всех команд
│   ├── settings.rs      # get_settings / set_settings
│   ├── audio.rs         # get_devices (список микрофонов)
│   └── transcription.rs # start_transcription / stop_transcription
├── managers/            # состояние и бизнес-логика
│   ├── mod.rs
│   └── transcription.rs # TranscriptionManager: владеет аудио + WebSocket + буфер
├── audio/               # захват аудио
│   ├── mod.rs           # публичный API (start/stop, итератор чанков)
│   ├── parec.rs         # Linux: обёртка над `parec` (pcm_s16le mono 16 кГц)
│   └── cpal_impl.rs     # Windows/macOS: захват через cpal + нормализация
├── mistral/             # клиент Mistral realtime
│   ├── mod.rs           # публичный API (connect, send, события)
│   └── protocol.rs      # типы событий (delta / done / error) + сериализация
├── paste/               # вставка текста в активное поле
│   ├── mod.rs           # публичный API (paste(text) -> Result) + логика буфера
│   ├── enigo_impl.rs    # Windows/macOS/X11: clipboard + Ctrl+V
│   └── uinput_impl.rs   # Linux Wayland: uinput-клавиатура
└── shortcut.rs          # регистрация глобального хоткея
```

> Определение ОС/Wayland/X11 не вынесено в отдельный `platform.rs`: ветвление
> сделано инлайн через `#[cfg(target_os = "linux")]` внутри `audio/` и `paste/`.
> Логика буфера (сохранить/восстановить) встроена в `paste/mod.rs`, отдельного
> `clipboard.rs` нет.

**Зоны ответственности (кратко):**

| Модуль | Отвечает за | Состояние? |
| --- | --- | --- |
| `settings.rs` | модель настроек + store | нет (чистые функции) |
| `commands/*` | Tauri-команды | нет (обёртки) |
| `managers/transcription.rs` | оркестрация диктовки | да (`Arc<AtomicBool>`) |
| `audio/*` | захват микрофона → PCM | да (стрим/процесс) |
| `mistral/*` | WebSocket + события | да (соединение) |
| `paste/*` | вставка в активное поле | нет |
| `shortcut.rs` | глобальный хоткей | нет |

**Правила:**
- Команды НЕ содержат логику — только вызывают менеджеры/модули.
- Менеджеры НЕ знают про Tauri-команды — только про `AppHandle` (для событий).
- Кроссплатформенные ветвления (`#[cfg(...)]`) изолированы внутри `audio/` и `paste/`.

---

# Разработка

```bash
pnpm install
pnpm tauri dev
```

## Настройка uinput для Wayland (dev)

На KDE/GNOME Wayland вставка через `uinput` работает только после установки
udev-правила, привязывающего наше устройство к `seat0` (см. этап 4). Для dev-режима
есть скрипты (требуют `sudo`):

```bash
sudo scripts/dev-udev-enable.sh   # поставить правило + перезагрузить udev
sudo scripts/dev-udev-disable.sh  # убрать правило + перезагрузить udev (откат)
```

## Сборка AppImage

```bash
pnpm build:appimage  # NO_STRIP=1 tauri build --bundles appimage
```

Результат — один самодостаточный файл в
`src-tauri/target/release/bundle/appimage/`. Для запуска достаточно сделать его
исполняемым; удаление — просто удалить файл. Никакой установки в систему нет.

**Замечания по сборке:**
- `NO_STRIP=1` обязателен на Fedora/Bazzite: системные библиотеки собраны с
  RELR-релокациями (`.relr.dyn`), а встроенный в linuxdeploy `strip` их не
  понимает и падает с `failed to run linuxdeploy`.
- `bundleMediaFramework` **выключен** — приложение не использует GStreamer
  (аудио идёт через `parec`/`cpal` и WebSocket), а gstreamer-плагин linuxdeploy
  требует `patchelf`.

Зависимость рантайма: `gtk-layer-shell` (`libgtk-layer-shell.so.0`) должна быть
доступна в системе (на Bazzite/Fedora — пакет `gtk-layer-shell`).

## Onboarding: настройка автопаста из приложения

При первом запуске показывается экран `Onboarding`, который объясняет, зачем нужна
настройка хоста, и кнопкой запускает установку udev-правила через **`pkexec`**
(PolicyKit) — открывается нативный диалог ввода пароля. Доступ к `/dev/uinput` на
современных systemd-десктопах даётся активному пользователю автоматически через
механизм `uaccess` (ACL от systemd-logind), поэтому членство в группе `input` не
требуется и приложение его не использует. Реализация:

- Rust: `src-tauri/src/setup.rs` (проверка статуса + helper-скрипт + запуск через
  `pkexec`), команды `check_setup_status` / `run_setup` / `revert_setup`
  (`src-tauri/src/commands/setup.rs`).
- Флаг «настройка выполнена/пропущена» хранится в `settings` (`setup_completed`),
  команда `mark_setup_complete` помечает его. Маршрут `/` редиректит на
  `/onboarding`, пока флаг не выставлен.
- Frontend: `src/components/pages/onboarding.tsx` + `src/routes/onboarding.tsx`.

**Почему pkexec, а не автоматика при «установке».** AppImage не имеет шага установки
(и `postinst`/`postrm`), поэтому нет хука, который мог бы поставить/откатить
udev-правило. Вместо этого приложение само запрашивает права у пользователя в момент
первого запуска. Это работает и без отдельного polkit-правила: `pkexec` по умолчанию
использует действие `org.freedesktop.policykit.exec` с аутентификацией администратора.

## Линт / форматирование

```bash
pnpm lint  # biome
```

## Технологический стек

- Tauri 2, Rust backend
- React 19 + TypeScript + Vite, Tailwind CSS
- pnpm workspaces
- **TanStack Form + Zod** (формы), **shadcn** (UI-компоненты)
- `parec` (Linux) / `cpal` (Win/macOS) — захват аудио
- `tokio-tungstenite` (WebSocket)
- `enigo` (Win/macOS/X11) + сырой `libc`-`uinput` (Linux Wayland) — эмуляция ввода
- `tauri-plugin-global-shortcut`, `tauri-plugin-store`, `tauri-plugin-clipboard-manager`
