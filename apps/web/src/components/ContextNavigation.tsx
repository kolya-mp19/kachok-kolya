type ContextNavigationProps = {
    currentPath: string;
};

export function ContextNavigation({ currentPath }: ContextNavigationProps) {
    return (
        <nav aria-label="Разделы приложения" className="context-navigation flex flex-wrap gap-2">
            <a href="/calculator" aria-current={currentPath === '/calculator' ? 'page' : undefined}>
                Калькулятор
            </a>
            <a href="/diary" aria-current={currentPath === '/diary' ? 'page' : undefined}>
                Дневник
            </a>
        </nav>
    );
}
