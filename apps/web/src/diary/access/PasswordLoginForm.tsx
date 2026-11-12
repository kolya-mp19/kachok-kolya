import { Button, Form, Input } from 'antd';
import type { PasswordLoginRequest } from '../../../../../contracts/email-access';

type PasswordLoginFormProps = {
    isSubmitting: boolean;
    onSubmit: (input: PasswordLoginRequest) => Promise<void>;
    onRegister: () => void;
    onRecover: () => void;
};

/** Сценарий обрабатывает отказ; форма сохраняет введённый пароль до успешного входа. */
export function PasswordLoginForm({ isSubmitting, onSubmit, onRegister, onRecover }: PasswordLoginFormProps) {
    return (
        <Form<PasswordLoginRequest>
            layout="vertical"
            requiredMark={false}
            onFinish={onSubmit}
            className="diary-access-form"
        >
            <h2>Вход по почте</h2>
            <p>Войдите, чтобы продолжить план тренировок в своём дневнике.</p>
            <Form.Item
                name="email"
                label="Почта"
                rules={[
                    { required: true, message: 'Введите почту' },
                    { type: 'email', message: 'Проверьте адрес почты' },
                    { max: 254, message: 'Не больше 254 символов' },
                ]}
            >
                <Input
                    type="email"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    disabled={isSubmitting}
                />
            </Form.Item>
            <Form.Item
                name="password"
                label="Пароль"
                rules={[
                    { required: true, message: 'Введите пароль' },
                    { max: 256, message: 'Не больше 256 символов' },
                ]}
            >
                <Input.Password autoComplete="current-password" maxLength={256} disabled={isSubmitting} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={isSubmitting} block>
                Войти
            </Button>
            <div className="diary-access-actions">
                <Button htmlType="button" onClick={onRecover} disabled={isSubmitting} block>
                    Забыли пароль
                </Button>
                <Button htmlType="button" onClick={onRegister} disabled={isSubmitting} block>
                    Создать дневник
                </Button>
            </div>
        </Form>
    );
}
