import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type {
    PasswordLoginRequest,
    RegistrationRequest,
    SessionResponse,
    RecoveryRequest,
} from '../../../../../contracts/email-access';
import * as api from './email-access-api';

export type EmailAccessState =
    | { status: 'loading' }
    | { status: 'registration' }
    | { status: 'login' }
    | { status: 'recovery' }
    | { status: 'recovery-requested'; pendingId: string }
    | { status: 'recovery-confirmation'; token: string }
    | { status: 'password-reset' }
    | { status: 'confirmation'; token: string }
    | { status: 'sent'; pendingId: string }
    | { status: 'diary'; identity: SessionResponse };

type EmailAccessController = {
    state: EmailAccessState;
    errorMessage: string;
    isSubmitting: boolean;
    register: (input: RegistrationRequest) => Promise<void>;
    login: (input: PasswordLoginRequest) => Promise<void>;
    showForm: (status: 'login' | 'registration' | 'recovery') => void;
    requestRecovery: (input: RecoveryRequest) => Promise<void>;
    resetPassword: (password: string) => Promise<void>;
    resend: () => Promise<void>;
    confirm: () => Promise<void>;
    cancel: () => Promise<void>;
};

export type EmailLink = { purpose: 'registration' | 'recovery'; token: string };

function linkState(link: EmailLink): EmailAccessState {
    return link.purpose === 'recovery'
        ? { status: 'recovery-confirmation', token: link.token }
        : { status: 'confirmation', token: link.token };
}

/** Проверяет сессию только внутри дневника; никакие секреты не записывает в storage. */
export function useEmailAccess(initialLink: EmailLink | null): EmailAccessController {
    const [state, setState] = useState<EmailAccessState>(initialLink ? linkState(initialLink) : { status: 'loading' });
    const [errorMessage, setErrorMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const csrfToken = useRef<string | null>(null);
    const hasActiveAction = useRef(false);
    const linkGeneration = useRef(0);

    useLayoutEffect(() => {
        // Запрос старой ссылки может завершиться после перехода к новой. Он
        // остаётся в полёте, но уже не имеет права менять экран или его ошибку.
        linkGeneration.current += 1;
        setErrorMessage('');
    }, [initialLink]);

    useEffect(() => {
        if (initialLink) {
            setState(linkState(initialLink));
            setErrorMessage('');
            return;
        }
        let isActive = true;
        const load = async (): Promise<void> => {
            try {
                const identity = await api.getSession();
                if (isActive) {
                    setState(identity ? { status: 'diary', identity } : { status: 'login' });
                }
            } catch (error: unknown) {
                if (isActive) {
                    setState({ status: 'login' });
                    setErrorMessage(
                        error instanceof api.EmailAccessError ? error.message : 'Не удалось проверить вход.',
                    );
                }
            }
        };
        void load();
        return () => {
            isActive = false;
        };
    }, [initialLink]);

    const run = async (action: (complete: (next: EmailAccessState) => void) => Promise<void>): Promise<void> => {
        if (hasActiveAction.current) {
            return;
        }
        hasActiveAction.current = true;
        const generation = linkGeneration.current;
        const complete = (next: EmailAccessState): void => {
            if (generation === linkGeneration.current) {
                setState(next);
            }
        };
        setIsSubmitting(true);
        setErrorMessage('');
        try {
            await action(complete);
        } catch (error: unknown) {
            // Сервер отклоняет CSRF до изменения данных. Обновляем доказательство
            // только при следующем явном действии, без автоматического повтора POST.
            if (error instanceof api.EmailAccessError && error.code === 'CSRF_INVALID') {
                csrfToken.current = null;
            }
            if (generation === linkGeneration.current) {
                setErrorMessage(
                    error instanceof api.EmailAccessError
                        ? error.message
                        : 'Не удалось выполнить действие. Повторите попытку.',
                );
            }
        } finally {
            setIsSubmitting(false);
            hasActiveAction.current = false;
        }
    };

    const getCsrf = async (): Promise<string> => {
        if (!csrfToken.current) {
            csrfToken.current = (await api.beginAttempt()).csrfToken;
        }
        return csrfToken.current;
    };

    const register = async (input: RegistrationRequest): Promise<void> =>
        run(async (complete) => {
            const result = await api.register(input, await getCsrf());
            complete({ status: 'sent', pendingId: result.pendingId });
        });

    const login = async (input: PasswordLoginRequest): Promise<void> =>
        run(async (complete) => {
            const identity = await api.login(input, await getCsrf());
            complete({ status: 'diary', identity });
        });

    const showForm = (status: 'login' | 'registration' | 'recovery'): void => {
        if (hasActiveAction.current) {
            return;
        }
        setErrorMessage('');
        setState({ status });
    };

    const requestRecovery = async (input: RecoveryRequest): Promise<void> =>
        run(async (complete) => {
            const result = await api.requestRecovery(input, await getCsrf());
            complete({ status: 'recovery-requested', pendingId: result.pendingId });
        });

    const resetPassword = async (password: string): Promise<void> =>
        run(async (complete) => {
            if (state.status !== 'recovery-confirmation') {
                return;
            }
            await api.confirmRecovery(state.token, password, await getCsrf());
            complete({ status: 'password-reset' });
        });

    const resend = async (): Promise<void> =>
        run(async (complete) => {
            if (state.status === 'recovery-requested') {
                const result = await api.resendRecovery(state.pendingId, await getCsrf());
                complete({ status: 'recovery-requested', pendingId: result.pendingId });
                return;
            }
            if (state.status !== 'sent') {
                return;
            }
            const result = await api.resendRegistration(state.pendingId, await getCsrf());
            complete({ status: 'sent', pendingId: result.pendingId });
        });

    const confirm = async (): Promise<void> =>
        run(async (complete) => {
            if (state.status !== 'confirmation') {
                return;
            }
            const identity = await api.confirmRegistration(state.token, await getCsrf());
            complete({ status: 'diary', identity });
        });

    const cancel = async (): Promise<void> =>
        run(async (complete) => {
            if (state.status === 'recovery-requested') {
                await api.cancelRecovery(state.pendingId, await getCsrf());
                complete({ status: 'login' });
                return;
            }
            if (state.status === 'recovery-confirmation') {
                complete({ status: 'recovery' });
                return;
            }
            if (state.status === 'sent') {
                await api.cancelRegistration(state.pendingId, await getCsrf());
            }
            complete({ status: 'registration' });
        });

    return {
        state,
        errorMessage,
        isSubmitting,
        register,
        login,
        showForm,
        requestRecovery,
        resetPassword,
        resend,
        confirm,
        cancel,
    };
}
