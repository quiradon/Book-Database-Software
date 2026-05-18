function page() {
    return `
<div class="col d-flex py-4 px-4" style="overflow-y: scroll; height: 100vh;">
    <div class="flex-grow-1">
        <form id="history-filter-form" class="toolbar-surface d-flex flex-wrap align-items-end gap-2 mb-3" method="get" action="/historico">
            <div class="filter-field">
                <label class="form-label mb-1" for="history-search-input">Busca</label>
                <input id="history-search-input" class="form-control" type="search" name="search" placeholder="Livro, leitor ou turma" autocomplete="off" />
            </div>
            <div class="filter-field filter-field-sm">
                <label class="form-label mb-1" for="history-status-filter">Status</label>
                <select id="history-status-filter" class="form-select" name="status">
                    <option value="">Todos</option>
                    <option value="EMPRESTADO">Em aberto</option>
                    <option value="DEVOLVIDO">Devolvidos</option>
                </select>
            </div>
            <a id="history-clear-filters" class="btn btn-outline-primary" href="/historico">Limpar</a>
            <a class="btn btn-outline-primary ms-auto" href="/export/loans-history">Exportar JSON</a>
        </form>
        <div id="history-filter-state" class="filter-state mb-2"></div>
        <div id="history-result-summary" class="list-summary mb-2"></div>
        <div id="history-list-cards" class="col-md-12 col-lg-12 mb-5"></div>
    </div>
</div>
`;
}

module.exports = {
    page
};
