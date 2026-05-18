const config = require("../../configs.json");

function options(values) {
    return values
        .map(value => `<option value="${value}">${value}</option>`)
        .join("");
}

function page() {
    return `
<div class="col d-flex py-4 px-4" style="overflow-y: scroll; height: 100vh;">
    <div class="flex-grow-1">
        <form id="books-filter-form" class="toolbar-surface d-flex flex-wrap align-items-end gap-2 mb-3" method="get" action="/">
            <div class="filter-field">
                <label class="form-label mb-1" for="books-search-input">Busca</label>
                <input id="books-search-input" class="form-control" type="search" name="search" placeholder="Título, autor, editora, ISBN ou tag" autocomplete="off" />
            </div>
            <div class="filter-field filter-field-sm">
                <label class="form-label mb-1" for="books-status-filter">Status</label>
                <select id="books-status-filter" class="form-select" name="status">
                    <option value="">Todos</option>
                    <option value="0">Disponíveis</option>
                    <option value="1">Emprestados</option>
                    <option value="2">Atrasados</option>
                </select>
            </div>
            <div class="filter-field filter-field-md">
                <label class="form-label mb-1" for="books-tag-filter">Tag</label>
                <select id="books-tag-filter" class="form-select" name="tag">
                    <option value="">Todas</option>
                    ${options(config.tags)}
                </select>
            </div>
            <a id="books-clear-filters" class="btn btn-outline-primary" href="/">Limpar</a>
            <a id="books-qr-labels" class="btn btn-outline-primary" href="/etiquetas">Etiquetas QR</a>
        </form>
        <div id="books-filter-state" class="filter-state mb-2"></div>
        <div id="books-result-summary" class="list-summary mb-2"></div>
        <div id="books-list-cards" class="col-md-12 col-lg-12 mb-5"></div>
    </div>
</div>
`;
}

module.exports = {
    page
};
