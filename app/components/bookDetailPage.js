function page() {
    return `
<div class="col d-flex py-4 px-4" style="overflow-y: scroll; height: 100vh;">
    <div class="flex-grow-1">
        <div id="book-detail-state" class="filter-state mb-2"></div>
        <div id="book-detail-summary" class="book-detail-summary mb-3"></div>

        <div class="toolbar-surface d-flex flex-wrap align-items-center gap-2 mb-3">
            <a class="btn btn-outline-primary" href="/">Voltar</a>
            <a id="book-detail-edit" class="btn btn-outline-primary" href="/">Editar livro</a>
            <a id="book-detail-loan" class="btn btn-primary" href="/">Emprestar exemplar</a>
            <a id="book-detail-history-all" class="btn btn-outline-primary ms-auto" href="#">Histórico do livro</a>
        </div>

        <div class="row g-3">
            <div class="col-lg-6">
                <div class="d-flex align-items-center justify-content-between gap-2 mb-2">
                    <h5 class="fw-bold mb-0">Exemplares</h5>
                    <span id="book-copies-summary" class="list-summary"></span>
                </div>
                <div id="book-copies-list"></div>
            </div>
            <div class="col-lg-6">
                <div class="d-flex align-items-center justify-content-between gap-2 mb-2">
                    <h5 id="copy-history-title" class="fw-bold mb-0">Histórico do livro</h5>
                    <span id="copy-history-summary" class="list-summary"></span>
                </div>
                <div id="copy-history-list"></div>
            </div>
        </div>
    </div>
</div>
`;
}

module.exports = {
    page
};
