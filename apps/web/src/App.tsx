import { useEffect, useState, type ComponentType } from 'react';

const context = window.location.pathname.replace(/\/$/, '') || '/calculator';

export default function App() {
  const [Page, setPage] = useState<ComponentType | null>(null);
  useEffect(() => {
    const page = context === '/calculator'
      ? import('./calculator/CalculatorPage')
      : context === '/diary'
        ? import('./diary/DiaryPage')
        : null;
    void page?.then((module) => setPage(() => module.default));
  }, []);
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
        {Page && <Page />}
        {!knownContext && <section><h1>Страница не найдена</h1><p>Выберите калькулятор или дневник в навигации.</p></section>}
      </main>
    </div>
  );
}
