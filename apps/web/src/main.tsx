import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { StyleProvider } from '@ant-design/cssinjs';
import { ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import App from './App';
import { appTheme } from './app-theme';
import './styles.css';

const root = document.getElementById('root');

if (!root) {
    throw new Error('Не найден корневой элемент приложения.');
}

createRoot(root).render(
    <StrictMode>
        <StyleProvider layer>
            <ConfigProvider locale={ruRU} theme={appTheme}>
                <App />
            </ConfigProvider>
        </StyleProvider>
    </StrictMode>,
);
