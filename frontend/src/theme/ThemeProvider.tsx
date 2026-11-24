import { useEffect, type ReactNode } from 'react'
import { ConfigProvider, theme as antdTheme, type ThemeConfig } from 'antd'
import koKR from 'antd/locale/ko_KR'

/** antd 색을 DESIGN.md 의 값(tokens.css 와 같은 값)으로 맞춘다. 그림자와 큰 모서리는 쓰지 않는다. */
const THEME: ThemeConfig = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    colorPrimary: '#3b82f6',
    colorBgBase: '#09090b',
    colorBgContainer: '#111114',
    colorBgElevated: '#18181b',
    colorBgLayout: '#09090b',
    colorBorder: 'rgba(255, 255, 255, 0.12)',
    colorBorderSecondary: 'rgba(255, 255, 255, 0.08)',
    colorText: '#fafafa',
    colorTextSecondary: '#a1a1aa',
    colorTextTertiary: '#52525b',
    colorError: '#fb7185',
    colorWarning: '#fbbf24',
    colorSuccess: '#34d399',
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,
    fontSize: 13,
    fontFamily: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    boxShadow: 'none',
    boxShadowSecondary: 'none',
  },
  components: {
    Table: {
      colorBgContainer: 'transparent',
      headerBg: '#18181b',
      rowHoverBg: '#18181b',
    },
    Card: { headerFontSize: 13 },
  },
}

/** 다크 단색 테마. html 의 data-theme 은 챗봇의 다크 값(chat.css)도 같이 켠다. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.dataset.theme = 'dark'
  }, [])

  return (
    <ConfigProvider locale={koKR} theme={THEME}>
      {children}
    </ConfigProvider>
  )
}
