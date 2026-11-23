"""DB 연결. 요청마다 연결을 열고 닫는다(시연 규모에서는 이것으로 충분하고 가장 단순하다)."""
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row

from .config import DATABASE_URL


@contextmanager
def connect():
    """성공하면 커밋, 예외가 나면 되돌린다. 세션 시간대는 한국 시간."""
    conn = psycopg.connect(DATABASE_URL, row_factory=dict_row, options="-c timezone=Asia/Seoul",
                           connect_timeout=5)
    try:
        yield conn
        conn.commit()
    except BaseException:
        conn.rollback()
        raise
    finally:
        conn.close()
