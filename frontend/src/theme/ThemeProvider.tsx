import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ConfigProvider, theme as antdTheme, type ThemeConfig } from 'antd'
import koKR from 'antd/locale/ko_KR'
import { ThemeContext, type ThemeMode } from './useThemeMode'

const STORAGE_KEY = 'callcenter-theme'

/** 처음 열 때: 저장된 값이 있으면 그것, 없으면 라이트 */
function readInitialMode(): ThemeMode {
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved === 'dark' ? 'dark' : 'light'
}

/** 다크일 때만 antd 색을 덮어쓴다. 유리 느낌의 반투명 배경은 CSS 변수(tokens.css)와 같은 값을 쓴다. */
const DARK_THEME: ThemeConfig = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    colorPrimary: '#6c7bff',
    colorBgContainer: 'rgba(255, 255, 255, 0.06)',
    colorBgElevated: '#141b45',
    colorBgLayout: 'transparent',
    colorBorder: 'rgba(255, 255, 255, 0.18)',
    colorBorderSecondary: 'rgba(255, 255, 255, 0.12)',
    colorText: '#e8ecff',
    colorTextSecondary: '#aab3d6',
  },
  components: {
    Table: {
      colorBgContainer: 'transparent',
      headerBg: 'rgba(255, 255, 255, 0.05)',
      rowHoverBg: 'rgba(255, 255, 255, 0.06)',
    },
  },
}

const LIGHT_THEME: ThemeConfig = { algorithm: antdTheme.defaultAlgorithm }

/** 라이트·다크 전환. html 의 data-theme 속성으로 CSS 변수를, ConfigProvider 로 antd 색을 바꾼다. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(readInitialMode)

  useEffect(() => {
    document.documentElement.dataset.theme = mode
    localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  const toggle = useCallback(() => setMode((m) => (m === 'dark' ? 'light' : 'dark')), [])
  const value = useMemo(() => ({ mode, toggle }), [mode, toggle])

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider locale={koKR} theme={mode === 'dark' ? DARK_THEME : LIGHT_THEME}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}
