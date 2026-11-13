export class ApiError extends Error {
  status: number
  /** Código estável vindo da API (ex.: 'subscription_required'). */
  code?: string
  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export const api = async <T = { ok: true }>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> => {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    })
  } catch {
    throw new ApiError(0, 'Sem conexão. Confira a internet e tente de novo.')
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: string; code?: string }) | null
  if (!res.ok) throw new ApiError(res.status, data?.error ?? 'Algo deu errado. Tente de novo.', data?.code)
  return data as T
}
