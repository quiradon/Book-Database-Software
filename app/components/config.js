const config = require("../../configs.json");

const tags_exibir = config.tags.join(", ");
const turmas_exibir = config.turmas.map(turma => turma.nome).join(", ");

module.exports = `
<div class="col d-flex py-5 px-4" style="overflow-y: scroll;">
    <div class="flex-grow-1">
        <div class="col-md-12 col-lg-12 d-flex mb-2 border-top border-bottom border-primary p-2">
            <form class="d-inline-flex flex-column flex-grow-1 flex-fill">
                <h3>Configurações Biblioteca</h3>
                <label class="form-label mb-1">Categorias</label>
                <input class="bg-primary bg-opacity-10 form-control" type="text" value="${tags_exibir}" disabled/>
                <label class="form-label mb-1">Turmas</label>
                <input class="bg-primary bg-opacity-10 form-control mb-2" type="text" disabled value="${turmas_exibir}" />
            </form>
        </div>
        <div class="col-md-12 col-lg-12 border-bottom border-primary p-2">
            <h3 class="mb-2">Gerenciar Informações</h3>
            <input id="import-books-file" class="d-none" type="file" accept="application/json,.json" />
            <input id="import-users-file" class="d-none" type="file" accept="application/json,.json" />

            <div class="mb-3">
                <label class="form-label mb-1">Livros</label>
                <div class="d-flex flex-wrap gap-2">
                    <button onclick="selectImportFile('books')" class="btn btn-primary" type="button">Importar JSON</button>
                    <button onclick="window.location.href='/export/books'" class="btn btn-primary" type="button">Exportar JSON</button>
                    <a class="btn btn-outline-primary" href="/etiquetas">Etiquetas QR</a>
                </div>
            </div>

            <div class="mb-3">
                <label class="form-label mb-1">Leitores</label>
                <div class="d-flex flex-wrap gap-2">
                    <button onclick="selectImportFile('users')" class="btn btn-primary" type="button">Importar JSON</button>
                    <button onclick="window.location.href='/export/users'" class="btn btn-primary" type="button">Exportar JSON</button>
                </div>
            </div>

            <div class="mb-2">
                <label class="form-label mb-1">Empréstimos</label>
                <div class="d-flex flex-wrap gap-2">
                    <a class="btn btn-outline-primary" href="/historico">Ver histórico</a>
                    <button onclick="window.location.href='/export/loans-history'" class="btn btn-outline-primary" type="button">Exportar histórico</button>
                </div>
            </div>
        </div>
    </div>
</div>
`;
