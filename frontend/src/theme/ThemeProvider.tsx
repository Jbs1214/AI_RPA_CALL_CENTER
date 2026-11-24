import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ConfigProvider, theme as antdTheme, type ThemeConfig } from 'antd'
import koKR from 'antd/locale/ko_KR'
import { ThemeContext, type ThemeMode } from './useThemeMode'

const STORAGE_KEY = 'callcenter-theme'

/** 처음 열 때: 저장된 값이 있으면 그것, 없으면 라이트 */
function readInitialMode(): ThemeMode {
  return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
}

const FONT = "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

/** 두 테마가 같이 쓰는 값: 모서리 8px, 글자 14px, 컨트롤 높이 32px. 그림자는 떠 있는 면에만 쓴다. */
const BASE_TOKEN: ThemeConfig['token'] = {
  borderRadius: 8,
  borderRadiusLG: 8,
  borderRadiusSM: 8,
  fontSize: 14,
  controlHeight: 32,
  fontFamily: FONT,
  boxShadow: 'none',
  boxShadowSecondary: '0 4px 10px rgba(0, 0, 0, 0.2)',
}

/** tokens.css 의 라이트 값과 같게 맞춘 antd 색 */
const LIGHT_THEME: ThemeConfig = {
  algorithm: antdTheme.defaultAlgorithm,
  token: {
    ...BASE_TOKEN,
    colorPrimary: '#2a72e5',
    colorBgBase: '#ffffff',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBgLayout: '#f4f4f4',
    colorBorder: '#c6c6c6',
    colorBorderSecondary: '#e1e1e1',
    colorText: '#262626',
    colorTextSecondary: '#4c4c4c',
    colorTextTertiary: '#767676',
    colorError: '#bb1225',
    colorWarning: '#d34701',
    colorSuccess: '#058765',
  },
  components: {
    Table: { headerBg: '#fafafa', rowHoverBg: '#fafafa' },
  },
}

/** tokens.css 의 다크 값과 같게 맞춘 antd 색 */
const DARK_THEME: ThemeConfig = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    ...BASE_TOKEN,
    colorPrimary: '#368aed',
    colorBgBase: '#1f1f1f',
    colorBgContainer: '#282828',
    colorBgElevated: '#363636',
    colorBgLayout: '#1f1f1f',
    colorBorder: '#606060',
    colorBorderSecondary: '#474747',
    colorText: '#fafafa',
    colorTextSecondary: '#bebebe',
    colorTextTertiary: '#898989',
    colorError: '#fd8283',
    colorWarning: '#f58a56',
    colorSuccess: '#46b993',
  },
  components: {
    Table: { colorBgContainer: 'transparent', headerBg: '#363636', rowHoverBg: '#363636' },
  },
}

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
