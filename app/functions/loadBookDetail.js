const detailPathMatch = window.location.pathname.match(/^\/livros\/(\d+)\/?$/);
const detailParams = new URLSearchParams(window.location.search);
const detailBookId = Number(detailPathMatch?.[1] || detailParams.get('bookId')) || null;

let detailBook = null;
let detailCopies = [];
let selectedHistoryCopyId = null;

const detailState = document.getElementById('book-detail-state');
const detailSummary = document.getElementById('book-detail-summary');
const detailEditLink = document.getElementById('book-detail-edit');
const detailLoanLink = document.getElementById('book-detail-loan');
const detailHistoryAll = document.getElementById('book-detail-history-all');
const copiesSummary = document.getElementById('book-copies-summary');
const copiesList = document.getElementById('book-copies-list');
const historyTitle = document.getElementById('copy-history-title');
const historySummary = document.getElementById('copy-history-summary');
const historyList = document.getElementById('copy-history-list');

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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

function setDetailState(text, active = false) {
    if (!detailState) {
        return;
    }

    detailState.textContent = text;
    detailState.classList.toggle('filter-state-active', active);
}

function bookStatusBadge(book) {
    if (Number(book.exemplares_atrasados) > 0) {
        return '<span class="badge bg-danger">Atrasado</span>';
    }
    if (Number(book.exemplares_emprestados) > 0) {
        return '<span class="badge bg-warning">Emprestado</span>';
    }
    return '<span class="badge bg-success">Prateleira</span>';
}

function copyStatus(copy) {
    if (!copy.emprestimo_id) {
        return {
            badge: '<span class="badge bg-success">Disponível</span>',
            label: 'Disponível',
            overdue: 0,
        };
    }

    const atraso = daysOverdue(copy.data_prazo);
    if (atraso > 0) {
        return {
            badge: '<span class="badge bg-danger">Atrasado</span>',
            label: 'Atrasado',
            overdue: atraso,
        };
    }

    return {
        badge: '<span class="badge bg-warning">Emprestado</span>',
        label: 'Emprestado',
        overdue: 0,
    };
}

function renderBookSummary() {
    if (!detailBook || !detailSummary) {
        return;
    }

    const tags = String(detailBook.tags ?? '')
        .split(',')
        .filter(Boolean)
        .map(tag => `<span class="badge bg-primary me-1">${escapeHtml(tag)}</span>`)
        .join('');

    detailSummary.innerHTML = `
        <div class="d-flex flex-wrap align-items-start gap-3">
            <div class="flex-grow-1">
                <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
                    <h3 class="fw-bold mb-0">${escapeHtml(detailBook.titulo)}</h3>
                    ${bookStatusBadge(detailBook)}
                </div>
                <p class="mb-1">Autor: ${escapeHtml(detailBook.autor)} | Editora: ${escapeHtml(detailBook.editora)} | ISBN: ${escapeHtml(detailBook.isbn || '-')}</p>
                <p class="mb-1">Exemplares: ${escapeHtml(detailBook.total_exemplares || 0)} | Disponíveis: ${escapeHtml(detailBook.exemplares_disponiveis || 0)} | Emprestados: ${escapeHtml(detailBook.exemplares_emprestados || 0)} | Atrasados: ${escapeHtml(detailBook.exemplares_atrasados || 0)}</p>
                <div>${tags}</div>
            </div>
        </div>
    `;
}

function buildCopyCard(copy) {
    const status = copyStatus(copy);
    const activeHistory = selectedHistoryCopyId === copy.id ? 'copy-card-active' : '';
    const loanInfo = copy.emprestimo_id
        ? `
            <p class="mb-1">Leitor: <strong>${escapeHtml(copy.leitor_nome || '-')}</strong> | Turma: ${escapeHtml(copy.leitor_turma || '-')}</p>
            <p class="mb-0">Emprestado em ${formatDate(copy.data_emprestimo)} | Prazo ${formatDate(copy.data_prazo)}${status.overdue ? ` | ${status.overdue} dia(s) em atraso` : ''}</p>
        `
        : '<p class="mb-0 text-secondary">Sem empréstimo ativo.</p>';
    const primaryAction = copy.emprestimo_id
        ? `<button class="btn btn-outline-danger" type="button" data-copy-action="return" data-copy-id="${copy.id}">Devolver</button>`
        : `<a class="btn btn-primary" href="/?emprestimo=${copy.livro_id}">Emprestar</a>`;

    return `
    <div class="card shadow-sm m-2 copy-detail-card ${activeHistory}" data-copy-id="${copy.id}">
        <div class="card-body">
            <div class="d-flex flex-wrap align-items-start gap-3">
                <div class="flex-grow-1">
                    <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
                        <h5 class="fw-bold mb-0">${escapeHtml(copy.codigo)}</h5>
                        ${status.badge}
                    </div>
                    ${loanInfo}
                </div>
                <div class="d-flex flex-wrap gap-2 justify-content-end">
                    <button class="btn btn-outline-primary" type="button" data-copy-action="history" data-copy-id="${copy.id}" data-copy-code="${escapeHtml(copy.codigo)}">Histórico</button>
                    ${primaryAction}
                </div>
            </div>
        </div>
    </div>`;
}

function renderCopies() {
    if (!copiesList) {
        return;
    }

    if (copiesSummary) {
        copiesSummary.textContent = `${detailCopies.length} exemplar(es)`;
    }

    copiesList.innerHTML = detailCopies.length > 0
        ? detailCopies.map(buildCopyCard).join('')
        : '<div class="filter-state">Nenhum exemplar cadastrado.</div>';
}

function buildHistoryCard(item) {
    const isReturned = item.status === 'DEVOLVIDO';
    const badge = isReturned
        ? '<span class="badge bg-success">Devolvido</span>'
        : '<span class="badge bg-warning">Em aberto</span>';
    const returnedText = isReturned
        ? `Devolvido em ${formatDate(item.data_devolucao)}`
        : 'Ainda não devolvido';

    return `
    <div class="card shadow-sm m-2">
        <div class="card-body">
            <div class="d-flex flex-wrap align-items-start gap-3">
                <div class="flex-grow-1">
                    <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
                        <h5 class="fw-bold mb-0">${escapeHtml(item.exemplar_codigo || item.livro_titulo)}</h5>
                        ${badge}
                    </div>
                    <p class="mb-1">Leitor: <strong>${escapeHtml(item.leitor_nome)}</strong> | Turma: ${escapeHtml(item.leitor_turma)}</p>
                    <p class="mb-0">Emprestado em ${formatDate(item.data_emprestimo)} | Prazo ${formatDate(item.data_prazo)}</p>
                </div>
                <div class="text-secondary">${returnedText}</div>
            </div>
        </div>
    </div>`;
}

function loadHistory(copyId = selectedHistoryCopyId, copyCode = '') {
    selectedHistoryCopyId = copyId;

    const params = new URLSearchParams();
    params.set('bookId', String(detailBookId));
    params.set('limit', '60');
    params.set('offset', '0');
    if (copyId) {
        params.set('copyId', String(copyId));
    }

    if (historyTitle) {
        historyTitle.textContent = copyId ? `Histórico do exemplar ${copyCode}` : 'Histórico do livro';
    }
    if (historySummary) {
        historySummary.textContent = 'Carregando...';
    }
    renderCopies();

    return fetch(`/api/loans/history?${params.toString()}`)
        .then(response => {
            if (!response.ok) {
                throw new Error('Erro ao carregar histórico');
            }
            return response.json();
        })
        .then(items => {
            if (historySummary) {
                historySummary.textContent = `${items.length} registro(s)`;
            }
            if (historyList) {
                historyList.innerHTML = items.length > 0
                    ? items.map(buildHistoryCard).join('')
                    : '<div class="filter-state">Nenhum histórico para este escopo.</div>';
            }
        });
}

function loadBookAndCopies() {
    return Promise.all([
        fetch(`/api/books/${detailBookId}`).then(response => {
            if (!response.ok) {
                throw new Error('Livro não encontrado');
            }
            return response.json();
        }),
        fetch(`/api/books/${detailBookId}/copies`).then(response => {
            if (!response.ok) {
                throw new Error('Erro ao carregar exemplares');
            }
            return response.json();
        }),
    ]).then(([book, copies]) => {
        detailBook = book;
        detailCopies = copies;
        document.title = `${book.titulo} - Book DB`;
        if (detailEditLink) {
            detailEditLink.href = `/?modal=${detailBookId}`;
        }
        if (detailLoanLink) {
            detailLoanLink.href = `/?emprestimo=${detailBookId}`;
            detailLoanLink.classList.toggle('disabled', Number(book.exemplares_disponiveis) <= 0);
        }
        renderBookSummary();
        renderCopies();
        setDetailState('Dados atualizados.', true);
    });
}

function returnCopy(copyId) {
    if (!confirm('Confirmar devolução deste exemplar?')) {
        return;
    }

    return fetch(`/api/book-copies/devolucao/${copyId}`, { method: 'POST' })
        .then(response => {
            if (!response.ok) {
                throw new Error('Erro ao devolver exemplar');
            }
            alertSucess('Exemplar devolvido.');
            return loadBookAndCopies();
        })
        .then(() => {
            const selectedCopy = detailCopies.find(copy => copy.id === selectedHistoryCopyId);
            return loadHistory(selectedHistoryCopyId, selectedCopy?.codigo || '');
        })
        .catch(error => {
            console.error(error);
            alertError('Erro ao devolver exemplar.');
        });
}

if (detailHistoryAll) {
    detailHistoryAll.addEventListener('click', (event) => {
        event.preventDefault();
        loadHistory(null);
    });
}

if (copiesList) {
    copiesList.addEventListener('click', (event) => {
        const actionElement = event.target.closest('[data-copy-action]');
        if (!actionElement) {
            return;
        }

        const copyId = Number(actionElement.dataset.copyId);
        if (!copyId) {
            return;
        }

        if (actionElement.dataset.copyAction === 'history') {
            loadHistory(copyId, actionElement.dataset.copyCode || '');
            return;
        }

        if (actionElement.dataset.copyAction === 'return') {
            returnCopy(copyId);
        }
    });
}

if (!detailBookId) {
    setDetailState('Livro inválido.');
} else {
    setDetailState('Carregando livro...');
    loadBookAndCopies()
        .then(() => loadHistory(null))
        .catch(error => {
            console.error(error);
            setDetailState('Erro ao carregar livro.');
            alertError('Erro ao carregar livro.');
        });
}
