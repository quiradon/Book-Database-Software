function page() {
    return `
<div class="col d-flex py-4 px-4" style="overflow-y: scroll; height: 100vh;">
    <div class="flex-grow-1">
        <form id="labels-filter-form" class="toolbar-surface d-flex flex-wrap align-items-end gap-2 mb-3" method="get" action="/etiquetas">
            <div class="filter-field">
                <label class="form-label mb-1" for="labels-search-input">Busca</label>
                <input id="labels-search-input" class="form-control" type="search" name="search" placeholder="Título, autor, ISBN ou tag" autocomplete="off" />
            </div>
            <button id="labels-generate-selected" class="btn btn-primary ms-auto" type="button">Gerar selecionadas</button>
            <button id="labels-select-visible" class="btn btn-outline-primary" type="button">Selecionar visíveis</button>
            <button id="labels-clear-selection" class="btn btn-outline-primary" type="button">Limpar seleção</button>
        </form>
        <div id="labels-state" class="filter-state mb-2"></div>
        <div id="labels-result-summary" class="list-summary mb-2"></div>
        <div id="labels-list-cards" class="col-md-12 col-lg-12 mb-5"></div>
    </div>
</div>
`;
}

module.exports = {
    page
};
