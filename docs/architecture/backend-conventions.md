# Бэкенд: NestJS и Prisma

Обязательное руководство для API и серверной логики. Читать вместе с
[общими соглашениями](./coding-conventions.md). Все примеры находятся здесь;
доступ к исходным проектам, из которых перенесён подход, не нужен.

Примеры упражнений ниже иллюстрируют структуру. Модель `PersonalExercise`,
модуль доступа и HTTP-контракты условные и пока не определяются этим документом.
Пример чтения не является готовым сценарием изменения дневника.

## 1. Организация модулей

Модуль соответствует предметной функции. Его внутренние файлы лежат рядом:

```text
apps/api/src/
  app.module.ts
  main.ts
  db/
    db.module.ts
    prisma.service.ts
  access/
    access.module.ts
    access.service.ts
  exercises/
    exercises.module.ts
    exercises.controller.ts
    exercises.service.ts
    exercises.repository.ts
    exercises.type.ts
    dto/
      exercise-response.dto.ts
    mappers/
      map-exercise-response.ts
```

Создавать только нужные файлы. Для одного простого преобразования папка `mappers`
не обязательна. `dto`, `services`, `repositories` внутри большого модуля допустимы,
когда действительно упрощают навигацию. Глобальные каталоги всех сервисов и всех
репозиториев не использовать: они разрывают соседство связанного кода.

Отдельный QueryService или QueryRepository уместен при существенно отличающейся
модели чтения: сложных выборках, проекциях, аналитике. Не делить каждую CRUD-операцию
на command/query-класс и не вводить CQRS, шину событий или DDD-слои по шаблону.

## 2. Ответственность слоёв

| Слой | Делает | Не должен содержать |
|---|---|---|
| Controller | Принимает проверенный HTTP-вход, получает проверенный контекст доступа, вызывает сервис, формирует ответ | Prisma, SQL, доменные расчёты, открытие транзакции |
| Service | Выполняет сценарий, проверяет предметные ограничения, координирует зависимости и транзакцию | Express Request/Response, подробности SQL, маршрутизацию HTTP |
| Repository | Читает и изменяет данные, формирует фильтры, проекции и связи | HTTP-ответы, выбор продуктового поведения, скрытые внешние вызовы |
| Module | Регистрирует зависимости и определяет публичные providers | Выполнение предметных сценариев |
| Mapper | Явно преобразует одну модель данных в другую | Запросы, авторизацию, изменение состояния |

Проверка «существует ли запись» может требовать репозиторий, но решение, что делать
при её отсутствии, принимает сервис. Ограничение уникальности принадлежит также БД:
предварительная проверка сервиса не устраняет гонку между конкурентными запросами.

## 3. Зависимости и NestJS DI

Сервисы и репозитории — классы с `@Injectable()`. Зависимости объявляются в конструкторе:

```ts
@Injectable()
export class ExercisesService {
  constructor(private readonly exercisesRepository: ExercisesRepository) {}
}
```

Имена раскрывают назначение зависимости. Не создавать сервисы через `new`
в контроллере, не получать зависимости из контейнера вручную и не хранить текущего
атлета в поле singleton-сервиса. Данные конкретного вызова передавать параметрами.

В текущем проекте запуск разработки использует `tsx`; не полагаться только на
автоматическую decorator metadata для разрешения параметров конструктора.
При внедрении через такой путь использовать явные токены:

```ts
@Injectable()
export class ExercisesService {
  constructor(
    @Inject(ExercisesRepository)
    private readonly exercisesRepository: ExercisesRepository,
  ) {}
}
```

Если настройки запуска изменятся, единообразный способ DI должен быть проверен
реальным запуском приложения, а не только `tsc`. Пример полного конструктора ниже
использует явный `@Inject`.

Интерфейс стирается при компиляции и не служит токеном DI. Интерфейс и отдельный
symbol-токен нужны, если есть реальная заменяемая граница, например внешний клиент.
Не создавать интерфейс для каждого конкретного репозитория ради одного теста.

## 4. Сквозной пример чтения

Пример показывает цепочку «контроллер → сервис → репозиторий» и явный HTTP-маппинг.
`VerifiedAccess` и `CurrentAthlete` обозначают контракт модуля доступа: guard
проверяет сессию, декоратор только извлекает уже проверенный контекст.
Одного декоратора или типа `VerifiedAccess` для защиты маршрута недостаточно.

### Типы модуля

```ts
// exercises.type.ts
export type PersonalExerciseSummary = {
  id: string;
  name: string;
};
```

### Репозиторий

```ts
import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../db/prisma.service.js';
import type { PersonalExerciseSummary } from './exercises.type.js';

@Injectable()
export class ExercisesRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prismaService: PrismaService,
  ) {}

  async findPersonalById(
    athleteId: string,
    exerciseId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PersonalExerciseSummary | null> {
    const client = tx ?? this.prismaService;

    return client.personalExercise.findFirst({
      // ID приходит извне; ограничение владельца не позволяет прочитать
      // личное упражнение другого атлета даже при известном идентификаторе.
      where: {
        id: exerciseId,
        athleteId,
      },
      select: {
        id: true,
        name: true,
      },
    });
  }
}
```

Для системных упражнений действует отдельное правило доступа; нельзя механически
применить фильтр личного владельца ко всему справочнику. Условие чтения выводится
из предметного контракта, а не из универсального CRUD.

### Сервис

```ts
import { Inject, Injectable } from '@nestjs/common';
import type { VerifiedAccess } from '../access/access.type.js';
import { ExerciseNotFoundError } from './exercise-not-found.error.js';
import { ExercisesRepository } from './exercises.repository.js';
import type { PersonalExerciseSummary } from './exercises.type.js';

@Injectable()
export class ExercisesService {
  constructor(
    @Inject(ExercisesRepository)
    private readonly exercisesRepository: ExercisesRepository,
  ) {}

  /**
   * Чужое личное упражнение неотличимо от отсутствующего:
   * ответ не должен раскрывать существование данных другого атлета.
   *
   * @throws ExerciseNotFoundError Если доступная атлету запись не найдена.
   */
  async getPersonalById(
    access: VerifiedAccess,
    exerciseId: string,
  ): Promise<PersonalExerciseSummary> {
    const exercise = await this.exercisesRepository.findPersonalById(
      access.athleteId,
      exerciseId,
    );

    if (exercise === null) {
      throw new ExerciseNotFoundError();
    }

    return exercise;
  }
}
```

`ExerciseNotFoundError` здесь — обычная типизированная ошибка прикладного слоя.
Общий HTTP-фильтр должен переводить её в установленный код и статус; неизвестные
ошибки БД не должны попадать в эту ветку. Класс ошибки и фильтр необходимо реализовать
при реализации сценария, а не считать существующими из-за примера.

### Контроллер и контракт ответа

```ts
import { Controller, Get, Inject, Param, UseGuards } from '@nestjs/common';
import { SessionGuard } from '../access/session.guard.js';
import { CurrentAthlete } from '../access/current-athlete.decorator.js';
import type { VerifiedAccess } from '../access/access.type.js';
import { ExercisesService } from './exercises.service.js';

type ExerciseResponseDto = {
  id: string;
  name: string;
};

@Controller('exercises')
@UseGuards(SessionGuard)
export class ExercisesController {
  constructor(
    @Inject(ExercisesService)
    private readonly exercisesService: ExercisesService,
  ) {}

  @Get('personal/:exerciseId')
  async getPersonalById(
    @CurrentAthlete() access: VerifiedAccess,
    @Param('exerciseId') exerciseId: string,
  ): Promise<ExerciseResponseDto> {
    const exercise = await this.exercisesService.getPersonalById(access, exerciseId);

    return {
      id: exercise.id,
      name: exercise.name,
    };
  }
}
```

Идентификатор маршрута также проверяется согласованным pipe или парсером.
Конкретный формат ID примером не устанавливается. Контракт ответа перечисляет поля
явно: добавление поля в Prisma не должно случайно раскрыть его через HTTP.

### Модуль

```ts
@Module({
  imports: [DbModule, AccessModule],
  controllers: [ExercisesController],
  providers: [ExercisesService, ExercisesRepository],
  exports: [ExercisesService],
})
export class ExercisesModule {}
```

Другие модули получают сервис через импорт `ExercisesModule`. Не регистрировать
`ExercisesRepository` повторно в каждом потребителе. Не экспортировать все providers
«на будущее». `AppModule` собирает модули; контроллер здоровья также находится
в отдельном файле, когда затрагивается соответствующая реализация.

## 5. DTO, параметры и преобразования

Различать четыре структуры:

1. Вход HTTP — непроверенные данные клиента, затем проверенный DTO.
2. Параметры сценария — только то, что необходимо сервису.
3. Параметры записи — разрешённые поля конкретной операции репозитория.
4. Ответ HTTP — публичный контракт без внутренних полей и секретов.

```ts
type RenamePersonalExerciseParams = {
  exerciseId: string;
  name: string;
};

type RenamePersonalExerciseData = {
  name: string;
};
```

Идентификатор атлета поступает из проверенной сессии, а не из тела запроса.
Для команд, где ожидаемый владелец входит в протокол, сервер сравнивает его
с проверенным доступом; клиентское поле само по себе не является авторизацией.

DTO не должен напрямую превращаться в `data: { ...body }`. Поля перечислять явно.
Простое преобразование оставлять в контроллере; повторяющееся или объёмное —
в чистом `map...`. Не добавлять универсальную систему маппинга.

Класс DTO сам по себе ничего не валидирует. Если библиотека runtime-валидации
не подключена, написать явный pipe/парсер с `unknown` на входе. Не добавлять декораторы
из отсутствующего пакета. Проверять форму на границе, а предметные ограничения —
в сервисе. Не повторять одну и ту же структурную проверку в каждом внутреннем методе.

Веса передаются десятичными строками и хранятся точным десятичным типом согласно
[ADR-0020](./adr/ADR-0020-javascript-modular-monolith.md). Не переводить их неявно
через `+value`, `parseFloat` и обратно, если это меняет точность предметной операции.
Календарная дата и момент времени имеют разные контракты; не заменять дату
локального дня автоматическим `toISOString()`.

## 6. Репозиторий: запросы и результаты

Имена должны задавать ожидание:

| Метод | Контракт |
|---|---|
| `findById` | Возвращает запись или `null` |
| `findMany` | Возвращает список, допустимо пустой |
| `findManyPaginated` | Возвращает элементы и общее количество |
| `create` | Создаёт запись из разрешённых полей |
| `update` | Меняет явно перечисленные поля |
| `exists...` | Проверяет конкретное условие без загрузки всей записи |

Не заполнять класс всеми CRUD-методами заранее. Репозиторий может принимать Prisma-типы
для фильтров внутри API, но не выпускать их в HTTP-контракт или браузер.
Для повторяющейся проекции допустим `Prisma.*GetPayload` с именованным `select`;
потребителю не должна требоваться длинная цепочка условных типов.

Пример построения фильтра списка:

```ts
const where: Prisma.PersonalExerciseWhereInput = {
  athleteId: params.athleteId,
  name: params.search
    ? { contains: params.search, mode: 'insensitive' }
    : undefined,
};

const items = await client.personalExercise.findMany({
  where,
  skip: params.skip,
  take: params.take,
  // Дополнительный ключ сохраняет порядок при совпадающих названиях.
  orderBy: [{ name: 'asc' }, { id: 'asc' }],
  select: { id: true, name: true },
});
```

`skip`, `take` и сортировку валидировать на границе; не передавать клиентскую строку
напрямую в SQL. При `items` и `count` использовать одинаковый фильтр. Два запроса
в `Promise.all` сами по себе не гарантируют общий снимок: если сценарию нужна такая
согласованность, выбрать соответствующую транзакцию. Не обещать её в JSDoc без реализации.

SQL допустим для возможностей, которые Prisma не выражает удобно, например блокировок.
Использовать параметризованные запросы; не собирать значения конкатенацией.

## 7. Базовый репозиторий: когда нужен

Основной подход — конкретные репозитории с явными методами. Выбор `tx ?? prismaService`
можно оставить прямо в методе. Если это повторяется во многих репозиториях, допустим
маленький инфраструктурный базовый класс:

```ts
export abstract class BaseRepository {
  protected constructor(protected readonly prismaService: PrismaService) {}

  protected getClient(
    tx?: Prisma.TransactionClient,
  ): PrismaService | Prisma.TransactionClient {
    return tx ?? this.prismaService;
  }
}
```

Наследник сам объявляет constructor injection и вызывает `super(prismaService)`.
Базовый класс не должен превращаться в универсальный CRUD с именем модели,
скрытой авторизацией, магическими hooks и открытием транзакций на каждую запись.
Не добавлять его, пока он не сокращает реальное повторение.

## 8. Транзакции и сценарии записи

Границу транзакции определяет сервис сценария. Все репозитории внутри неё получают
один `tx` и не переключаются на основной клиент. Для записи, которая допустима
только внутри общей транзакции, параметр `tx` делать обязательным.

```ts
async function applyInsideTransaction(
  tx: Prisma.TransactionClient,
  access: VerifiedAccess,
  command: OperationCommand,
): Promise<OperationConfirmation> {
  await lockAthlete(tx, access.athleteId);
  await verifyAccessAgain(access, tx);
  assertRecoveryGeneration(command);

  // Проверяем квитанцию раньше редакции: повтор старой успешной команды
  // должен вернуть её исторический результат даже после новых изменений.
  const previousConfirmation = await findPreviousConfirmation(tx, access, command);

  if (previousConfirmation !== null) {
    return previousConfirmation;
  }

  await assertBaseRevision(tx, access, command);
  const result = await applyCommand(tx, access, command);

  return saveConfirmation(tx, access, command, result);
}
```

Это схема обязанностей, а не полный протокол. `findPreviousConfirmation` обязана
проверять хеш содержимого; проверка поколения нужна также до входа в повторяемую
запись. Полная последовательность определяется
[ADR-0021](./adr/ADR-0021-durable-drafts-and-operation-receipts.md) и
[протоколом ввода](../implementation/epics/e001-technical-design/design/input-preservation.md).

При выделении репозиториев нельзя потерять:

- проверку владельца и повторную проверку доступа в установленной границе;
- единый порядок блокировок владельца;
- проверку поколения до поиска квитанции и изменения данных;
- совпадение хеша команды при повторном UUID;
- проверку квитанции до проверки базовой редакции;
- общую транзакцию изменения, пересчёта и квитанции;
- ограниченный повтор всей транзакции при конфликте сериализации.

Не повторять отдельно последний запрос и не генерировать новый ID команды при повторе.
Не отправлять внешние запросы и не выполнять необратимые побочные эффекты внутри
повторяемого callback транзакции. Число попыток и повторяемые коды выделять явно;
ошибки доступа и предметные конфликты не считать временными сбоями БД.

## 9. Prisma и жизненный цикл

Основной клиент создаётся инфраструктурным модулем. Репозиторий не открывает своё
соединение при каждом вызове. Одна и та же конфигурация используется согласованно
при запуске API и инструментов хранения.

PrismaService может оборачивать клиент или наследовать его, если это оправдано текущим
адаптером и DI. Не копировать конструктор из старого Prisma: в проекте используется
адаптер PostgreSQL, и конфигурация должна соответствовать установленным зависимостям.
Подключение и отключение принадлежат lifecycle NestJS или явному lifecycle CLI.
Скрипту миграции не обязательно запускать весь NestJS-контейнер.

Проверка конфигурации и здоровья БД — инфраструктурные функции. Они не требуют
предметного репозитория. `PrismaClient` и транзакции не передаются во фронтенд.

## 10. Ошибки, комментарии и тесты

Ошибки отсутствия, доступа, конфликта редакции и недоступности БД различаются.
Нельзя ловить любой отказ `update` и выдавать «не найдено». Переводить только
распознанную ошибку в соответствующий контракт, остальные передавать обработчику
неизвестных ошибок без раскрытия SQL и внутренних данных.

JSDoc обязателен у методов с неочевидным требованием к транзакции, повтору,
владельцу или побочным эффектам. Локальные комментарии объясняют причины блокировок,
порядок проверок и исключения. Подробные правила и примеры —
в [общих соглашениях](./coding-conventions.md#комментарии-и-jsdoc).

Проверять наблюдаемое поведение, а не только факт вызова Prisma:

- собственная запись читается, чужая недоступна;
- ошибки хранилища не маскируются отсутствием;
- разрешённые поля обновляются, владелец из тела запроса не подменяет доступ;
- связанные изменения откатываются вместе;
- потерянный ответ и повтор команды не создают повторную запись;
- одинаковый UUID с другим содержимым отклоняется;
- конфликт сериализации повторяет всю операцию в ограниченной границе.

Не каждый простой mapper нуждается в отдельном тесте. Для свойств БД, блокировок
и транзакций нужны подходящие интеграционные проверки; mock репозитория их не доказывает.
После изменений выполнять проверку типов и применимые существующие тесты,
а изменение DI проверять запуском API.

## Связанные документы

- [Общие соглашения](./coding-conventions.md), [фронтенд](./frontend-conventions.md).
- [Глоссарий дневника](../domain/training-log/CONTEXT.md).
- [ADR-0020: стек и транзакции](./adr/ADR-0020-javascript-modular-monolith.md).
- [ADR-0021: квитанции](./adr/ADR-0021-durable-drafts-and-operation-receipts.md).
- [Протокол ввода](../implementation/epics/e001-technical-design/design/input-preservation.md).
