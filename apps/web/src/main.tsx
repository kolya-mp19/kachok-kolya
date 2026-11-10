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
      <ConfigProvider locale={ruRU} theme={{ token: { colorPrimary: '#245d48', fontFamily: 'system-ui, sans-serif', fontSize: 16, controlHeight: 44, borderRadius: 8 } }}>
        <App />
      </ConfigProvider>
    </StyleProvider>
  </StrictMode>,
);
