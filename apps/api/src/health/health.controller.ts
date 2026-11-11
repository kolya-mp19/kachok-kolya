import { Controller, Get } from '@nestjs/common';

type HealthResponse = {
  status: 'ok';
};

@Controller('health')
export class HealthController {
  /** Проверяет процесс, не подключая БД: локальная оболочка работает без хранилища. */
  @Get()
  health(): HealthResponse {
    return { status: 'ok' };
  }
}
