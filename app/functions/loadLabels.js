const LABELS_PAGE_SIZE = 200;
const labelsParams = new URLSearchParams(window.location.search);
let labelsSearchTerm = labelsParams.get('search') || '';
let visibleCopyIds = [];
const selectedCopyIds = new Set();

const labelsList = document.getElementById('labels-list-cards');
const labelsSummary = document.getElementById('labels-result-summary');
const labelsState = document.getElementById('labels-state');
const labelsSearchInput = document.getElementById('labels-search-input');
const labelsFilterForm = document.getElementById('labels-filter-form');
const labelsGenerateButton = document.getElementById('labels-generate-selected');
const labelsSelectVisibleButton = document.getElementById('labels-select-visible');
const labelsClearSelectionButton = document.getElementById('labels-clear-selection');

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

function buildBooksUrl() {
    const params = new URLSearchParams();
    params.set('limit', String(LABELS_PAGE_SIZE));
    params.set('offset', '0');

    if (labelsSearchTerm.trim()) {
        params.set('search', labelsSearchTerm.trim());
    }

    return `/api/books?${params.toString()}`;
}

function updateLabelsLocation() {
    const params = new URLSearchParams();
    if (labelsSearchTerm.trim()) {
        params.set('search', labelsSearchTerm.trim());
    }

    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
}

function updateSelectionState() {
    if (labelsState) {
        labelsState.textContent = `${selectedCopyIds.size} etiqueta(s) selecionada(s). Cada exemplar tem código próprio no QR.`;
        labelsState.classList.toggle('filter-state-active', selectedCopyIds.size > 0);
    }

    document.querySelectorAll('.label-copy-check').forEach(input => {
        input.checked = selectedCopyIds.has(Number(input.dataset.copyId));
    });

    document.querySelectorAll('.label-book-check').forEach(input => {
        const bookId = input.dataset.bookId;
        const bookCopies = Array.from(document.querySelectorAll(`.label-copy-check[data-book-id="${bookId}"]`));
        input.checked = bookCopies.length > 0 && bookCopies.every(copyInput => copyInput.checked);
        input.indeterminate = bookCopies.some(copyInput => copyInput.checked) && !input.checked;
    });
}

function groupCopiesByBook(copies) {
    return copies.reduce((acc, copy) => {
        const key = String(copy.livro_id);
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(copy);
        return acc;
    }, {});
}

function buildCopyChecks(book, copies) {
    return copies.map(copy => {
        const checked = selectedCopyIds.has(copy.id) ? 'checked' : '';
        const status = copy.emprestimo_id ? 'Emprestado' : 'Disponível';
        const statusClass = copy.emprestimo_id ? 'text-warning' : 'text-success';

        return `
        <label class="copy-chip">
            <input class="form-check-input label-copy-check me-1" type="checkbox" data-book-id="${book.id}" data-copy-id="${copy.id}" ${checked}>
            <span class="fw-semibold">${escapeHtml(copy.codigo)}</span>
            <span class="${statusClass}">${status}</span>
        </label>`;
    }).join('');
}

function buildBookCard(book, copies) {
    const loaned = copies.filter(copy => copy.emprestimo_id).length;
    const available = copies.length - loaned;

    return `
    <div class="card shadow-sm m-2 label-book-card" data-book-id="${book.id}">
        <div class="card-body">
            <div class="container-fluid">
                <div class="row g-3 align-items-start">
                    <div class="col-md-6">
                        <div class="form-check">
                            <input class="form-check-input label-book-check" type="checkbox" data-book-id="${book.id}" id="label-book-${book.id}">
                            <label class="form-check-label fw-bold" for="label-book-${book.id}">${escapeHtml(book.titulo)}</label>
                        </div>
                        <p class="mb-1">Autor: ${escapeHtml(book.autor)} | ISBN: ${escapeHtml(book.isbn)}</p>
                        <p class="mb-0">Exemplares: ${copies.length} | Disponíveis: ${available} | Emprestados: ${loaned}</p>
                    </div>
                    <div class="col-md-6">
                        <div class="copy-chip-list">${buildCopyChecks(book, copies)}</div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}

function renderBooksWithCopies(books, copies) {
    const groupedCopies = groupCopiesByBook(copies);
    visibleCopyIds = copies.map(copy => copy.id);

    if (books.length === 0) {
        labelsList.innerHTML = '';
        if (labelsSummary) {
            labelsSummary.textContent = 'Nenhum livro encontrado.';
        }
        updateSelectionState();
        return;
    }

    labelsList.innerHTML = books
        .map(book => buildBookCard(book, groupedCopies[String(book.id)] || []))
        .join('');

    if (labelsSummary) {
        labelsSummary.textContent = `${books.length} livro(s) carregado(s) para seleção.`;
    }
    updateSelectionState();
}

function loadLabelBooks() {
    if (labelsSummary) {
        labelsSummary.textContent = 'Carregando livros e exemplares...';
    }

    return fetch(buildBooksUrl())
        .then(response => {
            if (!response.ok) {
                throw new Error('Erro ao carregar livros');
            }
            return response.json();
        })
        .then(books => {
            const ids = books.map(book => book.id).join(',');
            if (!ids) {
                renderBooksWithCopies([], []);
                return;
            }

            return fetch(`/api/book-copies?bookIds=${encodeURIComponent(ids)}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Erro ao carregar exemplares');
                    }
                    return response.json();
                })
                .then(copies => renderBooksWithCopies(books, copies));
        })
        .catch(error => {
            console.error(error);
            alertError('Erro ao carregar etiquetas!');
        });
}

const scheduleLabelsSearchApply = debounce(() => {
    updateLabelsLocation();
    loadLabelBooks();
}, 250);

if (labelsSearchInput) {
    labelsSearchInput.value = labelsSearchTerm;
    labelsSearchInput.addEventListener('input', () => {
        labelsSearchTerm = labelsSearchInput.value.trim();
        scheduleLabelsSearchApply();
    });
}

if (labelsFilterForm) {
    labelsFilterForm.addEventListener('submit', event => {
        event.preventDefault();
        labelsSearchTerm = labelsSearchInput?.value.trim() || '';
        updateLabelsLocation();
        loadLabelBooks();
    });
}

labelsList.addEventListener('change', event => {
    const target = event.target;

    if (target.classList.contains('label-copy-check')) {
        const copyId = Number(target.dataset.copyId);
        if (target.checked) {
            selectedCopyIds.add(copyId);
        } else {
            selectedCopyIds.delete(copyId);
        }
        updateSelectionState();
    }

    if (target.classList.contains('label-book-check')) {
        const bookId = target.dataset.bookId;
        document.querySelectorAll(`.label-copy-check[data-book-id="${bookId}"]`).forEach(input => {
            const copyId = Number(input.dataset.copyId);
            if (target.checked) {
                selectedCopyIds.add(copyId);
            } else {
                selectedCopyIds.delete(copyId);
            }
        });
        updateSelectionState();
    }
});

labelsSelectVisibleButton?.addEventListener('click', () => {
    visibleCopyIds.forEach(copyId => selectedCopyIds.add(copyId));
    updateSelectionState();
});

labelsClearSelectionButton?.addEventListener('click', () => {
    selectedCopyIds.clear();
    updateSelectionState();
});

labelsGenerateButton?.addEventListener('click', () => {
    const copyIds = Array.from(selectedCopyIds);

    if (copyIds.length === 0) {
        alertError('Selecione ao menos um exemplar para gerar etiquetas.');
        return;
    }

    window.open(`/labels/books?copyIds=${encodeURIComponent(copyIds.join(','))}`, '_blank');
});

loadLabelBooks();
