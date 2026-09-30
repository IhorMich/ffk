# Matchcard

Дневник оценок футбольного матча для игрока, родителя и тренера.

После игры (или прямо у поля) можно записать, как сыграл ребёнок или состав, получить оценку из 10, сохранить сезон и поделиться карточкой в мессенджере. Отдельно есть **Matchcard Coach** — командный режим с академией, составом и приглашениями родителей.

Живая страница: [https://ihormich.github.io/ffk/](https://ihormich.github.io/ffk/)

## Продукты

| Режим | Для кого | Что даёт |
| --- | --- | --- |
| **Free** | Игрок / родитель | 1 игрок на телефоне, матчи, история, базовые карточки. Данные в основном локально. |
| **Matchcard Pro** | Тот же личный режим | До 32 игроков, сезоны без лимита, графики, облачный автосинк между устройствами. |
| **Matchcard Coach** | Тренер | Академия → команда → игроки, командные матчи, аналитика, invite родителя к карточке ребёнка. Отдельный продукт от Free/Pro. |

Тестовое включение Pro / Coach пока доступно в настройках (оплата через магазин позже).

## Что умеет личный Matchcard

- считает **вклад** (действия на поле) и **старание** (поведение);
- собирает **общую оценку** (база 6,0, итог 0–10 с одним знаком);
- ведёт **сезоны** футбольного года с 1 июля (`2026/27`);
- рисует **карточки** матча, сезона и периода для шеринга;
- после серии игр показывает сильные стороны, зоны развития и короткий разбор;
- **быстрый режим** у поля: крупные кнопки, игровые часы, лента действий по минутам.

Позиции (нападающий, полузащита, защита, вратарь) меняют набор действий и веса. Повтор одного действия весит меньше первого. Короткий выход слабее качает оценку; средняя за сезон взвешена по минутам.

Шкалы «как играл» (1–5): интенсивность, игра в команде, слушал тренера, дисциплина. **Настроение в оценку не входит.**

## Вкладки

Внизу: **Игрок** (в режиме Coach — команда) · **Матч** · **История** · **Статистика**. Шестерёнка в шапке — настройки.

### Игрок

Профиль: фото и баннер, имя, номер, команда, позиции, сезон. Несколько карточек — в списке «Мои игроки» (Free: 1, Pro: до 32).

### Матч

Рабочий экран: живая оценка, дата, тип игры, соперник, счёт, дома/выезд, старт/скамейка, формат таймов, минуты на поле, действия и поведение, комментарий. Черновик сохраняется на телефоне. После сохранения — отчёт и карточка для мессенджера.

В режиме Coach на этой же вкладке — командный матч и оценки по игрокам состава.

### История и статистика

Список матчей с фильтром по сезону, правка и шаринг. Статистика: средние, тренд, сравнение периодов, разбор по таймам при наличии минут.

### Настройки

По порядку:

1. **Аккаунт** — Free-вход (email / Google), выход  
2. **Внешний вид** — язык, тема, иконки действий  
3. **Уведомления** — локальный push  
4. **Подписка** — Pro и Coach  
5. **Данные** — копия на телефон / восстановить / JSON, облако Pro  
6. **Помощь** — privacy, terms, поддержка, оценка приложения  
7. **О приложении** — версия  
8. **Удалить аккаунт**

Языки: uk, pl, en, ru, es, de, it, fr, pt (по умолчанию — язык телефона).

## Coach и родители

- тренер создаёт академию и команды, ведёт состав;
- может пригласить родителя к профилю ребёнка (invite / claim);
- родитель видит прогресс в своём режиме, без смешивания с личным Free/Pro сезоном тренера;
- чат и inbox для приглашений и карточек;
- push — локальные уведомления (удалённый FCM подключается отдельно).

## Данные и облако

| Где | Что |
| --- | --- |
| Телефон (`localStorage` / Capacitor) | Игроки, матчи, настройки, черновики, фото |
| Supabase (при входе) | Аккаунт Free/Pro/Coach, облачный синк Pro, команды Coach, приглашения |
| Копия вручную | «На телефон» → JSON в Загрузки / Matchcard; «Восстановить» / JSON |

Перед сменой телефона сделайте копию или включите Pro-облако. Privacy: [`privacy.html`](privacy.html). Terms: [`terms.html`](terms.html). Поддержка: `ihormykhailiuk@gmail.com`.

## Установка

### Сайт / PWA

1. Откройте [https://ihormich.github.io/ffk/](https://ihormich.github.io/ffk/) в Safari или Chrome.  
2. «На экран Домой» / «Установить приложение».

Локально: достаточно открыть `index.html` (рядом `css/`, `js/`). Отдельный сервер не обязателен.

### Android / iOS (Capacitor)

Тот же веб внутри нативной оболочки (`app.ffk.rating`). GitHub Pages не трогаем — в native уходит копия через `www/`.

```bash
npm install
npm run cap:sync          # sync-www.js → www → cap sync
npm run android           # Android Studio
npm run ios               # Xcode
```

Debug APK: `cd android && ./gradlew :app:assembleDebug`.  
Релиз: `npm run android:release`.

Хранилище PWA в браузере и хранилище приложения — разные. Перенос — через копию или облако.

## LocalRepo

Локальное хранилище в `repo/local/` — ключи, kv, media (IDB), игроки, матчи, settings, export-bundle. `js/storage.js` — тонкий фасад с нормализацией под UI.

```
repo/local/
  keys.js · kv.js · media.js · players.js · matches.js
  settings.js · bundle.js · engine.js
```

```js
MatchcardLocalRepo.setPlayer(id, player);
MatchcardLocalRepo.getMatches(playerId);
MatchcardLocalRepo.setSettings(settings);
```

Проверка: `node repo/local/selftest.js`.

## Errors + production logging

```
errors/   codes · classify · reportError
log/      breadcrumbs · global handlers
```

```js
reportError(err, { scope: 'sync.personal', toast: true });
// → { code: 'network'|'auth'|..., message, retryable }

MatchcardLog.breadcrumb('sync.start', { pull: true });
FFK_LOG_TRAIL(); // last events, PII scrubbed
```

Письмо в поддержку подставляет хвост лога. Удалённый sink (Sentry и т.п.) — через `MatchcardLog.addSink(fn)`.

## Data integrity + RLS

Локальная целостность в `data/`:

```
data/
  schema.js
  validate.js
  migrate.js
  engine.js
```

```js
repairRoster(roster, 32)
repairMatchList(matches)
migrateBackupPayload(raw)   // → v4 bundle
MatchcardData.validateBackupPayload(bundle)
```

При загрузке roster/матчей чинятся orphan currentId и дубли id. Импорт JSON проходит через migrate+validate.

RLS: миграция `supabase/migrations/20260930_rls_harden.sql` уже применена на Matchcard project — anon больше не вызывает helper SECURITY DEFINER (`is_team_coach` и т.п.). Invite resolve по-прежнему доступен anon для превью. Чеклист: `supabase/rls-audit-checks.sql`.

## Sync Engine

Независимый планировщик Pro-бэкапа в `sync/`:

```
sync/
  plan.js
  merge.js
  lifecycle.js
  engine.js
```

```js
const plan = planPersonalSync({
  localAt, remoteAt, hasRemote, localDirty, pull: true, push: true, isPro: true, hasSession: true
});
// → { relation, conflict, steps: [{action:'pull_merge'|'push'|'skip_pull', reason}] }

const merged = mergeMatchLists(localMatches, remoteMatches);
await MatchcardSync.runPersonalSync({ pull: true, push: true });
```

Локальные правки ставят dirty-флаг; конфликт `local_dirty_and_remote_present` виден в плане. Проверка: `node sync/selftest.js`.

## Auth lifecycle

Независимый координатор в `auth/`:

```
auth/
  modes.js
  lifecycle.js
  engine.js
```

```js
const snap = await MatchcardAuth.snapshot();
// → { mode, personal, coach, isPro, showPersonalLogin, canSignOut, ... }

await MatchcardAuth.signOutAll();           // оба продукта
await MatchcardAuth.signOutAll({ personal:true, coach:false });
await MatchcardAuth.setMode('coach');       // UI-режим, сессии не трогает
```

`js/auth.js` подключает адаптеры к ParentCloud / CoachStore. Проверка: `node auth/selftest.js`.

## Rating Engine

Независимый модуль в `rating/` — без DOM, localStorage и settings:

```
rating/
  positions.js
  metrics.js
  behaviors.js
  normalization.js
  explanations.js
  engine.js
```

API:

```js
const result = calculateRating({
  counts: { goals: 1 },
  behaviors: { effort: 4 },
  position: 'fwd',      // или pitchPos: 'ST'
  minutes: 60,
  matchLen: 60
});
// → { overall, action, effort, split, contributions, shortOuting, ... }
```

Проверка: `node rating/selftest.js`. В приложении скрипты грузятся из `index.html`; `js/rating.js` — только совместимость со старыми глобалами.

## Технически

| | |
| --- | --- |
| UI | `index.html`, `css/app.css` |
| Логика | `js/app.js`, `js/storage.js` → `repo/local/` |
| Оценка | `rating/` → `calculateRating(match)` (shim: `js/rating.js`) |
| i18n | `js/i18n.js` (+ `js/i18n-coach-*.js`) |
| Coach / Parent | `js/coach-*.js`, `js/parent-*.js`, `js/inbox-store.js` |
| Облако | Supabase (`supabase/`), `@supabase/supabase-js` |
| Оболочка | Capacitor 8 → `android/`, `ios/`, `www/` |
| Версия | `js/version.js` ↔ `android/app/build.gradle` ↔ `sw.js` cache |

После правок веб-файлов для телефона:

```bash
npm run cap:sync
cd android && ./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Репозиторий публикует web на GitHub Pages из тех же исходников; native-сборка берёт синхронизированный `www/`.
