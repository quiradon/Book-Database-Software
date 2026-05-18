const config = require("../../configs.json");

function page() {
    const turmaOptions = config.turmas
        .map(turma => `<option value="${turma.value}">${turma.nome}</option>`)
        .join("");

    return `
<div class="col d-flex py-4 px-4" style="overflow-y: scroll; height: 100vh;">
    <div class="flex-grow-1">
        <form id="users-filter-form" class="toolbar-surface d-flex flex-wrap align-items-end gap-2 mb-3" method="get" action="/leitores">
            <div class="filter-field">
                <label class="form-label mb-1" for="users-search-input">Busca</label>
                <input id="users-search-input" class="form-control" type="search" name="search" placeholder="Nome, turma ou contato" autocomplete="off" />
            </div>
            <div class="filter-field filter-field-md">
                <label class="form-label mb-1" for="users-class-filter">Turma</label>
                <select id="users-class-filter" class="form-select" name="turma">
                    <option value="">Todas</option>
                    ${turmaOptions}
                </select>
            </div>
            <a id="users-clear-filters" class="btn btn-outline-primary" href="/leitores">Limpar</a>
        </form>
        <div id="users-filter-state" class="filter-state mb-2"></div>
        <div id="users-result-summary" class="list-summary mb-2"></div>
        <div id="users-list-cards" class="col-md-12 col-lg-12 mb-5"></div>
    </div>
</div>
`;
}

module.exports = {
    page
};
