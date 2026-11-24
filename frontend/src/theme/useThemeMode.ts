import { createContext, useContext } from 'react'

export type ThemeMode = 'light' | 'dark'

export interface ThemeContextValue {
  mode: ThemeMode
  toggle: () => void
}

export const ThemeContext = createContext<ThemeContextValue>({ mode: 'light', toggle: () => {} })

/** 지금 모드(light/dark)와 바꾸는 함수 */
export function useThemeMode() {
  return useContext(ThemeContext)
}
