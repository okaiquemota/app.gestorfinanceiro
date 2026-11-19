// Aplica o tema antes de pintar, pra não piscar claro/escuro.
// Fica num arquivo (e não inline no HTML) para a política de segurança (CSP)
// poder proibir qualquer script inline.
try {
  var t = localStorage.getItem('gf-theme')
  if (t !== 'light' && t !== 'dark') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  document.documentElement.dataset.theme = t
} catch (e) {}
