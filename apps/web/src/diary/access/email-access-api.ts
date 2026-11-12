import type {
    AuthAttemptResponse,
    RegistrationRequest,
    PasswordLoginRequest,
    RegistrationResponse,
    SessionResponse,
    RecoveryRequest,
    RecoveryResponse,
} from '../../../../../contracts/email-access';

const messages: Record<string, string> = {
    INVALID_INPUT: 'Проверьте имя и почту. Пароль должен содержать от 12 до 256 символов.',
    CSRF_INVALID: 'Время действия формы истекло. Повторите действие. Для нового письма можно заново указать почту.',
    EMAIL_UNAVAILABLE: 'Этот адрес уже зарегистрирован. Войдите в прежний дневник.',
    INVALID_LOGIN: 'Не удалось войти. Проверьте почту и пароль.',
    CONFIRMATION_INVALID: 'Ссылка недействительна, использована или срок её действия истёк. Запросите новое письмо.',
    DELIVERY_FAILED: 'Не удалось отправить письмо. Дневник не создан. Повторите отправку.',
    RATE_LIMITED: 'Слишком много попыток. Попробуйте позже.',
};

/** Только этот тип содержит подготовленный для атлета безопасный текст. */
export class EmailAccessError extends Error {
    constructor(
        message: string,
        readonly code?: string,
    ) {
        super(message);
    }
}

function isObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function request(path: string, input?: { body: unknown; csrfToken: string }): Promise<unknown> {
    let response: Response;
    try {
        response = await fetch(`/api/auth/${path}`, {
            method: input ? 'POST' : 'GET',
            credentials: 'same-origin',
            cache: 'no-store',
            headers: input ? { 'Content-Type': 'application/json', 'X-CSRF-Token': input.csrfToken } : undefined,
            body: input ? JSON.stringify(input.body) : undefined,
        });
    } catch {
        throw new EmailAccessError('Нет связи с сервером. Проверьте подключение и повторите действие.');
    }
    const result: unknown = await response.json().catch(() => null);
    if (response.status === 401 && path === 'session') {
        return null;
    }
    if (!response.ok) {
        const code = isObject(result) && typeof result.code === 'string' ? result.code : '';
        throw new EmailAccessError(
            messages[code] ?? 'Доступ к дневнику временно недоступен. Повторите действие позже.',
            code,
        );
    }
    return result;
}

function parseIdentity(result: unknown): SessionResponse {
    if (
        !isObject(result) ||
        typeof result.athleteId !== 'string' ||
        typeof result.diaryId !== 'string' ||
        typeof result.name !== 'string' ||
        (result.csrfToken !== undefined && typeof result.csrfToken !== 'string')
    ) {
        throw new EmailAccessError('Не удалось проверить вход. Обновите страницу.');
    }
    return { athleteId: result.athleteId, diaryId: result.diaryId, name: result.name, csrfToken: result.csrfToken };
}

function parseSent(result: unknown): RegistrationResponse {
    if (!isObject(result) || result.status !== 'sent' || typeof result.pendingId !== 'string') {
        throw new EmailAccessError('Не удалось подтвердить отправку. Повторите действие.');
    }
    return { status: 'sent', pendingId: result.pendingId };
}

export async function beginAttempt(): Promise<AuthAttemptResponse> {
    const result = await request('attempt');
    if (!isObject(result) || typeof result.csrfToken !== 'string') {
        throw new EmailAccessError('Не удалось открыть форму. Обновите страницу.');
    }
    return { csrfToken: result.csrfToken };
}

export async function getSession(): Promise<SessionResponse | null> {
    const result = await request('session');
    return result === null ? null : parseIdentity(result);
}

export async function register(input: RegistrationRequest, csrfToken: string): Promise<RegistrationResponse> {
    return parseSent(await request('registration', { body: input, csrfToken }));
}

export async function login(input: PasswordLoginRequest, csrfToken: string): Promise<SessionResponse> {
    return parseIdentity(await request('login', { body: input, csrfToken }));
}

export async function resendRegistration(pendingId: string, csrfToken: string): Promise<RegistrationResponse> {
    return parseSent(await request('registration/resend', { body: { pendingId }, csrfToken }));
}

export async function cancelRegistration(pendingId: string, csrfToken: string): Promise<void> {
    const result = await request('registration/cancel', { body: { pendingId }, csrfToken });
    if (!isObject(result) || result.status !== 'cancelled') {
        throw new EmailAccessError('Не удалось подтвердить отмену. Повторите действие.');
    }
}

export async function confirmRegistration(token: string, csrfToken: string): Promise<SessionResponse> {
    return parseIdentity(await request('registration/confirm', { body: { token }, csrfToken }));
}

function parseRecoveryResponse(result: unknown): RecoveryResponse {
    if (!isObject(result) || result.status !== 'accepted' || typeof result.pendingId !== 'string') {
        throw new EmailAccessError('Не удалось принять запрос письма. Повторите действие.');
    }
    return { status: 'accepted', pendingId: result.pendingId };
}

export async function requestRecovery(input: RecoveryRequest, csrfToken: string): Promise<RecoveryResponse> {
    return parseRecoveryResponse(await request('recovery', { body: input, csrfToken }));
}

export async function resendRecovery(pendingId: string, csrfToken: string): Promise<RecoveryResponse> {
    return parseRecoveryResponse(await request('recovery/resend', { body: { pendingId }, csrfToken }));
}

export async function cancelRecovery(pendingId: string, csrfToken: string): Promise<void> {
    const result = await request('recovery/cancel', { body: { pendingId }, csrfToken });
    if (!isObject(result) || result.status !== 'cancelled') {
        throw new EmailAccessError('Не удалось подтвердить отмену. Повторите действие.');
    }
}

export async function confirmRecovery(token: string, password: string, csrfToken: string): Promise<void> {
    const result = await request('recovery/confirm', { body: { token, password }, csrfToken });
    if (!isObject(result) || result.status !== 'reset') {
        throw new EmailAccessError('Не удалось подтвердить смену пароля. Повторите действие.');
    }
}
