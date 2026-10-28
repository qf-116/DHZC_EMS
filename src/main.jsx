import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App as AntdApp, ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App.jsx';
import './styles.css';

// 视觉基线：科技蓝主色（蓝→青渐变呼应）+ 清透冷白底 + 状态色提饱和，
// 数字统一 Bahnschrift/DIN 质感（详见 styles.css 的全局样式层）。
ReactDOM.createRoot(document.getElementById('root')).render(
  <ConfigProvider
    locale={zhCN}
    theme={{
      algorithm: theme.defaultAlgorithm,
      token: {
        colorPrimary: '#1668dc',
        colorInfo: '#4096ff',
        colorLink: '#1668dc',
        colorSuccess: '#16a34a',
        colorWarning: '#f59e0b',
        colorError: '#dc2626',
        colorTextBase: '#1b2735',
        colorBgLayout: '#f4f7fb',
        borderRadius: 8,
        borderRadiusLG: 12,
        fontSize: 14,
        fontFamily: "-apple-system, 'Segoe UI', 'PingFang SC', 'HarmonyOS Sans SC', 'Microsoft YaHei', Arial, sans-serif",
        boxShadow: '0 6px 24px rgba(15, 34, 65, 0.10)',
        boxShadowSecondary: '0 2px 8px rgba(15, 34, 65, 0.08)',
      },
      components: {
        Layout: {
          headerBg: '#ffffff',
          headerHeight: 60,
          siderBg: '#0b1526',
          bodyBg: '#f4f7fb',
        },
        Menu: {
          darkItemBg: 'transparent',
          darkSubMenuItemBg: 'transparent',
          darkPopupBg: '#101f38',
          darkItemColor: 'rgba(203, 222, 245, 0.72)',
          darkItemHoverColor: '#ffffff',
          darkItemHoverBg: 'rgba(255, 255, 255, 0.06)',
          darkItemSelectedBg: '#1668dc',
          darkItemSelectedColor: '#ffffff',
        },
        Card: {
          boxShadowTertiary: '0 1px 2px rgba(15, 34, 65, 0.05), 0 4px 16px rgba(15, 34, 65, 0.06)',
        },
        Table: {
          headerBg: '#f7faff',
          headerSplitColor: 'transparent',
          rowHoverBg: '#f0f6ff',
          headerBorderRadius: 12,
          cellPaddingBlock: 13,
          cellPaddingInline: 16,
        },
        Button: {
          fontWeight: 500,
          primaryShadow: '0 1px 2px rgba(15, 34, 65, 0.06), 0 4px 12px rgba(22, 104, 220, 0.22)',
        },
        Tag: {
          borderRadiusSM: 999,
        },
      },
    }}
  >
    <AntdApp>
      <HashRouter>
        <App />
      </HashRouter>
    </AntdApp>
  </ConfigProvider>,
);
