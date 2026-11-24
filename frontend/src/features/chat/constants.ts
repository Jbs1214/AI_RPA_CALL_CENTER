// 챗봇 화면에서 쓰는 고정 문구와 수치

/** 빠른 질문(처음 화면의 칩과 입력창 위의 가로 줄) */
export const EXAMPLES = [
  '불만 중 후속조치 필요한 통화 보여줘',
  '이번 주 불만 몇 건이야?',
  '담당자별 통화 건수 알려줘',
  '검토 필요한 건 확인 완료 처리해줘',
]

export const WELCOME =
  '안녕하세요! 콜센터 AI 비서입니다.\n통화 기록을 조회하고 통계를 알려 드려요. 아래 질문을 눌러 보거나 직접 물어보세요.'

/** 서버에 함께 보내는 대화 이력 개수 (서버는 최근 6개만 쓴다) */
export const HISTORY_LIMIT = 6

/** 창 크기(px) */
export const PANEL_MIN_WIDTH = 340
export const PANEL_MIN_HEIGHT = 420
export const PANEL_BIG_WIDTH = 640
/** 크게 볼 때 화면 가장자리에 남기는 여백 */
export const PANEL_MARGIN = 48
