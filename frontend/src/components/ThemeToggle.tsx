import { Switch } from 'antd'
import { MoonOutlined, SunOutlined } from '@ant-design/icons'
import { useThemeMode } from '../theme/useThemeMode'

/** 헤더 오른쪽의 라이트·다크 스위치 */
export default function ThemeToggle() {
  const { mode, toggle } = useThemeMode()
  return (
    <Switch
      checked={mode === 'dark'}
      onChange={toggle}
      checkedChildren={<MoonOutlined />}
      unCheckedChildren={<SunOutlined />}
      aria-label="다크 모드 전환"
    />
  )
}
