import { Component, type ReactNode } from 'react';

type PageBoundaryProps = {
    children: ReactNode;
};

type PageBoundaryState = {
    failed: boolean;
};

/** Навигация остаётся снаружи границы, чтобы отказ lazy-модуля не блокировал смену раздела. */
export class PageBoundary extends Component<PageBoundaryProps, PageBoundaryState> {
    state: PageBoundaryState = { failed: false };

    static getDerivedStateFromError(): PageBoundaryState {
        return { failed: true };
    }

    private handleReload = (): void => {
        // Повторный render использовал бы уже отклонённый promise lazy-модуля.
        // Полная загрузка документа даёт браузеру возможность запросить его заново.
        window.location.reload();
    };

    render(): ReactNode {
        if (this.state.failed) {
            return (
                <section className="empty-state" role="alert" aria-labelledby="page-error-title">
                    <h1 id="page-error-title">Не удалось открыть раздел</h1>
                    <p>Проверьте соединение и обновите страницу. Можно также выбрать другой раздел в навигации.</p>
                    <button className="recovery-action" type="button" onClick={this.handleReload}>
                        Обновить страницу
                    </button>
                </section>
            );
        }

        return this.props.children;
    }
}
