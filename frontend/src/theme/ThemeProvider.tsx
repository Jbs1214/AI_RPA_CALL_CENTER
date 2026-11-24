import { useCallback, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react'
import { ConfigProvider, theme as antdTheme, type ThemeConfig } from 'antd'
import koKR from 'antd/locale/ko_KR'
import { ThemeContext, type ThemeMode } from './useThemeMode'

const STORAGE_KEY = 'callcenter-theme'

/** 처음 열 때: 저장된 값이 있으면 그것, 없으면 라이트 */
function readInitialMode(): ThemeMode {
  return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light'
}

const FONT =
  "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, 'Helvetica Neue', 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif"

/** 두 테마가 같이 쓰는 값: 컨트롤 8px, 패널 12px, 글자 14px, 컨트롤 높이 32px. 그림자는 떠 있는 면에만 쓴다. */
const BASE_TOKEN: ThemeConfig['token'] = {
  borderRadius: 8,
  borderRadiusLG: 12,
  borderRadiusSM: 6,
  fontSize: 14,
  controlHeight: 32,
  fontFamily: FONT,
  fontWeightStrong: 700,
  motionDurationFast: '0.2s',
  motionDurationMid: '0.2s',
  boxShadow: 'none',
  boxShadowSecondary: '5px 5px 10px rgba(0, 0, 0, 0.08)',
}

/** tokens.css 의 라이트 값과 같게 맞춘 antd 색 */
const LIGHT_THEME: ThemeConfig = {
  algorithm: antdTheme.defaultAlgorithm,
  token: {
    ...BASE_TOKEN,
    colorPrimary: '#1e9eff',
    colorBgBase: '#ffffff',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBgLayout: '#f5f5f5',
    colorBorder: '#cccccc',
    colorBorderSecondary: '#e6e6e6',
    colorText: '#141414',
    colorTextSecondary: '#787878',
    colorTextTertiary: '#a5a5a5',
    colorError: '#dc3232',
    colorWarning: '#fa6e00',
    colorSuccess: '#39bf74',
    colorInfo: '#1e9eff',
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
    colorPrimary: '#1496e6',
    colorBgBase: '#141414',
    colorBgContainer: '#202020',
    colorBgElevated: '#2c2c2c',
    colorBgLayout: '#141414',
    colorBorder: '#505050',
    colorBorderSecondary: '#373737',
    colorText: '#f5f5f5',
    colorTextSecondary: '#a5a5a5',
    colorTextTertiary: '#787878',
    colorError: '#e35b5b',
    colorWarning: '#fc9e54',
    colorSuccess: '#61cc90',
    colorInfo: '#1496e6',
    boxShadowSecondary: '5px 5px 10px rgba(0, 0, 0, 0.4)',
  },
  components: {
    Table: { colorBgContainer: 'transparent', headerBg: '#2c2c2c', rowHoverBg: '#2c2c2c' },
  },
}

/** 다음 화면 그리기까지 기다린다 */
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

/**
 * 라이트·다크 전환. html 의 data-theme 속성으로 CSS 변수를, ConfigProvider 로 antd 색을 바꾼다.
 * 깜빡임을 막으려고 (1) data-theme 은 그리기 전에 바꾸고(useLayoutEffect), (2) 바뀌는 동안은
 * theme-switching 클래스로 transition 을 잠깐 꺼서 요소마다 색이 따로 바뀌지 않게 한다.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(readInitialMode)

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = mode
  }, [mode])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])

  const toggle = useCallback(async () => {
    const root = document.documentElement
    root.classList.add('theme-switching')
    setMode((m) => (m === 'dark' ? 'light' : 'dark'))
    await nextFrame() // 새 색으로 한 번 그려진 뒤
    await nextFrame() // 한 번 더 기다렸다가 transition 을 되살린다
    root.classList.remove('theme-switching')
  }, [])
  const value = useMemo(() => ({ mode, toggle }), [mode, toggle])

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider locale={koKR} theme={mode === 'dark' ? DARK_THEME : LIGHT_THEME}>
        {children}
      </ConfigProvider>
    </ThemeContext.Provider>
  )
}