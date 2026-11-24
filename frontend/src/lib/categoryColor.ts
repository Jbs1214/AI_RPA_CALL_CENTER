import type { Category } from '../types/Call'

/** 유형 색: Ridi 팔레트의 500 단(DESIGN.md 7장). 차트와 말풍선이 같이 쓴다. */
export const CATEGORY_COLOR: Record<Category, string> = {
  질의: '#1e9eff',
  불만: '#dc3232',
  건의: '#ffd233',
  '교육 내용': '#39bf74',
  '기타 문의': '#a5a5a5',
}
