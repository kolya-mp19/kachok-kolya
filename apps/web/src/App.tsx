import { lazy, Suspense } from 'react';
import { ContextNavigation } from './components/ContextNavigation';
import { PageBoundary } from './components/PageBoundary';

// Разделы загружаются независимо: калькулятор не загружает код дневника и его сессии.
const CalculatorPage = lazy(() => import('./calculator/CalculatorPage'));
const DiaryPage = lazy(() => import('./diary/DiaryPage'));

export default function App() {
    const currentPath = window.location.pathname.replace(/\/$/, '') || '/calculator';
    const isKnownContext = currentPath === '/calculator' || currentPath === '/diary';

    return (
        <div className="app-shell mx-auto max-w-xl px-4">
            <a className="skip-link" href="#main-content">
                К содержимому
            </a>
            <header className="app-header">
                <p className="app-name">Качок Коля</p>
                <ContextNavigation currentPath={currentPath} />
            </header>
            <main id="main-content" tabIndex={-1} className="context-content">
                <PageBoundary>
                    <Suspense
                        fallback={
                            <p className="empty-state" role="status">
                                Загружаем раздел…
                            </p>
                        }
                    >
                        {currentPath === '/calculator' && <CalculatorPage />}
                        {currentPath === '/diary' && <DiaryPage />}
                    </Suspense>
                </PageBoundary>
                {!isKnownContext && (
                    <section>
                        <h1>Страница не найдена</h1>
                        <p>Выберите калькулятор или дневник в навигации.</p>
                    </section>
                )}
            </main>
        </div>
    );
}
