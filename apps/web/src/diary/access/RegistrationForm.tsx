import { Button, Form, Input } from 'antd';
import type { RegistrationRequest } from '../../../../../contracts/email-access';

type RegistrationFormProps = {
    isSubmitting: boolean;
    onSubmit: (input: RegistrationRequest) => Promise<void>;
    onLogin: () => void;
};

/** Поля остаются при неуспехе; пароль живёт только в памяти формы до подтверждённой отправки. */
export function RegistrationForm({ isSubmitting, onSubmit, onLogin }: RegistrationFormProps) {
    return (
        <Form<RegistrationRequest>
            layout="vertical"
            requiredMark={false}
            onFinish={onSubmit}
            className="diary-access-form"
        >
            <h2>Регистрация по почте</h2>
            <p>Подтвердите почту, чтобы создать личный дневник тренировок.</p>
            <Form.Item
                name="name"
                label="Имя"
                rules={[
                    { required: true, whitespace: true, message: 'Введите имя' },
                    { max: 100, message: 'Не больше 100 символов' },
                ]}
            >
                <Input autoComplete="name" maxLength={100} disabled={isSubmitting} />
            </Form.Item>
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
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    disabled={isSubmitting}
                />
            </Form.Item>
            <Form.Item
                name="password"
                label="Пароль"
                extra="От 12 до 256 символов. Можно вставить из менеджера паролей."
                rules={[
                    { required: true, message: 'Введите пароль' },
                    { min: 12, max: 256, message: 'От 12 до 256 символов' },
                ]}
            >
                <Input.Password autoComplete="new-password" maxLength={256} disabled={isSubmitting} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={isSubmitting} block>
                Отправить письмо
            </Button>
            <div className="diary-access-actions">
                <Button htmlType="button" onClick={onLogin} disabled={isSubmitting} block>
                    Войти в прежний дневник
                </Button>
            </div>
        </Form>
    );
}
