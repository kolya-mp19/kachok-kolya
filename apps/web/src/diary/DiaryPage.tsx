import { Alert, Button, Space } from 'antd';
import { useLayoutEffect, useState } from 'react';
import { RegistrationForm } from './access/RegistrationForm';
import { PasswordLoginForm } from './access/PasswordLoginForm';
import { useEmailAccess, type EmailLink } from './access/useEmailAccess';
import { RecoveryRequestForm } from './access/RecoveryRequestForm';
import { RecoveryPasswordForm } from './access/RecoveryPasswordForm';

function readEmailLink(): EmailLink | null {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const registration = fragment.get('confirm');
    const recovery = fragment.get('recover');
    if (recovery) {
        return { purpose: 'recovery', token: recovery };
    }
    return registration ? { purpose: 'registration', token: registration } : null;
}

export default function DiaryPage() {
    const [initialLink, setInitialLink] = useState(readEmailLink);
    useLayoutEffect(() => {
        // Чтение initializer остаётся чистым при StrictMode. Layout effect убирает
        // секрет из URL до сетевых эффектов; после unmount токена в модуле нет.
        const readLink = (): void => {
            if (window.location.hash) {
                setInitialLink(readEmailLink());
                window.history.replaceState(null, '', window.location.pathname);
            }
        };
        readLink();
        // Переход на ссылку письма в уже открытой вкладке может менять только hash.
        window.addEventListener('hashchange', readLink);
        return () => window.removeEventListener('hashchange', readLink);
    }, []);
    const access = useEmailAccess(initialLink);
    return (
        <section aria-labelledby="diary-title">
            <h1 id="diary-title">Дневник</h1>
            <p className="context-description">План тренировок и записи о выполнении</p>
            {access.errorMessage && (
                <Alert type="error" showIcon title={access.errorMessage} className="diary-access-error" />
            )}
            {access.state.status === 'loading' && (
                <p role="status" className="empty-state">
                    Проверяем вход…
                </p>
            )}
            {access.state.status === 'registration' && (
                <RegistrationForm
                    isSubmitting={access.isSubmitting}
                    onSubmit={access.register}
                    onLogin={() => access.showForm('login')}
                    onRecover={() => access.showForm('recovery')}
                />
            )}
            {access.state.status === 'login' && (
                <PasswordLoginForm
                    isSubmitting={access.isSubmitting}
                    onSubmit={access.login}
                    onRegister={() => access.showForm('registration')}
                    onRecover={() => access.showForm('recovery')}
                />
            )}
            {access.state.status === 'recovery' && (
                <RecoveryRequestForm
                    isSubmitting={access.isSubmitting}
                    onSubmit={access.requestRecovery}
                    onCancel={() => access.showForm('login')}
                />
            )}
            {access.state.status === 'recovery-requested' && (
                <div className="empty-state">
                    <h2>Запрос принят</h2>
                    <p role="status">
                        Если для этой почты есть дневник, проверьте входящие. Если письма нет, повторите запрос позже.
                        Пароль пока не изменён.
                    </p>
                    <Space direction="vertical" className="diary-access-actions">
                        <Button onClick={access.resend} loading={access.isSubmitting}>
                            Отправить письмо ещё раз
                        </Button>
                        <Button onClick={access.cancel} disabled={access.isSubmitting}>
                            Отменить восстановление
                        </Button>
                        <Button onClick={() => access.showForm('recovery')} disabled={access.isSubmitting}>
                            Указать почту заново
                        </Button>
                    </Space>
                </div>
            )}
            {access.state.status === 'recovery-confirmation' && (
                <>
                    <RecoveryPasswordForm
                        key={access.state.token}
                        isSubmitting={access.isSubmitting}
                        onSubmit={access.resetPassword}
                        onCancel={access.cancel}
                    />
                    <Button onClick={() => access.showForm('recovery')} disabled={access.isSubmitting}>
                        Запросить новое письмо
                    </Button>
                </>
            )}
            {access.state.status === 'password-reset' && (
                <div className="empty-state">
                    <h2>Пароль установлен</h2>
                    <p role="status">Дневник и его записи сохранены. Войдите с новым паролем.</p>
                    <Button type="primary" onClick={() => access.showForm('login')}>
                        Войти
                    </Button>
                </div>
            )}
            {access.state.status === 'sent' && (
                <div className="empty-state">
                    <h2>Подтвердите почту</h2>
                    <p role="status">
                        Письмо отправлено. Откройте ссылку из письма и подтвердите почту. Дневник ещё не создан.
                    </p>
                    <Space direction="vertical" className="diary-access-actions">
                        <Button onClick={access.resend} loading={access.isSubmitting}>
                            Отправить письмо ещё раз
                        </Button>
                        <Button onClick={access.cancel} disabled={access.isSubmitting}>
                            Отменить регистрацию
                        </Button>
                    </Space>
                </div>
            )}
            {access.state.status === 'confirmation' && (
                <div className="empty-state">
                    <h2>Подтвердите почту</h2>
                    <p>
                        Подтверждение создаст личный дневник. Если вы не запрашивали регистрацию, не подтверждайте её.
                    </p>
                    <Space direction="vertical" className="diary-access-actions">
                        <Button type="primary" onClick={access.confirm} loading={access.isSubmitting}>
                            Подтвердить почту
                        </Button>
                        <Button onClick={access.cancel} disabled={access.isSubmitting}>
                            Вернуться к регистрации
                        </Button>
                    </Space>
                </div>
            )}
            {access.state.status === 'diary' && (
                <div className="empty-state">
                    <h2>Ваш дневник пока пуст</h2>
                    <p>{access.state.identity.name}, здесь появятся план тренировок и записи о выполнении.</p>
                    <p>Следующий шаг — создать первый цикл. Планирование цикла будет доступно позже.</p>
                </div>
            )}
        </section>
    );
}
