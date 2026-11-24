"""UiPath Orchestrator(Automation Cloud) 연동: 토큰 발급과 Job 시작. ORCH_ENABLED=true 일 때만 쓴다.
실제 환경에서는 샘플 1건으로 응답을 대조해야 한다(외부 앱 Client ID·Secret, Release Key 도착 후)."""
import json
import logging
import time
import urllib.error
import urllib.parse
import urllib.request

from .. import config

log = logging.getLogger("orchestrator")
_token = {"value": None, "exp": 0.0}


class OrchestratorError(Exception):
    pass


def _post(url: str, data: bytes, headers: dict, timeout: float = 10) -> dict:
    # 기본 User-Agent(Python-urllib)는 UiPath 앞단에서 403(1010)으로 막힌다
    headers = {**headers, "User-Agent": "callcenter-backend/1.0"}
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def get_token(force: bool = False) -> str:
    if not force and _token["value"] and time.time() < _token["exp"] - 60:
        return _token["value"]
    if not (config.ORCH_IDENTITY_URL and config.ORCH_CLIENT_ID and config.ORCH_CLIENT_SECRET):
        raise OrchestratorError("Orchestrator 인증 설정이 비어 있습니다.")
    form = urllib.parse.urlencode({
        "grant_type": "client_credentials", "client_id": config.ORCH_CLIENT_ID,
        "client_secret": config.ORCH_CLIENT_SECRET, "scope": config.ORCH_SCOPE,
    }).encode("utf-8")
    try:
        d = _post(config.ORCH_IDENTITY_URL + "/connect/token", form,
                  {"Content-Type": "application/x-www-form-urlencoded"})
        _token["value"] = d["access_token"]
        _token["exp"] = time.time() + float(d.get("expires_in", 3600))
        return _token["value"]
    except Exception as e:
        raise OrchestratorError("토큰 발급 실패: " + type(e).__name__)


def start_job(call_id: str) -> str:
    """Job 을 시작하고 Job Key 를 돌려준다. 실패하면 OrchestratorError."""
    if not (config.ORCH_BASE_URL and config.ORCH_RELEASE_KEY and config.ORCH_FOLDER_ID and config.PUBLIC_BASE_URL):
        raise OrchestratorError("Orchestrator 설정(주소·Release Key·폴더·PUBLIC_BASE_URL)이 비어 있습니다.")
    args = json.dumps({
        "in_call_id": call_id,
        "in_audio_url": f"{config.PUBLIC_BASE_URL}/api/calls/{call_id}/audio",
        "in_result_url": f"{config.PUBLIC_BASE_URL}/api/calls/{call_id}/result",
    })
    body = json.dumps({"startInfo": {
        "ReleaseKey": config.ORCH_RELEASE_KEY, "Strategy": config.ORCH_START_STRATEGY,
        "JobsCount": 1, "InputArguments": args,
    }}).encode("utf-8")
    url = config.ORCH_BASE_URL + "/odata/Jobs/UiPath.Server.Configuration.OData.StartJobs"
    for attempt in (1, 2):               # 401 이면 토큰을 새로 받아 1회 재시도
        headers = {"Content-Type": "application/json", "Authorization": "Bearer " + get_token(force=attempt == 2),
                   "X-UIPATH-OrganizationUnitId": config.ORCH_FOLDER_ID}
        try:
            d = _post(url, body, headers)
            return str(d["value"][0]["Key"])
        except urllib.error.HTTPError as e:
            if e.code == 401 and attempt == 1:
                continue
            log.warning("Job 시작 실패: HTTP %s", e.code)
            raise OrchestratorError(f"HTTP {e.code}")
        except Exception as e:
            log.warning("Job 시작 실패: %s", type(e).__name__)
            raise OrchestratorError(type(e).__name__)
    raise OrchestratorError("Job 시작 실패")
