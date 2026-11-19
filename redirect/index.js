// O app mudou de endereço: tudo que chegar aqui vai para o Poupin.
export default {
  fetch(request) {
    const url = new URL(request.url)
    url.hostname = 'poupin.okaiquemota.workers.dev'
    return Response.redirect(url.toString(), 301)
  },
}
