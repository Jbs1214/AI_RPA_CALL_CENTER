import axios, { AxiosError } from 'axios'
import { ApiError, type ApiErrorBody } from '../types/ApiError'

// 서버 주소는 VITE_API_BASE_URL 로만 바꾼다. 코드에 주소를 직접 쓰지 않는다.
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? ''

export const client = axios.create({ baseURL: API_BASE_URL })

client.interceptors.response.use(
  (res) => res,
  (err: AxiosError<ApiErrorBody>) => {
    if (!err.response) {
      return Promise.reject(new ApiError(null, 'NETWORK_ERROR', '서버에 연결할 수 없습니다'))
    }
    const body = err.response.data
    return Promise.reject(
      new ApiError(
        err.response.status,
        body?.error ?? 'UNKNOWN',
        body?.message ?? `요청에 실패했습니다 (${err.response.status})`,
        body,
      ),
    )
  },
)
