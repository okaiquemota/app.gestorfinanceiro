// Tema claro/escuro.
//
// O app respeita a escolha guardada (gf-theme) ou, sem escolha, o tema do
// sistema — a mesma regra de public/theme.js, que pinta antes do React.
// O site público (abertura, login, termos) é sempre claro.

export type Theme = 'light' | 'dark'

/** O tema que a pessoa quer no app. */
export const preferredTheme = (): Theme => {
  try {
    const t = localStorage.getItem('gf-theme')
    if (t === 'light' || t === 'dark') return t
  } catch {
    // sem localStorage (aba privada): segue o sistema
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Aplica um tema na página, sem guardar como escolha. */
export const paintTheme = (t: Theme) => {
  document.documentElement.dataset.theme = t
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#0b0c0f' : '#f2f3f6')
}
