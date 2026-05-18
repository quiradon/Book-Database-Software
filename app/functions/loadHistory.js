const HISTORY_PAGE_SIZE = 60;
const historyParams = new URLSearchParams(window.location.search);
const historyBookPathMatch = window.location.pathname.match(/^\/historico\/livro\/(\d+)\/?$/);
let historySearchTerm = historyParams.get('search') || '';
let historyStatusFilter = historyParams.get('status') || '';
const historyBookId = Number(historyBookPathMatch?.[1] || historyParams.get('bookId')) || null;
const historyBasePath = historyBookId ? `/historico/livro/${historyBookId}` : '/historico';
let historyBookTitle = '';
let historyBook = null;

const historyList = document.getElementById('history-list-cards');
const historySummary = document.getElementById('history-result-summary');
const historySearchInput = document.getElementById('history-search-input');
const historyStatusSelect = document.getElementById('history-status-filter');
const historyFilterForm = document.getElementById('history-filter-form');
const historyFilterState = document.getElementById('history-filter-state');
const historyClearFilters = document.getElementById('history-clear-filters');
const historyBookScope = document.getElementById('history-book-scope');

let historyOffset = 0;
let historyHasMore = true;
let historyLoading = false;
let historyPendingReload = false;

const loadMoreHistoryButton = document.createElement('button');
loadMoreHistoryButton.className = 'btn btn-outline-primary m-2';
loadMoreHistoryButton.type = 'button';
loadMoreHistoryButton.textContent = 'Carregar mais';
loadMoreHistoryButton.addEventListener('click', () => loadLoanHistory(false));
historyList.after(loadMoreHistoryButton);

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

function renderHistoryBookScope() {
    if (!historyBookScope) {
        return;
    }

    if (!historyBookId) {
        historyBookScope.classList.add('d-none');
        historyBookScope.innerHTML = '';
        return;
    }

    const title = historyBookTitle || `Livro #${historyBookId}`;
    const metaItems = [];

    if (historyBook?.autor) {
        metaItems.push(`Autor: ${escapeHtml(historyBook.autor)}`);
    }
    if (historyBook?.editora) {
        metaItems.push(`Editora: ${escapeHtml(historyBook.editora)}`);
    }
    if (historyBook?.isbn) {
        metaItems.push(`ISBN: ${escapeHtml(historyBook.isbn)}`);
    }
    if (historyBook?.total_exemplares) {
        metaItems.push(`Exemplares: ${escapeHtml(historyBook.total_exemplares)}`);
    }

    historyBookScope.classList.remove('d-none');
    historyBookScope.innerHTML = `
        <div class="d-flex flex-wrap align-items-center gap-3">
            <div class="flex-grow-1">
                <div class="text-secondary small text-uppercase">Histórico do livro</div>
                <div class="history-book-title fw-bold">${escapeHtml(title)}</div>
                <div class="text-secondary">${metaItems.length > 0 ? metaItems.join(' | ') : 'Carregando dados do livro...'}</div>
            </div>
            <a class="btn btn-outline-primary" href="/?modal=${historyBookId}">Editar livro</a>
            <a class="btn btn-outline-primary" href="/historico">Ver todos</a>
        </div>
    `;
}

function isHistorySearchActive() {
    return historySearchTerm.trim().length > 0;
}

function syncHistoryFilterControls() {
    const searchActive = isHistorySearchActive();
    const bookScope = historyBookId ? `Histórico de ${historyBookTitle || `livro #${historyBookId}`}. ` : '';

    if (historyFilterForm) {
        historyFilterForm.action = historyBasePath;
    }
    if (historySearchInput && historySearchInput.value !== historySearchTerm) {
        historySearchInput.value = historySearchTerm;
    }
    if (historyStatusSelect) {
        historyStatusSelect.value = historyStatusFilter;
        historyStatusSelect.disabled = searchActive;
        historyStatusSelect.closest('.filter-field')?.classList.toggle('filter-disabled', searchActive);
    }

    if (!historyFilterState) {
        return;
    }

    if (historyClearFilters) {
        historyClearFilters.href = historyBasePath;
    }

    historyFilterState.classList.toggle('filter-state-active', searchActive || Boolean(historyStatusFilter) || Boolean(historyBookId));
    if (searchActive) {
        historyFilterState.textContent = `${bookScope}Busca ativa: "${historySearchTerm.trim()}". Status está sendo ignorado.`;
        return;
    }

    const statusLabel = historyStatusFilter === 'EMPRESTADO'
        ? 'Em aberto'
        : historyStatusFilter === 'DEVOLVIDO'
            ? 'Devolvidos'
            : '';
    historyFilterState.textContent = `${bookScope}${statusLabel ? `Filtro ativo: ${statusLabel}` : 'Sem filtros ativos.'}`;
}

function updateHistoryLocation() {
    const params = new URLSearchParams();

    if (isHistorySearchActive()) {
        params.set('search', historySearchTerm.trim());
    } else if (historyStatusFilter) {
        params.set('status', historyStatusFilter);
    }

    const query = params.toString();
    window.history.replaceState(null, '', `${historyBasePath}${query ? `?${query}` : ''}`);
}

function resetHistoryListState() {
    historyOffset = 0;
    historyHasMore = true;
    historyList.innerHTML = '';
    if (historySummary) {
        historySummary.textContent = 'Carregando resultados...';
    }
}

function applyHistoryFilters() {
    resetHistoryListState();
    syncHistoryFilterControls();
    updateHistoryLocation();
    loadLoanHistory(true);
}

const scheduleHistorySearchApply = debounce(() => {
    applyHistoryFilters();
}, 250);

if (historyFilterForm) {
    historyFilterForm.addEventListener('submit', (event) => {
        event.preventDefault();
        historySearchTerm = historySearchInput?.value.trim() || '';
        historyStatusFilter = historyStatusSelect?.value || '';
        applyHistoryFilters();
    });
}

if (historySearchInput) {
    historySearchInput.value = historySearchTerm;
    historySearchInput.addEventListener('input', () => {
        historySearchTerm = historySearchInput.value.trim();
        syncHistoryFilterControls();
        scheduleHistorySearchApply();
    });
}

if (historyStatusSelect) {
    historyStatusSelect.addEventListener('change', () => {
        historyStatusFilter = historyStatusSelect.value;
        applyHistoryFilters();
    });
}

function buildHistoryUrl(reset) {
    const params = new URLSearchParams();
    params.set('limit', String(HISTORY_PAGE_SIZE));
    params.set('offset', String(reset ? 0 : historyOffset));

    if (historyBookId) {
        params.set('bookId', String(historyBookId));
    }
    if (isHistorySearchActive()) {
        params.set('search', historySearchTerm.trim());
    } else if (historyStatusFilter) {
        params.set('status', historyStatusFilter);
    }

    return `/api/loans/history?${params.toString()}`;
}

function updateLoadMoreHistoryButton() {
    loadMoreHistoryButton.classList.toggle('d-none', !historyHasMore);
    loadMoreHistoryButton.disabled = historyLoading;
}

function buildHistoryCard(item) {
    const isReturned = item.status === 'DEVOLVIDO';
    const badge = isReturned
        ? '<span class="badge bg-success">Devolvido</span>'
        : '<span class="badge bg-warning">Em aberto</span>';
    const returnedText = isReturned
        ? `Devolvido em ${formatDate(item.data_devolucao)}`
        : 'Ainda não devolvido';
    const bookTitle = historyBookId || !item.livro_id
        ? escapeHtml(item.livro_titulo)
        : `<a class="link-body-emphasis text-decoration-none" href="/livros/${item.livro_id}">${escapeHtml(item.livro_titulo)}</a>`;

    return `
    <div class="card shadow-sm m-2">
        <div class="card-body">
            <div class="container-fluid">
                <div class="row align-items-center g-3">
                    <div class="col-md-7">
                        <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
                            <h5 class="fw-bold mb-0">${bookTitle}</h5>
                            ${badge}
                        </div>
                        <p class="mb-1">Leitor: <strong>${escapeHtml(item.leitor_nome)}</strong> | Turma: ${escapeHtml(item.leitor_turma)}</p>
                        <p class="mb-1">Exemplar: ${escapeHtml(item.exemplar_codigo || '-')}</p>
                        <p class="mb-0">Emprestado em ${formatDate(item.data_emprestimo)} | Prazo ${formatDate(item.data_prazo)}</p>
                    </div>
                    <div class="col-md-3 text-secondary">${returnedText}</div>
                    <div class="col-md-2 d-flex justify-content-md-end">
                        <a class="btn btn-outline-primary" href="/livros/${item.livro_id}">Livro</a>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}

function renderHistory(items, reset) {
    if (reset) {
        historyList.innerHTML = '';
    }

    if (items.length === 0 && historyOffset === 0) {
        historyList.innerHTML = '';
        if (historySummary) {
            historySummary.textContent = 'Nenhum histórico encontrado.';
        }
        return;
    }

    historyList.insertAdjacentHTML('beforeend', items.map(buildHistoryCard).join(''));
}

function loadLoanHistory(reset = false) {
    if (historyLoading) {
        historyPendingReload = historyPendingReload || reset;
        return Promise.resolve();
    }
    if (!reset && !historyHasMore) {
        return Promise.resolve();
    }

    historyLoading = true;
    updateLoadMoreHistoryButton();

    return fetch(buildHistoryUrl(reset))
        .then(response => {
            if (!response.ok) {
                throw new Error('Erro ao carregar histórico');
            }

            historyHasMore = response.headers.get('X-Has-More') === '1';
            return response.json();
        })
        .then(data => {
            if (reset) {
                historyOffset = 0;
            }

            renderHistory(data, reset);
            historyOffset += data.length;
            if (historySummary && data.length > 0) {
                historySummary.textContent = `${historyOffset} registro(s) carregado(s)${historyHasMore ? ' - há mais resultados' : ''}`;
            }
        })
        .catch(error => {
            console.error(error);
            alertError('Erro ao carregar histórico!');
        })
        .finally(() => {
            historyLoading = false;
            updateLoadMoreHistoryButton();
            if (historyPendingReload) {
                historyPendingReload = false;
                loadLoanHistory(true);
            }
        });
}

function loadHistoryBookTitle() {
    if (!historyBookId) {
        return Promise.resolve();
    }

    return fetch(`/api/books/${historyBookId}`)
        .then(response => response.ok ? response.json() : null)
        .then(book => {
            historyBook = book;
            historyBookTitle = book?.titulo || '';
            renderHistoryBookScope();
            syncHistoryFilterControls();
        })
        .catch(() => {
            historyBook = null;
            historyBookTitle = '';
            renderHistoryBookScope();
        });
}

renderHistoryBookScope();
syncHistoryFilterControls();
updateHistoryLocation();
loadHistoryBookTitle().then(() => loadLoanHistory(true));
