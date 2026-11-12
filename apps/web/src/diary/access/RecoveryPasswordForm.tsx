import { Button, Form, Input } from 'antd';

type PasswordValues = { password: string };
type RecoveryPasswordFormProps = {
    isSubmitting: boolean;
    onSubmit: (password: string) => Promise<void>;
    onCancel: () => void;
};

/** Пароль существует только в памяти формы. Отказ подтверждения сохраняет ввод для повтора. */
export function RecoveryPasswordForm({ isSubmitting, onSubmit, onCancel }: RecoveryPasswordFormProps) {
    const handleFinish = (values: PasswordValues): void => {
        void onSubmit(values.password);
    };
    return (
        <Form<PasswordValues>
            layout="vertical"
            requiredMark={false}
            onFinish={handleFinish}
            className="diary-access-form"
        >
            <h2>Новый пароль</h2>
            <p>
                Установите новый пароль к прежнему дневнику. Его записи сохранятся, на других устройствах потребуется
                войти заново.
            </p>
            <Form.Item
                name="password"
                label="Новый пароль"
                extra="От 12 до 256 символов. Можно вставить из менеджера паролей."
                rules={[
                    { required: true, message: 'Введите новый пароль' },
                    { min: 12, max: 256, message: 'От 12 до 256 символов' },
                ]}
            >
                <Input.Password autoComplete="new-password" maxLength={256} disabled={isSubmitting} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={isSubmitting} block>
                Установить пароль
            </Button>
            <div className="diary-access-actions">
                <Button htmlType="button" onClick={onCancel} disabled={isSubmitting} block>
                    Отменить восстановление
                </Button>
            </div>
        </Form>
    );
}
