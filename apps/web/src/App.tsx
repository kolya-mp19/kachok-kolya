import { Component, lazy, Suspense, type ReactNode } from 'react';

const context = window.location.pathname.replace(/\/$/, '') || '/calculator';
const CalculatorPage = lazy(() => import('./calculator/CalculatorPage'));
const DiaryPage = lazy(() => import('./diary/DiaryPage'));

class PageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <section className="empty-state" role="alert" aria-labelledby="page-error-title">
          <h1 id="page-error-title">Не удалось открыть раздел</h1>
          <p>Проверьте соединение и обновите страницу. Можно также выбрать другой раздел в навигации.</p>
          <button className="recovery-action" type="button" onClick={() => window.location.reload()}>Обновить страницу</button>
        </section>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const knownContext = context === '/calculator' || context === '/diary';
  return (
    <div className="app-shell mx-auto max-w-xl px-4">
      <a className="skip-link" href="#main-content">К содержимому</a>
      <header className="app-header">
        <p className="app-name">Качок Коля</p>
        <nav aria-label="Разделы приложения" className="context-navigation flex flex-wrap gap-2">
          <a href="/calculator" aria-current={context === '/calculator' ? 'page' : undefined}>Калькулятор</a>
          <a href="/diary" aria-current={context === '/diary' ? 'page' : undefined}>Дневник</a>
        </nav>
      </header>
      <main id="main-content" tabIndex={-1} className="context-content">
        <PageBoundary>
          <Suspense fallback={<p className="empty-state" role="status">Загружаем раздел…</p>}>
            {context === '/calculator' && <CalculatorPage />}
            {context === '/diary' && <DiaryPage />}
          </Suspense>
        </PageBoundary>
        {!knownContext && <section><h1>Страница не найдена</h1><p>Выберите калькулятор или дневник в навигации.</p></section>}
      </main>
    </div>
  );
}
