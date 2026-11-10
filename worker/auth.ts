// Senhas (PBKDF2 via WebCrypto) e sessões por cookie HttpOnly.

const enc = new TextEncoder()

const toHex = (buf: ArrayBuffer | Uint8Array): string =>
  [...(buf instanceof Uint8Array ? buf : new Uint8Array(buf))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

const fromHex = (hex: string): Uint8Array => {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

// 100.000 é o teto de iterações de PBKDF2 no runtime dos Workers.
const ITERATIONS = 100_000

export const randomHex = (bytes: number): string =>
  toHex(crypto.getRandomValues(new Uint8Array(bytes)))

export const hashPassword = async (password: string, saltHex: string): Promise<string> => {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations: ITERATIONS },
    key,
    256,
  )
  return toHex(bits)
}

export const sha256 = async (text: string): Promise<string> =>
  toHex(await crypto.subtle.digest('SHA-256', enc.encode(text)))

/** Comparação em tempo constante, pra não vazar nada pelo tempo de resposta. */
export const safeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export const SESSION_COOKIE = 'gf_session'
export const SESSION_DAYS = 60
