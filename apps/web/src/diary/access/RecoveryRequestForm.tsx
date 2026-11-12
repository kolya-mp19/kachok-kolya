import { Button, Form, Input } from 'antd';
import type { RecoveryRequest } from '../../../../../contracts/email-access';

type RecoveryRequestFormProps = {
    isSubmitting: boolean;
    onSubmit: (input: RecoveryRequest) => Promise<void>;
    onCancel: () => void;
};

/** Обработчик сценария удерживает отказ; форма не стирает почту при ошибке запроса. */
export function RecoveryRequestForm({ isSubmitting, onSubmit, onCancel }: RecoveryRequestFormProps) {
    return (
        <Form<RecoveryRequest> layout="vertical" requiredMark={false} onFinish={onSubmit} className="diary-access-form">
            <h2>Восстановление доступа</h2>
            <p>Укажите почту своего дневника. Запрос письма не меняет пароль.</p>
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
            <Button type="primary" htmlType="submit" loading={isSubmitting} block>
                Отправить письмо
            </Button>
            <p>Без доступа к почте или подключённому способу входа восстановить доступ автоматически не получится.</p>
            <Button htmlType="button" onClick={onCancel} disabled={isSubmitting} block>
                Вернуться ко входу
            </Button>
        </Form>
    );
}
