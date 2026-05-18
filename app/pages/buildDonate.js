const {GenPage} = require("../buildStructure.js");

async function page() {
  const baseUrl = process.env.KRAKEN_BOOK_BASE_URL || 'http://localhost:5000'
  let data = await fetch(`${baseUrl}/api/status`)
    .then(response => {return response.json()})
    data = data[0]
    let version = "2.0.1"
    return `
    <div class="col d-flex py-5 px-4" style="overflow-y: scroll;">
    <div class="d-flex flex-column flex-grow-1 flex-shrink-1 flex-fill align-items-center align-content-center">
        <div class="row g-0 d-flex mb-5">
            <div class="col-md-12 col-lg-12 col-xl-11 col-xxl-12 text-center mx-auto">
                <h2>Apoie o Projeto</h2>
                <p class="lead w-lg-50">Aureon BookDB é um software livre, ou seja é gratuito e não pode ser comercializado de forma alguma, os desenvolvedores mantem o projeto totalmente através de doações, caso deseje apoiar o projeto faça uma doação através de nosso pix: <strong>pix@arkanus.app</strong></p>
            </div>
        </div>
        <div class="row gy-2 row-cols-2 row-cols-md-2 row-cols-xl-3 d-inline-flex flex-row justify-content-center align-content-center">
            <div class="col-auto col-md-12 col-lg-11 col-xl-6 col-xxl-7 d-flex">
                <div class="card" style="width: 100%;">
                    <div class="card-body p-4" style="width: 100%;height: 100%;">
                        <div class="bs-icon-md bs-icon-rounded bs-icon-primary d-flex justify-content-center align-items-center d-inline-block mb-3 bs-icon"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="1em" height="1em" fill="currentColor" style="font-size: 21px;">
                                <path d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm0-384c13.3 0 24 10.7 24 24V264c0 13.3-10.7 24-24 24s-24-10.7-24-24V152c0-13.3 10.7-24 24-24zM224 352a32 32 0 1 1 64 0 32 32 0 1 1 -64 0z"></path>
                            </svg></div>
                        <h4 class="card-title">Updates A Alcançar</h4>
                        <p>Com doações o suficiente conseguiremos investir tempo e dinheiro para proporcionar as seguintes melhorias.</p>
                        <ul>
                            <li>Gerador de etiquetas com QR code</li>
                            <li>Histórico de emprestimos</li>
                            <li>Método de importar e exportar dados</li>
                            <li>API de livros, (pesquisa pelo ISBN)</li>
                            <li>Aplicativo para Celular</li>
                            <li>Aplicativo 100% Online</li>
                        </ul>
                    </div>
                </div>
            </div>
            <div class="col-md-10 col-lg-8 col-xl-5 col-xxl-4 d-flex justify-content-xl-center align-items-xl-center"><img class="rounded img-fluid" src="/assets/img/pix.png" width="400" height="400" style="border: 4px solid var(--bs-border-color);" /></div>
        </div>
    </div>
</div>
`
}

async function DonatePage () {
    return GenPage(5,await page(),`
    `)

}

module.exports = {
    DonatePage
}
