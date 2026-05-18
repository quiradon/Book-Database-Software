let SelectedBook = null;
let SelectedCopy = null;
let pendingBookDeleteId = null;

const BOOKS_PAGE_SIZE = 60;
const statusBadge = [
    '<span class="badge bg-success">Prateleira</span>',
    '<span class="badge bg-warning">Emprestado</span>',
    '<span class="badge bg-danger">Atrasado</span>'
];

const booksList = document.getElementById('books-list-cards');
const booksSummary = document.getElementById('books-result-summary');
const pageParams = new URLSearchParams(window.location.search);
const initialDelayedMode = pageParams.has('atrasos');
let searchTerm = pageParams.get('search') || '';
let statusFilter = initialDelayedMode ? '2' : pageParams.get('status') || '';
let tagFilter = pageParams.get('tag') || '';
let returnToDelayedMode = initialDelayedMode;

let booksOffset = 0;
let booksHasMore = true;
let booksLoading = false;
let booksPendingReload = false;

const loadMoreBooksButton = document.createElement('button');
loadMoreBooksButton.className = 'btn btn-outline-primary m-2';
loadMoreBooksButton.type = 'button';
loadMoreBooksButton.textContent = 'Carregar mais';
loadMoreBooksButton.addEventListener('click', () => loadBooks(false));
booksList.after(loadMoreBooksButton);

const booksSearchInput = document.getElementById('books-search-input');
const booksStatusFilter = document.getElementById('books-status-filter');
const booksTagFilter = document.getElementById('books-tag-filter');
const booksFilterForm = document.getElementById('books-filter-form');
const booksFilterState = document.getElementById('books-filter-state');

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function debounce(callback, delay) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => callback(...args), delay);
    };
}

function isBookSearchActive() {
    return searchTerm.trim().length > 0;
}

function isDelayedView() {
    return !isBookSearchActive() && statusFilter === '2';
}

function bookStatusLabel(value) {
    if (value === '0') {
        return 'Disponíveis';
    }
    if (value === '1') {
        return 'Emprestados';
    }
    if (value === '2') {
        return 'Atrasados';
    }
    return 'Todos';
}

function syncBookFilterControls() {
    const searchActive = isBookSearchActive();

    if (booksSearchInput && booksSearchInput.value !== searchTerm) {
        booksSearchInput.value = searchTerm;
    }
    if (booksStatusFilter) {
        booksStatusFilter.value = statusFilter;
        booksStatusFilter.disabled = searchActive;
        booksStatusFilter.closest('.filter-field')?.classList.toggle('filter-disabled', searchActive);
    }
    if (booksTagFilter) {
        booksTagFilter.value = tagFilter;
        booksTagFilter.disabled = searchActive;
        booksTagFilter.closest('.filter-field')?.classList.toggle('filter-disabled', searchActive);
    }

    if (!booksFilterState) {
        return;
    }

    booksFilterState.classList.toggle('filter-state-active', searchActive || Boolean(statusFilter) || Boolean(tagFilter));
    if (searchActive) {
        booksFilterState.textContent = `Busca global ativa: "${searchTerm.trim()}". Status e tag estão sendo ignorados.`;
        return;
    }

    const activeFilters = [];
    if (statusFilter) {
        activeFilters.push(`Status: ${bookStatusLabel(statusFilter)}`);
    }
    if (tagFilter) {
        activeFilters.push(`Tag: ${tagFilter}`);
    }
    booksFilterState.textContent = activeFilters.length > 0 ? `Filtros ativos: ${activeFilters.join(' | ')}` : 'Sem filtros ativos.';
}

function updateBooksLocation() {
    const params = new URLSearchParams();

    if (isBookSearchActive()) {
        params.set('search', searchTerm.trim());
    } else {
        if (returnToDelayedMode && statusFilter === '2') {
            params.set('atrasos', 'search');
        } else if (statusFilter) {
            params.set('status', statusFilter);
        }
        if (tagFilter) {
            params.set('tag', tagFilter);
        }
    }

    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
}

function resetBooksListState() {
    booksOffset = 0;
    booksHasMore = true;
    booksList.innerHTML = '';
    if (booksSummary) {
        booksSummary.textContent = 'Carregando resultados...';
    }
}

function applyBookFilters() {
    resetBooksListState();
    syncBookFilterControls();
    updateReportLinks();
    updateBooksLocation();
    loadBooks(true);
}

const scheduleBookSearchApply = debounce(() => {
    applyBookFilters();
}, 250);

if (booksFilterForm) {
    booksFilterForm.addEventListener('submit', (event) => {
        event.preventDefault();
        searchTerm = booksSearchInput?.value.trim() || '';
        statusFilter = booksStatusFilter?.value || '';
        tagFilter = booksTagFilter?.value || '';
        applyBookFilters();
    });
}

if (booksSearchInput) {
    booksSearchInput.value = searchTerm;
    booksSearchInput.addEventListener('input', () => {
        searchTerm = booksSearchInput.value.trim();
        syncBookFilterControls();
        scheduleBookSearchApply();
    });
}

if (booksStatusFilter) {
    booksStatusFilter.addEventListener('change', () => {
        statusFilter = booksStatusFilter.value;
        returnToDelayedMode = false;
        applyBookFilters();
    });
}

if (booksTagFilter) {
    booksTagFilter.addEventListener('change', () => {
        tagFilter = booksTagFilter.value;
        applyBookFilters();
    });
}

function buildActions(id) {
    return `
    <div class="dropdown mt-1"><button class="btn btn-primary dropdown-toggle" aria-expanded="false" data-bs-toggle="dropdown" type="button"><svg class="mb-1" xmlns="http://www.w3.org/2000/svg" viewBox="-32 0 512 512" width="1em" height="1em" fill="currentColor" style="margin-right: 6px;font-size: 16px;">
                <path d="M201 10.3c14.3-7.8 31.6-7.8 46 0L422.3 106c5.1 2.8 8.3 8.2 8.3 14s-3.2 11.2-8.3 14L231.7 238c-4.8 2.6-10.5 2.6-15.3 0L25.7 134c-5.1-2.8-8.3-8.2-8.3-14s3.2-11.2 8.3-14L201 10.3zM23.7 170l176 96c5.1 2.8 8.3 8.2 8.3 14V496c0 5.6-3 10.9-7.8 13.8s-10.9 3-15.8 .3L25 423.1C9.6 414.7 0 398.6 0 381V184c0-5.6 3-10.9 7.8-13.8s10.9-3 15.8-.3zm400.7 0c5-2.7 11-2.6 15.8 .3s7.8 8.1 7.8 13.8V381c0 17.6-9.6 33.7-25 42.1L263.7 510c-5 2.7-11 2.6-15.8-.3s-7.8-8.1-7.8-13.8V280c0-5.9 3.2-11.2 8.3-14l176-96z"></path>
            </svg>Ações</button>
        <div class="dropdown-menu"><a class="dropdown-item" href="/?modal=${id}">Editar Livro</a><a class="dropdown-item" href="/historico?bookId=${id}">Histórico</a><a class="dropdown-item" href="/?emprestimo=${id}">Emprestimo</a><a class="dropdown-item" href="javascript:void(0)" onclick="removeBook(${id})">Deletar</a></div>
    </div>
    `;
}

function normalizeTimestamp(value) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) {
        return null;
    }
    return Math.abs(numberValue) < 10000000000 ? numberValue * 1000 : numberValue;
}

function formatDate(value) {
    const timestamp = normalizeTimestamp(value);
    if (!timestamp) {
        return '-';
    }
    return new Date(timestamp).toLocaleDateString();
}

function daysOverdue(value) {
    const timestamp = normalizeTimestamp(value);
    if (!timestamp) {
        return 0;
    }
    return Math.max(0, Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24)));
}

function buildCard(id, title, author, editor, isbn, status, tags, totalCopies, availableCopies, loanedCopies) {
    const tagsHtml = String(tags ?? '')
        .split(',')
        .filter(Boolean)
        .map(tag => `<span class="badge bg-primary me-1">${escapeHtml(tag)}</span>`)
        .join('');
    const safeStatus = statusBadge[Number(status)] ?? statusBadge[0];

    return `
    <div class="card shadow-sm m-2">
    <div class="card-body">
        <div class="container-fluid">
            <div class="row">
                <div class="col-md-6">
                    <h5 class="fw-bold"><a class="link-body-emphasis text-decoration-none" href="/historico?bookId=${id}">${escapeHtml(title)}</a></h5>
                    <p class="mb-1">Informações: Author: ${escapeHtml(author)} | Editora: ${escapeHtml(editor)} | ISBN: ${escapeHtml(isbn)}</p>
                    <p class="mb-1">Status: ${safeStatus}</p>
                    <p class="mb-1">Exemplares: ${totalCopies || 1} | Disponíveis: ${availableCopies ?? 0} | Emprestados: ${loanedCopies ?? 0}</p>${tagsHtml}
                </div>
                <div class="col d-sm-flex d-md-flex d-lg-flex d-xl-flex justify-content-sm-end align-items-sm-center justify-content-md-end align-items-md-center justify-content-lg-end align-items-lg-center justify-content-xl-end align-items-xl-center">
                    ${buildActions(id)}
                </div>
            </div>
        </div>
    </div>
</div>
`;
}

function buildDelayedCard(book) {
    const atraso = daysOverdue(book.data_prazo);
    return `
    <div class="card shadow-sm m-2 book-card-overdue">
        <div class="card-body">
            <div class="container-fluid">
                <div class="row align-items-center g-3">
                    <div class="col-md-7">
                        <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
                            <h5 class="fw-bold mb-0"><a class="link-body-emphasis text-decoration-none" href="/historico?bookId=${book.id}">${escapeHtml(book.titulo)}</a></h5>
                            <span class="badge bg-danger">Atrasado</span>
                        </div>
                        <p class="mb-1">Leitor: <strong>${escapeHtml(book.leitor_nome || '-')}</strong> | Turma: ${escapeHtml(book.leitor_turma || '-')}</p>
                        <p class="mb-1">Autor: ${escapeHtml(book.autor)} | Editora: ${escapeHtml(book.editora)} | ISBN: ${escapeHtml(book.isbn)}</p>
                        <p class="mb-0">Exemplar ${escapeHtml(book.exemplar_codigo || '-')} | Emprestado em ${formatDate(book.data_emprestimo)} | Prazo ${formatDate(book.data_prazo)}</p>
                    </div>
                    <div class="col-md-3 late-metric">
                        <div class="text-danger fw-bold fs-5">${atraso} dia(s)</div>
                        <div class="text-secondary">em atraso</div>
                    </div>
                    <div class="col-md-2 d-flex justify-content-md-end">
                        ${buildActions(book.id)}
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;
}

function buildBooksUrl(reset) {
    const params = new URLSearchParams();
    params.set('limit', String(BOOKS_PAGE_SIZE));
    params.set('offset', String(reset ? 0 : booksOffset));

    if (isBookSearchActive()) {
        params.set('search', searchTerm.trim());
    } else {
        if (statusFilter) {
            params.set('status', statusFilter);
        }
        if (tagFilter) {
            params.set('tag', tagFilter);
        }
    }

    return `/api/books?${params.toString()}`;
}

function currentReportParams(forceOverdue = false) {
    const params = new URLSearchParams();
    if (forceOverdue) {
        return '';
    }

    if (isBookSearchActive()) {
        params.set('search', searchTerm.trim());
        return params.toString();
    }

    if (statusFilter) {
        params.set('status', statusFilter);
    }
    if (tagFilter) {
        params.set('tag', tagFilter);
    }
    return params.toString();
}

function updateReportLinks() {
    const booksReport = document.getElementById('books-pdf-report');
    const overdueReport = document.getElementById('books-overdue-pdf-report');
    const qrLabels = document.getElementById('books-qr-labels');
    const booksParams = currentReportParams(false);
    const overdueParams = currentReportParams(true);

    if (booksReport) {
        booksReport.href = `/reports/books.pdf${booksParams ? `?${booksParams}` : ''}`;
    }
    if (overdueReport) {
        overdueReport.href = `/reports/overdue.pdf${overdueParams ? `?${overdueParams}` : ''}`;
    }
    if (qrLabels) {
        qrLabels.href = `/etiquetas${booksParams ? `?${booksParams}` : ''}`;
    }
}

function updateLoadMoreBooksButton() {
    loadMoreBooksButton.classList.toggle('d-none', !booksHasMore);
    loadMoreBooksButton.disabled = booksLoading;
}

function renderBooks(books, reset) {
    if (reset) {
        booksList.innerHTML = '';
    }

    if (books.length === 0 && booksOffset === 0) {
        alertError(isDelayedView() ? 'Nenhum livro atrasado!' : 'Não consegui achar nenhum livro em sua pesquisa!');
        return;
    }

    const html = books
        .map(book => isDelayedView()
            ? buildDelayedCard(book)
            : buildCard(
                book.id,
                book.titulo,
                book.autor,
                book.editora,
                book.isbn,
                book.status,
                book.tags,
                book.total_exemplares,
                book.exemplares_disponiveis,
                book.exemplares_emprestados
            ))
        .join('');
    booksList.insertAdjacentHTML('beforeend', html);
}

function loadBooks(reset = false) {
    if (booksLoading) {
        booksPendingReload = booksPendingReload || reset;
        return Promise.resolve();
    }
    if (!reset && !booksHasMore) {
        return Promise.resolve();
    }

    booksLoading = true;
    updateLoadMoreBooksButton();

    return fetch(buildBooksUrl(reset))
        .then(response => {
            if (!response.ok) {
                throw new Error('Erro ao carregar livros');
            }

            booksHasMore = response.headers.get('X-Has-More') === '1';
            return response.json();
        })
        .then(data => {
            if (reset) {
                booksOffset = 0;
            }

            renderBooks(data, reset);
            booksOffset += data.length;
            if (booksSummary) {
                booksSummary.textContent = `${booksOffset} livro(s) carregado(s)${booksHasMore ? ' - há mais resultados' : ''}`;
            }
        })
        .catch(error => {
            console.error(error);
            alertError('Erro ao carregar livros!');
        })
        .finally(() => {
            booksLoading = false;
            updateLoadMoreBooksButton();
            if (booksPendingReload) {
                booksPendingReload = false;
                loadBooks(true);
            }
        });
}

syncBookFilterControls();
updateReportLinks();
updateBooksLocation();
loadBooks(true);

const modal = document.getElementById('Modal_Livro');
let loanReadersLoaded = false;

function loadLoanReaders() {
    if (loanReadersLoaded) {
        return Promise.resolve();
    }

    const select = document.getElementById('seletor_leitor_emprestimo');
    if (!select) {
        return Promise.resolve();
    }

    return fetch('/api/users')
        .then(response => response.json())
        .then(users => {
            select.innerHTML = users
                .map(user => `<option value="${user.id}">${escapeHtml(user.turma)} | ${escapeHtml(user.nome)}</option>`)
                .join('');
            $('.selectpicker').selectpicker('refresh');
            loanReadersLoaded = true;
        });
}

function loadAvailableCopies(bookId) {
    const select = document.getElementById('seletor_exemplar_emprestimo');
    if (!select) {
        return Promise.resolve();
    }

    select.innerHTML = '<option value="">Carregando exemplares...</option>';

    return fetch(`/api/books/${bookId}/copies`)
        .then(response => response.json())
        .then(copies => {
            const availableCopies = copies.filter(copy => !copy.emprestimo_id);
            if (availableCopies.length === 0) {
                select.innerHTML = '<option value="">Nenhum exemplar disponível</option>';
                return;
            }

            select.innerHTML = availableCopies
                .map(copy => `<option value="${copy.id}">${escapeHtml(copy.codigo)} | Exemplar ${copy.numero}</option>`)
                .join('');
        });
}

function renderBookCopySummary(copies) {
    const summary = document.getElementById('book-copy-summary');
    if (!summary) {
        return;
    }

    if (!copies || copies.length === 0) {
        summary.textContent = 'Os IDs dos exemplares serão criados ao salvar.';
        return;
    }

    summary.innerHTML = `
        <div class="copy-chip-list">
            ${copies.map(copy => {
                const status = copy.emprestimo_id ? 'Emprestado' : 'Disponível';
                const statusClass = copy.emprestimo_id ? 'text-warning' : 'text-success';
                return `<span class="copy-chip"><strong>${escapeHtml(copy.codigo)}</strong><span class="${statusClass}">${status}</span></span>`;
            }).join('')}
        </div>`;
}

function loadBookCopySummary(bookId) {
    return fetch(`/api/books/${bookId}/copies`)
        .then(response => response.json())
        .then(copies => renderBookCopySummary(copies));
}

if (pageParams.get('modal')) {
    const valor = pageParams.get('modal');
    if (valor == 'new') {
        setModalType('new');
        const myModal = new bootstrap.Modal(modal);
        myModal.show();
    } else {
        fetch(`/api/books/${valor}`)
            .then(response => {
                if (response.status == 404) {
                    alertError('Livro não encontrado!');
                    return;
                }
                return response.json();
            })
            .then(data => {
                SelectedBook = parseInt(valor);
                document.getElementById('book-name').value = data.titulo;
                document.getElementById('book-autor').value = data.autor;
                document.getElementById('book-editora').value = data.editora;
                document.getElementById('book-tags').value = data.tags;
                document.getElementById('book-isbn').value = data.isbn;
                document.getElementById('book-copy-total').value = data.total_exemplares || 1;
                loadBookCopySummary(SelectedBook);
                $('#book-tags').selectpicker('val', data.tags.split(','));
                setModalType('edit');
                const myModal = new bootstrap.Modal(modal);
                myModal.show();
            });
    }
}

const ModalEmprestimos = document.getElementById('Modal_Emprestimo');
const modalDevolva = document.getElementById('Modal_Devolucao');

if (pageParams.get('emprestimo')) {
    const alvo = pageParams.get('emprestimo');
    fetch(`/api/books/${alvo}`)
        .then(response => {
            if (response.status == 404) {
                alertError('Livro não encontrado!');
                return;
            }
            return response.json();
        })
        .then(data => {
            SelectedBook = parseInt(alvo);
            SelectedCopy = data.exemplar_id ? parseInt(data.exemplar_id) : null;
            const status = data.status;
            if (status == 0) {
                const editBook = document.getElementById('nome_do_livro_titulo_emprestimo');
                editBook.textContent = data.titulo;
                Promise.all([loadLoanReaders(), loadAvailableCopies(SelectedBook)]).then(() => {
                    const modalEmp = new bootstrap.Modal(ModalEmprestimos);
                    modalEmp.show();
                });
            } else {
                const tituloModal = document.getElementById('titulo-modal');
                const nomeLeitor = document.getElementById('nome_placeholder-devolucao_leitor');
                tituloModal.textContent = `${data.titulo} (${data.exemplar_codigo || 'exemplar sem código'})`;
                nomeLeitor.textContent = `${data.leitor_nome} | ${data.leitor_turma}`;

                const dataInicial = document.getElementById('nome_placeholder-devolucao_data_inicial');
                const dataFinal = document.getElementById('nome_placeholder-devolucao_data_final');
                const dataEmprestimo = new Date(normalizeTimestamp(data.data_emprestimo));
                const dataDevolucao = new Date(normalizeTimestamp(data.data_prazo));

                if (dataDevolucao < new Date()) {
                    dataFinal.classList.add('text-danger');
                } else {
                    dataFinal.classList.add('text-success');
                }

                const relativo = dataDevolucao - new Date();
                dataInicial.textContent = dataEmprestimo.toLocaleDateString();
                dataFinal.textContent = `${dataDevolucao.toLocaleDateString()} | ${Math.floor(relativo / (1000 * 60 * 60 * 24))} dias restantes`;

                const modalDev = new bootstrap.Modal(modalDevolva);
                modalDev.show();
            }
        });
}

function getModalData() {
    const titulo_book = document.getElementById('book-name').value ?? '';
    const autor = document.getElementById('book-autor').value ?? '';
    const editora = document.getElementById('book-editora').value ?? '';
    const bookTagsSelect = document.getElementById('book-tags');
    const selectedValues = [];

    for (let i = 0; i < bookTagsSelect.options.length; i++) {
        if (bookTagsSelect.options[i].selected) {
            selectedValues.push(bookTagsSelect.options[i].value);
        }
    }

    const tags = selectedValues.join(',');
    const isbn = (document.getElementById('book-isbn').value ?? '').trim();
    const copyTotal = Number(document.getElementById('book-copy-total').value ?? 1);

    if (titulo_book === '') {
        alertError('O campo título é obrigatório!');
        return;
    }
    if (autor === '') {
        alertError('O campo autor é obrigatório!');
        return;
    }
    if (editora === '') {
        alertError('O campo editora é obrigatório!');
        return;
    }
    if (tags === '') {
        alertError('O campo tags é obrigatório!');
        return;
    }
    if (!Number.isInteger(copyTotal) || copyTotal < 1 || copyTotal > 999) {
        alertError('A quantidade de exemplares precisa ser entre 1 e 999.');
        return;
    }

    return {
        titulo: titulo_book,
        autor,
        editora,
        tags,
        isbn,
        quantidade_exemplares: copyTotal
    };
}

function lookupIsbn() {
    const isbnInput = document.getElementById('book-isbn');
    const isbn = isbnInput?.value.trim() || '';

    if (!isbn) {
        alertError('Informe o ISBN antes de buscar.');
        return;
    }

    const button = document.getElementById('book-isbn-lookup');
    if (button) {
        button.disabled = true;
        button.textContent = 'Buscando...';
    }

    fetch(`/api/books/isbn/${encodeURIComponent(isbn)}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('ISBN não encontrado');
            }
            return response.json();
        })
        .then(book => {
            document.getElementById('book-name').value = book.titulo || '';
            document.getElementById('book-autor').value = book.autor || '';
            document.getElementById('book-editora').value = book.editora || '';
            isbnInput.value = book.isbn || isbn;
            alertSucess('Dados do ISBN preenchidos.');
        })
        .catch(error => {
            console.error(error);
            alertError('Não foi possível encontrar esse ISBN.');
        })
        .finally(() => {
            if (button) {
                button.disabled = false;
                button.textContent = 'Buscar ISBN';
            }
        });
}

window.lookupIsbn = lookupIsbn;
document.getElementById('book-isbn-lookup')?.addEventListener('click', lookupIsbn);

function setModalType(type) {
    if (type == 'new') {
        document.getElementById('book-copy-total').value = 1;
        renderBookCopySummary([]);
        document.getElementById('modal_btn_edit_book').classList.remove('d-flex');
        document.getElementById('modal_btn_edit_book').classList.add('d-none');
        document.getElementById('modal_btn_save_book').classList.remove('d-flex');
    } else {
        document.getElementById('modal_btn_save_book').classList.remove('d-flex');
        document.getElementById('modal_btn_save_book').classList.add('d-none');
        document.getElementById('modal_btn_edit_book').classList.remove('d-none');
        document.getElementById('modal_btn_edit_book').classList.add('d-flex');
    }
}

function addBook() {
    const data = getModalData();
    if (data == undefined) {
        return;
    }

    fetch('/api/book/add', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    }).then(res => {
        if (!res.ok) {
            throw new Error('Erro ao adicionar livro');
        }

        $('#Modal_Livro').modal('hide');
        reloadBooks();
        alertSucess('Livro adicionado com sucesso!');
    }).catch(error => {
        console.error(error);
        alertError('Erro ao adicionar livro!');
    });
}

function editBook() {
    const data = getModalData();
    if (data == undefined) {
        return;
    }

    fetch(`/api/book/edit/${SelectedBook}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    }).then(res => {
        if (!res.ok) {
            throw new Error('Erro ao editar livro');
        }

        $('#Modal_Livro').modal('hide');
        reloadBooks();
        alertSucess('Livro editado com sucesso!');
    }).catch(error => {
        console.error(error);
        alertError('Erro ao editar livro!');
    });
}

function reloadBooks() {
    booksHasMore = true;
    return loadBooks(true);
}

function removeBook(id) {
    pendingBookDeleteId = id;
    fetch(`/api/books/${id}`)
        .then(response => response.ok ? response.json() : null)
        .then(book => {
            showDeleteConfirmation({
                title: 'Excluir livro',
                message: `Tem certeza que deseja excluir "${book?.titulo || `livro #${id}`}"? Essa ação não pode ser desfeita.`,
                onConfirm: confirmRemoveBook
            });
        })
        .catch(() => {
            showDeleteConfirmation({
                title: 'Excluir livro',
                message: `Tem certeza que deseja excluir o livro #${id}? Essa ação não pode ser desfeita.`,
                onConfirm: confirmRemoveBook
            });
        });
}

function confirmRemoveBook() {
    if (!pendingBookDeleteId) {
        return;
    }

    const id = pendingBookDeleteId;
    pendingBookDeleteId = null;

    fetch(`/api/book/remove/${id}`)
        .then(res => {
            res.status == 200 ? alertSucess('Livro removido com sucesso!') : alertError('Erro ao remover livro, Verifique se ele não está emprestado!');
            reloadBooks();
        }).catch(error => {
            console.error(error);
            alertError('Erro ao remover livro!');
        });
}

function showDeleteConfirmation({ title, message, onConfirm }) {
    const modalElement = document.getElementById('Modal_Confirm_Delete');
    const titleElement = document.getElementById('confirm-delete-title');
    const messageElement = document.getElementById('confirm-delete-message');
    const confirmButton = document.getElementById('confirm-delete-action');

    if (!modalElement || !confirmButton) {
        onConfirm();
        return;
    }

    titleElement.textContent = title;
    messageElement.textContent = message;
    confirmButton.replaceWith(confirmButton.cloneNode(true));

    const freshConfirmButton = document.getElementById('confirm-delete-action');
    const confirmModal = bootstrap.Modal.getOrCreateInstance(modalElement);

    freshConfirmButton.addEventListener('click', () => {
        confirmModal.hide();
        onConfirm();
    }, { once: true });

    confirmModal.show();
}

function emprestimo() {
    const leitor = document.getElementById('seletor_leitor_emprestimo').value;
    const exemplar = document.getElementById('seletor_exemplar_emprestimo')?.value;
    const livro = SelectedBook;
    const prazo = parseInt(document.getElementById('seletor_de_tempo_do_emprestimo').value);
    const dataAtual = new Date();
    const data = dataAtual.getTime();

    if (!exemplar) {
        alertError('Selecione um exemplar disponível para emprestar.');
        return;
    }

    dataAtual.setDate(dataAtual.getDate() + prazo);

    fetch('/api/emprestimo', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            livro_id: livro,
            exemplar_id: exemplar,
            leitor_id: leitor,
            data,
            data_devolucao: dataAtual.getTime()
        }),
    })
        .then(response => {
            if (response.status == 200) {
                alertSucess('Emprestimo realizado com sucesso!');
                $('#Modal_Emprestimo').modal('hide');
                reloadBooks();
            } else {
                alertError('Erro ao realizar emprestimo! Verifique se o livro já não está emprestado! ou se o leitor já não atingiu o limite de emprestimos!');
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

function devolva() {
    const url = SelectedCopy
        ? `/api/book-copies/devolucao/${SelectedCopy}`
        : `/api/books/devolucao/${SelectedBook}`;

    fetch(url)
        .then(response => {
            if (response.status == 200) {
                alertSucess('Devolução realizada com sucesso!');
                $('#Modal_Devolucao').modal('hide');
                reloadBooks();
            } else {
                alertError('Erro ao realizar devolução!');
            }
        });
}
