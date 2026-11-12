import { useEffect, useRef, useState } from 'react';
import type { PasswordLoginRequest, RegistrationRequest, SessionResponse } from '../../../../../contracts/email-access';
import * as api from './email-access-api';

export type EmailAccessState =
    | { status: 'loading' }
    | { status: 'registration' }
    | { status: 'login' }
    | { status: 'confirmation'; token: string }
    | { status: 'sent'; pendingId: string }
    | { status: 'diary'; identity: SessionResponse };

type EmailAccessController = {
    state: EmailAccessState;
    errorMessage: string;
    isSubmitting: boolean;
    register: (input: RegistrationRequest) => Promise<void>;
    login: (input: PasswordLoginRequest) => Promise<void>;
    showForm: (status: 'login' | 'registration') => void;
    resend: () => Promise<void>;
    confirm: () => Promise<void>;
    cancel: () => Promise<void>;
};

/** Проверяет сессию только внутри дневника; никакие секреты не записывает в storage. */
export function useEmailAccess(initialToken: string | null): EmailAccessController {
    const [state, setState] = useState<EmailAccessState>(
        initialToken ? { status: 'confirmation', token: initialToken } : { status: 'loading' },
    );
    const [errorMessage, setErrorMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const csrfToken = useRef<string | null>(null);
    const hasActiveAction = useRef(false);

    useEffect(() => {
        if (initialToken) {
            setState({ status: 'confirmation', token: initialToken });
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
    }, [initialToken]);

    const run = async (action: () => Promise<void>): Promise<void> => {
        if (hasActiveAction.current) {
            return;
        }
        hasActiveAction.current = true;
        setIsSubmitting(true);
        setErrorMessage('');
        try {
            await action();
        } catch (error: unknown) {
            setErrorMessage(
                error instanceof api.EmailAccessError
                    ? error.message
                    : 'Не удалось выполнить действие. Повторите попытку.',
            );
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
        run(async () => {
            const result = await api.register(input, await getCsrf());
            setState({ status: 'sent', pendingId: result.pendingId });
        });

    const login = async (input: PasswordLoginRequest): Promise<void> =>
        run(async () => {
            const identity = await api.login(input, await getCsrf());
            setState({ status: 'diary', identity });
        });

    const showForm = (status: 'login' | 'registration'): void => {
        if (hasActiveAction.current) {
            return;
        }
        setErrorMessage('');
        setState({ status });
    };

    const resend = async (): Promise<void> =>
        run(async () => {
            if (state.status !== 'sent') {
                return;
            }
            const result = await api.resendRegistration(state.pendingId, await getCsrf());
            setState({ status: 'sent', pendingId: result.pendingId });
        });

    const confirm = async (): Promise<void> =>
        run(async () => {
            if (state.status !== 'confirmation') {
                return;
            }
            const identity = await api.confirmRegistration(state.token, await getCsrf());
            setState({ status: 'diary', identity });
        });

    const cancel = async (): Promise<void> =>
        run(async () => {
            if (state.status === 'sent') {
                await api.cancelRegistration(state.pendingId, await getCsrf());
            }
            setState({ status: 'registration' });
        });

    return { state, errorMessage, isSubmitting, register, login, showForm, resend, confirm, cancel };
}
