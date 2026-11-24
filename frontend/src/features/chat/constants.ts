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

/** 인사·감사 같은 잡담은 서버에 보내지 않고 화면에서 바로 답한다 */
export const GREETING_PATTERN = /^\s*(안녕|하이|헬로|hello|hi)\S{0,8}\s*$/i
export const THANKS_PATTERN = /^\s*(고마워|고맙|감사|땡큐|수고)\S{0,8}\s*$/i
export const GREETING_REPLY = '안녕하세요! 궁금한 통화 기록이 있으면 편하게 물어보세요.'
export const THANKS_REPLY = '도움이 되었다니 기뻐요! 더 궁금한 게 있으면 물어보세요.'

/** 서버가 질문을 이해하지 못했을 때(intent=help) 긴 안내문 대신 보여 주는 문구. 예시는 칩으로 보여 준다. */
export const HELP_REPLY = '질문을 잘 이해하지 못했어요. 아래처럼 물어보세요.'

/** 서버에 함께 보내는 대화 이력 개수 (서버는 최근 6개만 쓴다) */
export const HISTORY_LIMIT = 6

/** 창 크기(px) */
export const PANEL_MIN_WIDTH = 340
export const PANEL_MIN_HEIGHT = 420
export const PANEL_BIG_WIDTH = 640
/** 크게 볼 때 화면 가장자리에 남기는 여백 */
export const PANEL_MARGIN = 48
