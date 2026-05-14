import { AppFooter } from '../components/layout/AppFooter.jsx'
import { AppHeader } from '../components/layout/AppHeader.jsx'

function Code({ children }) {
  return (
    <code className="rounded-md border border-plantation/80 bg-aztec px-1.5 py-0.5 font-mono text-[0.8125rem] text-half-baked">
      {children}
    </code>
  )
}

function Note({ children }) {
  return (
    <blockquote className="my-6 border-l-[3px] border-turquoise/60 bg-turquoise/[0.06] py-3 pl-4 pr-4 text-sm leading-relaxed text-mystic">
      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-turquoise">
        Note
      </span>
      <div className="mt-2 text-gull">{children}</div>
    </blockquote>
  )
}

function H2({ id, children }) {
  return (
    <h2
      id={id}
      className="mt-14 scroll-mt-28 border-b border-plantation pb-2 font-mono text-lg font-bold uppercase tracking-tight text-catskill first:mt-0 md:scroll-mt-32"
    >
      {children}
    </h2>
  )
}

function H3({ children }) {
  return (
    <h3 className="mt-8 font-mono text-sm font-bold uppercase tracking-wider text-half-baked">
      {children}
    </h3>
  )
}

function Diagram({ title, children }) {
  return (
    <figure className="my-6 overflow-hidden rounded-xl border border-plantation bg-timber/50">
      {title ? (
        <figcaption className="border-b border-plantation px-4 py-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-arena">
          {title}
        </figcaption>
      ) : null}
      <pre className="overflow-x-auto p-4 font-mono text-[11px] leading-relaxed text-half-baked">
        {children}
      </pre>
    </figure>
  )
}

function Badge({ children, color = 'turquoise' }) {
  const colors = {
    turquoise: 'border-turquoise/30 bg-turquoise/10 text-turquoise',
    spring: 'border-spring/30 bg-spring/10 text-spring',
    gull: 'border-plantation bg-timber/60 text-gull',
    red: 'border-red-500/30 bg-red-500/10 text-red-400',
  }
  return (
    <span
      className={`inline-flex items-center rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${colors[color]}`}
    >
      {children}
    </span>
  )
}

function Table({ headers, rows }) {
  return (
    <div className="my-6 overflow-x-auto rounded-xl border border-plantation">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-plantation bg-timber/60">
            {headers.map((h) => (
              <th
                key={h}
                className="px-4 py-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-arena"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-plantation/50 last:border-0 hover:bg-white/[0.02]"
            >
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-gull">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const toc = [
  { id: 'intro', label: 'Введение' },
  { id: 'how-it-works', label: 'Как работает платформа' },
  { id: 'sprint-lifecycle', label: 'Жизненный цикл спринта' },
  { id: 'auth', label: 'Аутентификация' },
  { id: 'layers', label: 'Слои архитектуры' },
  { id: 'pages', label: 'Страницы приложения' },
  { id: 'data', label: 'Целостность данных' },
  { id: 'realtime', label: 'Синхронизация в реальном времени' },
  { id: 'achievements', label: 'Система ачивок' },
  { id: 'admin', label: 'Возможности админки' },
  { id: 'errors', label: 'Обработка ошибок' },
  { id: 'quickstart', label: 'Quick Start' },
]

export function DocumentationPage() {
  return (
    <div className="flex min-h-screen flex-col bg-aztec">
      <AppHeader />
      <main className="flex-1 px-0 pt-[73px]">
        <div className="mx-auto max-w-[900px] px-6 py-10 max-[360px]:px-3 max-[360px]:py-6 md:px-10">
          <header className="mb-10 border-b border-plantation pb-8">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-turquoise">
              Documentation
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-catskill md:text-4xl">
              Basalt Arena — инженерный обзор
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-gull">
              Как устроена платформа: от пользовательских сценариев до архитектурных решений BFF,
              аутентификации, реалтайма и обработки ошибок.
            </p>
          </header>

          <nav
            aria-label="Содержание"
            className="mb-12 rounded-xl border border-plantation bg-timber/40 p-4"
          >
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-arena">
              На странице
            </p>
            <ol className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {toc.map((item, i) => (
                <li key={item.id}>
                  <a href={`#${item.id}`} className="text-gull transition hover:text-turquoise">
                    <span className="font-mono text-fiord">{String(i + 1).padStart(2, '0')}</span>{' '}
                    {item.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <article className="prose-docs max-w-none space-y-4 text-[15px] leading-[1.65] text-mystic md:space-y-5">
            {/* ── ВВЕДЕНИЕ ── */}
            <H2 id="intro">Введение</H2>
            <p>
              Basalt Arena — закрытая площадка для разработчиков. Каждый спринт — реальная задача из
              прода: участники присылают решения, наставник принимает лучшее, его автор получает
              деньги и ачивки. Все решения публикуются — чтобы каждый мог учиться у тех, кто
              впереди.
            </p>
            <p>
              Технически: два клиентских приложения (арена и панель администратора) работают через
              единый <strong className="text-catskill">BFF</strong> (Backend for Frontend) на{' '}
              <Code>Node.js</Code> + <Code>Express</Code> + <Code>TypeScript</Code>. База данных —{' '}
              <Code>PostgreSQL</Code> через <Code>Prisma ORM</Code>, кэш сессий и rate-limit —{' '}
              <Code>Redis</Code>.
            </p>

            {/* ── КАК РАБОТАЕТ ── */}
            <H2 id="how-it-works">Как работает платформа</H2>
            <p>
              Платформа построена вокруг двух ролей: <Badge>ADMIN</Badge> и{' '}
              <Badge color="gull">USER</Badge>.
            </p>
            <Table
              headers={['Роль', 'Что может']}
              rows={[
                [
                  <Badge key="a">ADMIN</Badge>,
                  'Создавать спринты и задачи, управлять пользователями, принимать и отклонять решения, выдавать ачивки, читать аудит-лог',
                ],
                [
                  <Badge key="u" color="gull">
                    USER
                  </Badge>,
                  'Участвовать в активном спринте, отправлять решения, ставить лайки, смотреть зал славы и чужие решения',
                ],
              ]}
            />
            <Note>
              Аккаунты создаются только администратором — самостоятельной регистрации нет. Это
              сознательное решение: арена закрытая, каждый участник проходит отбор.
            </Note>

            {/* ── ЖИЗНЕННЫЙ ЦИКЛ СПРИНТА ── */}
            <H2 id="sprint-lifecycle">Жизненный цикл спринта</H2>
            <p>
              Каждый спринт проходит четыре состояния. Переходы управляются из админки — вручную или
              по дедлайну.
            </p>
            <Diagram title="Состояния спринта">
              {`  ┌─────────────┐      активировать     ┌──────────────┐
  │  Запланирован│ ─────────────────▶ │  На арене    │
  │  (planned)  │                    │  (active)    │
  └─────────────┘                    └──────┬───────┘
         ▲                                  │ дедлайн истёк
         │ снять с арены                    ▼
         │                          ┌──────────────┐      архивировать    ┌──────────────┐
         └──────────────────────────│  Завершён    │ ─────────────────▶  │  Архив       │
                                    │  (finished)  │                     │  (archived)  │
                                    └──────────────┘                     └──────────────┘`}
            </Diagram>
            <Table
              headers={['Состояние', 'Описание']}
              rows={[
                [
                  <Badge key="p" color="gull">
                    Запланирован
                  </Badge>,
                  'Спринт создан, задача написана, дата старта в будущем. Участники пока не видят задачу.',
                ],
                [
                  <Badge key="a" color="turquoise">
                    На арене
                  </Badge>,
                  'Активный спринт. Задача открыта, таймер идёт, участники присылают решения.',
                ],
                [
                  <Badge key="f" color="gull">
                    Завершён
                  </Badge>,
                  'Дедлайн истёк. Решения закрыты. Наставник выбирает победителя и публикует результаты.',
                ],
                [
                  <Badge key="ar" color="red">
                    Архив
                  </Badge>,
                  'Спринт убран в архив. Не отображается в активных, доступен в истории.',
                ],
              ]}
            />
            <p>
              Прогресс-бар по времени в админке показывает, сколько осталось до конца спринта. Когда
              дедлайн проходит — спринт автоматически переходит в «Завершён» при следующей проверке,
              даже если флаг <Code>active</Code> не снят вручную.
            </p>

            {/* ── АУТЕНТИФИКАЦИЯ ── */}
            <H2 id="auth">Аутентификация</H2>
            <p>
              Система использует пару <strong className="text-catskill">JWT-токенов</strong>:{' '}
              короткоживущий access-токен и долгоживущий refresh-токен.
            </p>
            <Diagram title="Поток аутентификации">
              {`  Клиент                          BFF                         Redis
    │                              │                              │
    │── POST /auth/login ─────────▶│                              │
    │                              │── bcrypt.compare ───────────▶│
    │                              │   (пароль верен)             │
    │                              │── сохранить refresh-токен ──▶│
    │◀── { accessToken,            │                              │
    │      refreshToken,           │                              │
    │      user } ─────────────────│                              │
    │                              │                              │
    │── GET /api/... ──────────────│                              │
    │   Authorization: Bearer <AT> │                              │
    │                              │── проверить подпись JWT      │
    │◀── данные ───────────────────│                              │
    │                              │                              │
    │   [access-токен истёк]       │                              │
    │── POST /auth/refresh ────────│                              │
    │   cookie: refreshToken       │── проверить в Redis ────────▶│
    │◀── новый accessToken ────────│                              │`}
            </Diagram>
            <Table
              headers={['Токен', 'Время жизни', 'Где хранится']}
              rows={[
                ['Access token (JWT)', '15 минут', 'Память клиента (не localStorage)'],
                ['Refresh token (JWT)', '30 дней', 'HttpOnly cookie + Redis (для инвалидации)'],
              ]}
            />
            <p>
              Refresh-токен хранится в Redis: это позволяет инвалидировать сессию мгновенно (logout,
              смена пароля, блокировка) — без ожидания истечения JWT. Такая схема безопаснее, чем
              хранить только в cookie и ждать TTL.
            </p>
            <Note>
              После смены <Code>JWT_ACCESS_SECRET</Code> или <Code>JWT_REFRESH_SECRET</Code> на
              сервере все текущие сессии становятся недействительными — пользователям нужно войти
              заново.
            </Note>

            {/* ── СЛОИ АРХИТЕКТУРЫ ── */}
            <H2 id="layers">Слои архитектуры</H2>
            <p>
              Маршруты Express остаются{' '}
              <strong className="text-catskill">тонкими адаптерами</strong> — парсят вход, вызывают
              сервис и возвращают JSON. Ниже — цепочка с чёткими границами ответственности:
            </p>
            <Diagram title="Поток запроса">
              {`  HTTP Request
       │
       ▼
┌──────────────────┐
│  Route (Router)  │  auth middleware, rate-limit, asyncHandler
└────────┬─────────┘
         │  zod.parse(params | body | query)
         ▼
┌──────────────────┐
│    *Service      │  бизнес-сценарии: что должно произойти
└────────┬─────────┘
         │  только доменные вызовы
         ▼
┌──────────────────┐
│  *Repository     │  Prisma-запросы, транзакции
└────────┬─────────┘
         ▼
    PostgreSQL`}
            </Diagram>
            <p>
              Разделение на три слоя решает три разных вопроса: <em>«допустим ли вызов?»</em>{' '}
              (маршрут + Zod), <em>«что должно произойти в продукте?»</em> (сервис) и{' '}
              <em>«как это надёжно записать?»</em> (репозиторий). Новый сценарий добавляет строки в
              сервис и репозиторий, не расползаясь по десятку Express-хендлеров с сырой Prisma.
            </p>
            <H3>Основные сервисы BFF</H3>
            <Table
              headers={['Сервис', 'Ответственность']}
              rows={[
                [<Code key="a">authService</Code>, 'Логин, logout, refresh, хеши паролей (bcrypt)'],
                [<Code key="b">tokenService</Code>, 'Создание и верификация JWT access/refresh'],
                [<Code key="c">sessionStore</Code>, 'Хранение refresh-токенов в Redis'],
                [<Code key="d">adminService</Code>, 'CRUD пользователей, спринтов, доступов'],
                [<Code key="e">submissionService</Code>, 'Приём решений, статусы, подсчёт баллов'],
                [<Code key="f">likeService</Code>, 'Лайки с дедупликацией (атомарная транзакция)'],
                [
                  <Code key="g">achievementGranter</Code>,
                  'Логика выдачи ачивок по условию или вручную',
                ],
                [
                  <Code key="h">sprintMetricsService</Code>,
                  'Метрики активности: решения, лайки, участники',
                ],
                [<Code key="i">hallService</Code>, 'Агрегация рейтинга для зала славы'],
                [<Code key="j">memberNotificationService</Code>, 'Создание уведомлений участникам'],
              ]}
            />
            <Note>
              Мы используем <Code>.strict()</Code> в схемах Zod, чтобы лишние поля в JSON не
              «проскальзывали» незаметно: контракт входа явный, проще ревьюить и безопаснее против
              подмешивания неожиданных ключей.
            </Note>

            {/* ── СТРАНИЦЫ ── */}
            <H2 id="pages">Страницы приложения</H2>
            <H3>Клиентская арена</H3>
            <Table
              headers={['Путь', 'Страница', 'Что здесь']}
              rows={[
                ['/', 'Активный спринт', 'Таймер, задача, форма отправки решения, лента с лайками'],
                ['/hall', 'Зал славы', 'Рейтинг участников по баллам, победители прошлых спринтов'],
                ['/profile', 'Профиль', 'Статистика, ачивки, история участия в спринтах'],
                ['/docs', 'Документация', 'Эта страница — устройство платформы'],
                ['/login', 'Вход', 'Форма авторизации. Аккаунты только через администратора'],
              ]}
            />
            <H3>Панель администратора</H3>
            <Table
              headers={['Путь', 'Страница', 'Что здесь']}
              rows={[
                [
                  '/',
                  'Dashboard',
                  'Статистика: участники, решения, активный спринт, график активности',
                ],
                ['/users', 'Пользователи', 'Список, поиск, редактирование, смена роли и пароля'],
                [
                  '/sprints',
                  'Спринты',
                  'Создание и управление спринтами: задача, ресурсы, статус, прогресс-бар',
                ],
                ['/access', 'Доступы', 'Список участников с доступом к арене'],
                ['/submissions', 'Решения', 'Все присланные решения, статусы, принять / отклонить'],
                ['/achievements', 'Ачивки', 'Конструктор ачивок. Массовая выдача по спринту'],
                ['/logs', 'Логи', 'Аудит-лог действий администратора'],
              ]}
            />

            {/* ── ЦЕЛОСТНОСТЬ ДАННЫХ ── */}
            <H2 id="data">Целостность данных</H2>
            <p>
              <strong className="text-catskill">Zod</strong> стоит на границе HTTP: тело и параметры
              приводятся к известной форме до того, как сервис начнёт ветвления. Это снижает класс
              ошибок «undefined везде» и делает рефакторинг схемы БД управляемым — компилятор и
              тесты цепляются за контракт.
            </p>
            <p>
              <strong className="text-catskill">
                Prisma <Code>$transaction</Code>
              </strong>{' '}
              используется там, где несколько записей должны согласоваться атомарно. Например, в{' '}
              <Code>likeService</Code> лайк и счётчик <Code>likesCount</Code> у решения обновляются
              в одной транзакции: либо оба шага успешны, либо откат — зритель не увидит «лайк есть,
              а цифра не сходится». Аналогичный подход в пакетных операциях и там, где важна
              согласованность статусов.
            </p>
            <H3>Основные модели базы данных</H3>
            <Table
              headers={['Модель', 'Описание']}
              rows={[
                ['User', 'Участник: handle, email, роль, баллы, аватар'],
                ['Sprint', 'Спринт: название, задача, даты, флаги active / archived'],
                ['Submission', 'Решение: ссылка, статус, баллы, автор, спринт'],
                ['Like', 'Лайк решения — уникален по паре user + submission'],
                ['Achievement', 'Описание ачивки: иконка, название, описание'],
                ['UserAchievement', 'Связь пользователь ↔ ачивка + момент выдачи'],
                ['AuditLog', 'Лог действий администратора: кто, что, контекст'],
                ['Notification', 'Уведомление для пользователя'],
              ]}
            />

            {/* ── РЕАЛТАЙМ ── */}
            <H2 id="realtime">Синхронизация в реальном времени</H2>
            <p>
              Сервер поднимает <Code>Socket.io</Code> на том же HTTP-порту, что и Express. После
              значимых изменений BFF шлёт широковещательное событие <Code>DATA_UPDATED</Code> с
              меткой времени и контекстом сущности.
            </p>
            <Diagram title="Цепочка обновления UI без F5">
              {`  Действие в админке (принять решение, выдать ачивку, …)
       │
       ▼
  BFF: сохранить изменение → emitDataUpdated(io, detail)
       │
       ▼
  Socket.io ──── DATA_UPDATED ────▶ все подключённые клиенты
                                          │
                         React Query: invalidateQueries(...)
                                          │
                                          ▼
                         UI показывает свежие данные без F5`}
            </Diagram>
            <p>
              На клиенте <Code>SocketSync</Code> подписан на <Code>DATA_UPDATED</Code> и вызывает{' '}
              <Code>queryClient.invalidateQueries</Code> для профиля и зала славы. В админке{' '}
              <Code>AdminSocketSync</Code> делает то же для своих запросов — второй ментор видит
              изменения коллеги почти мгновенно.
            </p>
            <Note>
              Реалтайм работает через тот же порт <Code>3001</Code> что и REST — отдельный сервер
              для WebSocket не нужен. Nginx проксирует <Code>/socket.io/</Code> с заголовком{' '}
              <Code>Upgrade: websocket</Code>.
            </Note>

            {/* ── АЧИВКИ ── */}
            <H2 id="achievements">Система ачивок</H2>
            <p>
              Ачивки — инструмент мотивации и признания. Администратор создаёт ачивку с иконкой
              (Material Icons) и текстом, а затем выдаёт её вручную или пакетно — всем участникам
              конкретного спринта.
            </p>
            <H3>Автоматические ачивки</H3>
            <p>
              Эти 5 ачивок выдаются автоматически — сервис <Code>achievementGranter</Code> подписан
              на события <Code>submissionService</Code> и <Code>likeService</Code>:
            </p>
            <Table
              headers={['Ачивка', 'Slug', 'Триггер', 'Условие']}
              rows={[
                [
                  'Первый шаг',
                  <Code key="s1">first_submission</Code>,
                  'onSubmissionUpsert',
                  'Первый сабмишн пользователя за всю историю',
                ],
                [
                  'Принято',
                  <Code key="s2">first_accepted</Code>,
                  'onSubmissionStatusChange',
                  'Первое решение в статусе ACCEPTED',
                ],
                [
                  'Сотка',
                  <Code key="s3">score_100</Code>,
                  'onSubmissionStatusChange',
                  'Принятое решение с mentorScore ≥ 100',
                ],
                [
                  'Чемпион спринта',
                  <Code key="s4">sprint_winner</Code>,
                  'onSubmissionStatusChange',
                  'Лучшее принятое решение в спринте (по score, затем likes, затем createdAt)',
                ],
                [
                  'Народный любимец',
                  <Code key="s5">popular_solution</Code>,
                  'onLikesChanged',
                  'Решение собрало 25+ лайков',
                ],
              ]}
            />
            <p>
              Ачивки не выдаются дважды — используется <Code>upsert</Code> в{' '}
              <Code>UserAchievement</Code> по составному ключу <Code>userId + achievementId</Code>.
            </p>
            <Note>
              Помимо автоматических, администратор может создавать{' '}
              <strong className="text-catskill">кастомные ачивки</strong> на странице{' '}
              <Code>/achievements</Code> в админке и выдавать их вручную или пакетно — всем
              участникам конкретного спринта.
            </Note>

            {/* ── АДМИНКА ── */}
            <H2 id="admin">Возможности админки</H2>
            <ul className="my-4 list-disc space-y-3 pl-5 text-gull marker:text-turquoise/80">
              <li>
                <strong className="text-catskill">Управление спринтами</strong> — создание задачи с
                описанием, ресурсами (ссылки, репо, документация), выбором диапазона дат через
                календарь. Прогресс-бар показывает сколько времени осталось.
              </li>
              <li>
                <strong className="text-catskill">Ревью решений</strong> — split-view: превью
                решения (демо / репо) и форма оценки рядом. Ментор не переключает вкладки. Принятое
                решение обновляет баллы участника и триггерит реалтайм-событие.
              </li>
              <li>
                <strong className="text-catskill">Пакетные операции</strong> — массовая выдача
                ачивок по спринту за один клик. Одна транзакция — без расхождений.
              </li>
              <li>
                <strong className="text-catskill">Аудит-лог</strong> — каждое чувствительное
                действие (смена роли, пароля, выдача прав) оставляет след: кто, что, когда. Снижает
                стоимость разбора инцидентов.
              </li>
              <li>
                <strong className="text-catskill">Управление доступами</strong> — список участников,
                которым разрешено присоединиться к арене. Доступ отзывается мгновенно.
              </li>
              <li>
                <strong className="text-catskill">Конструктор ачивок</strong> — создание кастомных
                ачивок с иконкой из Material Icons, названием и описанием. Выдача конкретному
                участнику или всему спринту.
              </li>
            </ul>

            {/* ── ОШИБКИ ── */}
            <H2 id="errors">Обработка ошибок</H2>
            <p>
              Класс <Code>AppError</Code> задаёт предсказуемый набор кодов для домена. Центральный{' '}
              <Code>errorHandler</Code> превращает любое исключение в единый JSON:
            </p>
            <Diagram title="Формат ответа об ошибке">
              {`{
  "code":      "FORBIDDEN",          // машиночитаемый код
  "message":   "Недостаточно прав",  // для пользователя
  "requestId": "a1b2-c3d4-...",      // для корреляции с логами
  "details":   [...]                 // опционально, напр. flatten от Zod
}`}
            </Diagram>
            <Table
              headers={['Код', 'HTTP', 'Когда']}
              rows={[
                ['UNAUTHORIZED', '401', 'Токен отсутствует или недействителен'],
                ['FORBIDDEN', '403', 'Нет нужной роли для действия'],
                ['NOT_FOUND', '404', 'Ресурс не найден'],
                ['VALIDATION_ERROR', '400', 'Данные не прошли Zod-валидацию'],
                ['CONFLICT', '409', 'Нарушение уникального ограничения (напр., дубль email)'],
                ['RATE_LIMITED', '429', 'Превышен лимит запросов'],
                ['INTERNAL_ERROR', '500', 'Непредвиденная ошибка на сервере'],
              ]}
            />
            <p>
              Ошибки <Code>Prisma</Code> не «протекают» наружу как сырой стек: известные коды вроде
              уникального ограничения превращаются в стабильные <Code>code</Code>. Фронт строит UX
              вокруг <Code>body.code</Code> — без парсинга текста и без завязки на внутренние имена
              полей Prisma.
            </p>
            <Note>
              Контракт ошибки так же важен, как контракт успешного ответа. Если код меняется — это
              breaking change.
            </Note>

            {/* ── QUICK START ── */}
            <H2 id="quickstart">Quick Start for Developers</H2>
            <p>
              Минимальный путь от клона до работающего приложения на локальной машине. Нужны Node.js
              ≥ 20 и Docker.
            </p>
            <Diagram title="Локальный контур — команды из корня репозитория">
              {`# 1. Зависимости + .env из примера
npm run setup

# 2. Postgres (порт 5433) + Redis (порт 6379)
docker compose up -d

# 3. Миграции БД + начальные данные
npm run db:migrate
npm run db:seed

# 4. Запустить всё: клиент + BFF + админка
npm run dev:all`}
            </Diagram>
            <Table
              headers={['Что', 'URL']}
              rows={[
                ['Арена (клиент)', 'http://localhost:5173'],
                ['Админка', 'http://localhost:5174'],
                ['BFF Health', 'http://localhost:3001/api/v1/health'],
              ]}
            />
            <p>
              Логин после сида: <Code>admin@admin.com</Code> — пароль из переменной{' '}
              <Code>SEED_ADMIN_PASSWORD</Code> в <Code>.env</Code> (по умолчанию{' '}
              <Code>admin1234</Code>). Demo-участник: <Code>demo@basalt.arena</Code> /{' '}
              <Code>demo1234</Code>.
            </p>
            <p className="text-sm text-gull">
              Полная матрица скриптов, переменных окружения и инструкция по деплою на сервер — в
              корневом <Code>README.md</Code> репозитория.
            </p>
          </article>
        </div>
      </main>
      <AppFooter />
    </div>
  )
}
