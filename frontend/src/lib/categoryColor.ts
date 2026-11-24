import type { Category } from '../types/Call'

/** 유형 색: 채도를 낮춘 값(DESIGN.md 7장). 차트와 말풍선이 같이 쓴다. */
export const CATEGORY_COLOR: Record<Category, string> = {
  질의: '#60a5fa',
  불만: '#fb7185',
  건의: '#fbbf24',
  '교육 내용': '#34d399',
  '기타 문의': '#71717a',
}
