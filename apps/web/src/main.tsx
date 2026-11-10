import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { StyleProvider } from '@ant-design/cssinjs';
import { ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import App from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StyleProvider layer>
      <ConfigProvider locale={ruRU} theme={{ token: {
        colorPrimary: '#2457a7',
        colorText: '#17212b',
        colorTextSecondary: '#556270',
        colorBgLayout: '#f6f7f9',
        colorBgContainer: '#ffffff',
        colorBorder: '#c8d0da',
        colorError: '#a12622',
        fontFamily: 'system-ui, sans-serif',
        fontSize: 16,
        controlHeight: 44,
        borderRadius: 8,
      } }}>
        <App />
      </ConfigProvider>
    </StyleProvider>
  </StrictMode>,
);
