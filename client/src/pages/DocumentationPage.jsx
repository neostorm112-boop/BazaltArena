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

const toc = [
  { id: 'intro', label: 'Введение' },
  { id: 'layers', label: 'Слои архитектуры' },
  { id: 'data', label: 'Целостность данных' },
  { id: 'realtime', label: 'Синхронизация в реальном времени' },
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
              Как устроен бэкенд для арены: один слой API перед продуктом, предсказуемые границы
              ответственности и защита данных без «магии».
            </p>
          </header>

          <nav
            aria-label="Содержание"
            className="mb-12 rounded-xl border border-plantation bg-timber/40 p-4"
          >
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-arena">
              На странице
            </p>
            <ol className="mt-3 flex flex-col gap-2 text-sm">
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
            <H2 id="intro">Введение</H2>
            <p>
              Basalt Arena — это клиентские приложения (участник и отдельная админка) плюс единый{' '}
              <strong className="text-catskill">BFF</strong> (Backend for Frontend) на{' '}
              <Code>Node.js</Code> + <Code>Express</Code> + <Code>TypeScript</Code>. База —{' '}
              <Code>PostgreSQL</Code> через <Code>Prisma ORM</Code>. Такой контур означает: фронт
              говорит на языке экранов и сценариев, а BFF агрегирует правила доступа, метрики
              спринта и побочные эффекты (уведомления, пересчёты) в одном месте — без дублирования
              бизнес-логики в CMS или в нескольких микросервисах «на вырост».
            </p>
            <p>
              Ценность BFF здесь не в количестве эндпоинтов, а в <em>смысловом центре</em>: участник
              видит зал славы и спринт так, как позволяет доменная модель; админка получает те же
              инварианты, но с другим набором разрешений — без второго «теневого» API.
            </p>

            <H2 id="layers">Слои архитектуры</H2>
            <p>
              В коде BFF нет тяжёлого слоя «контроллеров» ради имени: маршруты Express остаются{' '}
              <strong className="text-catskill">тонкими адаптерами</strong> — парсят вход, вызывают
              сервис из <Code>buildContainer()</Code> и возвращают JSON. Ниже — цепочка, которая
              масштабируется командой и по файлам, и по ответственности:
            </p>
            <Diagram title="Поток запроса (упрощённо)">
              {`  HTTP Request
       │
       ▼
┌──────────────────┐
│  Route (Router) │  auth, rate limits, asyncHandler
└────────┬─────────┘
         │  zod parse(params | body | query)
         ▼
┌──────────────────┐
│    *Service      │  сценарии: Hall, Admin, Likes…
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
              <Code>Route → Service → Repository</Code> (обработчик маршрута фактически играет роль
              контроллера) разделяет три вопроса: <em>«допустим ли вызов?»</em> (маршрут + Zod),{' '}
              <em>«что должно произойти в продукте?»</em> (<Code>AdminService</Code>,{' '}
              <Code>HallService</Code>, …) и <em>«как это надёжно записать?»</em> (
              <Code>adminRepo</Code>, <Code>likeRepo</Code>, …). Новый сценарий почти всегда
              добавляет строки в сервис и репозиторий, не расползаясь по десятку Express-хендлеров с
              сырой Prisma.
            </p>
            <Note>
              Мы используем <Code>.strict()</Code> в схемах <Code>zod</Code>, чтобы лишние поля в
              JSON не «проскальзывали» незаметно: контракт входа явный, проще ревьюить и безопаснее
              против подмешивания неожиданных ключей (классическая защита от{' '}
              <em>object pollution</em> на границе HTTP).
            </Note>

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
              <Code>createLikeService</Code> лайк и счётчик <Code>likesCount</Code> у решения
              обновляются в одной транзакции: либо оба шага успешны, либо откат — зритель не увидит
              «лайк есть, а цифра не сходится». Аналогичный подход — в админских пакетных операциях
              и репозиториях, где важна согласованность статусов и производных метрик спринта.
            </p>

            <H2 id="realtime">Синхронизация в реальном времени</H2>
            <p>
              Сервер поднимает <Code>Socket.io</Code> на том же HTTP-порту, что и Express. После
              значимых изменений (админка, метрики после сабмита/лайка и т.д.) BFF шлёт
              широковещательное событие <Code>DATA_UPDATED</Code> с меткой времени и опциональным
              контекстом сущности.
            </p>
            <Diagram title="Клиент арены: инвалидация кэша">
              {`  socket.io  ──DATA_UPDATED──▶  React Query
                                    │
                    invalidateQueries(queryKeys.me())
                    invalidateQueries(['hall', …])
                                    │
                                    ▼
                    UI подтягивает свежие данные без F5`}
            </Diagram>
            <p>
              На клиенте <Code>SocketSync</Code> подписан на <Code>DATA_UPDATED</Code> и вызывает{' '}
              <Code>queryClient.invalidateQueries</Code> для профиля и зала славы: пользователь
              получает «живой» интерфейс без ручного обновления и без опроса REST каждые N секунд. В
              админке <Code>AdminSocketSync</Code> делает то же для префикса{' '}
              <Code>['admin', …]</Code> — второй ментор видит изменения коллеги почти мгновенно.
            </p>
            <Diagram title="Mermaid — цепочка DATA_UPDATED (можно вставить в редактор с поддержкой Mermaid)">
              {`sequenceDiagram
    participant BFF as BFF (Express)
    participant IO as Socket.io
    participant UI as React клиент
    participant RQ as React Query
    BFF->>IO: emitDataUpdated(io, detail)
    IO-->>UI: DATA_UPDATED
    UI->>RQ: invalidateQueries(...)
    RQ-->>UI: фоновый refetch, новый UI`}
            </Diagram>

            <H2 id="admin">Возможности админки</H2>
            <ul className="my-4 list-disc space-y-2 pl-5 text-gull marker:text-turquoise/80">
              <li>
                <strong className="text-catskill">Audit Log</strong> — каждое чувствительное
                действие оставляет след: кто, что и с каким контекстом. Это не «лог ради лога», а
                снижение стоимости разборов инцидентов и доверие к изменениям ролей и профилей.
              </li>
              <li>
                <strong className="text-catskill">Batch actions</strong> — массовые операции
                (например, публикация отобранных решений в зал) оформлены как один сценарий на
                сервере: меньше ручных кликов, меньше риска расхождения статусов между строками
                таблицы и фактическим состоянием БД.
              </li>
              <li>
                <strong className="text-catskill">Split-view для ревью</strong> — карточка проверки
                совмещает превью (демо/репо) и форму оценки: ментор не переключает вкладки, чтобы
                сверить артефакт с баллом и комментарием. Это сокращает время ревью и ошибки «оценил
                не то решение».
              </li>
            </ul>

            <H2 id="errors">Обработка ошибок</H2>
            <p>
              Класс <Code>AppError</Code> задаёт для домена предсказуемый набор кодов (
              <Code>VALIDATION_ERROR</Code>, <Code>FORBIDDEN</Code>, <Code>NOT_FOUND</Code>, …),
              HTTP-статус и человекочитаемое сообщение. Центральный <Code>errorHandler</Code> мапит
              исключения в единый JSON: <Code>code</Code>, <Code>message</Code>,{' '}
              <Code>requestId</Code> для корреляции с логами и опционально <Code>details</Code>{' '}
              (например, flatten от Zod).
            </p>
            <p>
              Ошибки <Code>Prisma</Code> не «протекают» наружу как сырой стек: известные коды вроде
              уникального ограничения или «запись не найдена» превращаются в те же стабильные{' '}
              <Code>code</Code>, с которыми фронт может показать понятное действие пользователю, а
              не общий «500».
            </p>
            <Note>
              Для фронта это означает: можно строить UX вокруг <Code>body.code</Code>, не парся
              текст сообщений и не завязываясь на внутренние имена полей Prisma — контракт ошибки
              так же важен, как контракт успешного ответа.
            </Note>

            <H2 id="quickstart">Quick Start for Developers</H2>
            <p>
              Репозиторий рассчитан на «клонируй — зависимости — инфраструктура — схема БД».
              Короткий контур без углубления в workspaces: несколько команд из корня, чтобы
              подтвердить, что окружение живое (миграции и сид — раздельные шаги).
            </p>
            <Diagram title="Локальный контур (после клона)">
              {`npm install
docker compose up -d
npm run db:migrate
npm run db:seed`}
            </Diagram>
            <p className="text-sm text-gull">
              Дальше — копия <Code>.env</Code> из <Code>.env.example</Code> (в т.ч. для{' '}
              <Code>DATABASE_URL</Code>), затем неинтерактивные миграции и отдельно сид; из{' '}
              <Code>bff/</Code> то же самое: <Code>npx prisma migrate deploy</Code>, затем{' '}
              <Code>npm run db:seed</Code>. Запуск <Code>npm run dev</Code> или{' '}
              <Code>npm run dev:all</Code>; полная матрица — в корневом README. Здесь акцент на том,
              что проект <strong className="text-catskill">отчуждаем</strong>: зависимости,
              контейнеры с Postgres/Redis и миграции Prisma запускаются предсказуемо и без ручной
              сборки «магии».
            </p>
          </article>
        </div>
      </main>
      <AppFooter />
    </div>
  )
}
