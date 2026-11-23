"""공통 오류. 응답 형식은 {"error": 코드, "message": 한글 설명} (+ 추가 항목)."""


class ApiError(Exception):
    def __init__(self, status: int, error: str, message: str, **extra):
        super().__init__(message)
        self.status = status
        self.error = error
        self.message = message
        self.extra = extra

    def body(self) -> dict:
        d = {"error": self.error, "message": self.message}
        d.update(self.extra)
        return d


def validation_error(message: str) -> ApiError:
    return ApiError(422, "VALIDATION_ERROR", message)
