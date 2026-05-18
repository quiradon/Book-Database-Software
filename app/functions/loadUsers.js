let SelectedLeitor = null;
let pendingUserDeleteId = null;

const USERS_PAGE_SIZE = 60;
const usersPageParams = new URLSearchParams(window.location.search);
let usersSearchTerm = usersPageParams.get('search') || '';
let usersClassFilter = usersPageParams.get('turma') || '';
const UsersList = document.getElementById('users-list-cards');
const usersSummary = document.getElementById('users-result-summary');

let userMaxEmprestimos = 0;
let usersOffset = 0;
let usersHasMore = true;
let usersLoading = false;
let usersPendingReload = false;

const loadMoreUsersButton = document.createElement('button');
loadMoreUsersButton.className = 'btn btn-outline-primary m-2';
loadMoreUsersButton.type = 'button';
loadMoreUsersButton.textContent = 'Carregar mais';
loadMoreUsersButton.addEventListener('click', () => loadUsers(false));
UsersList.after(loadMoreUsersButton);

const usersSearchInput = document.getElementById('users-search-input');
const usersClassSelect = document.getElementById('users-class-filter');
const usersFilterForm = document.getElementById('users-filter-form');
const usersFilterState = document.getElementById('users-filter-state');

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

function isUserSearchActive() {
    return usersSearchTerm.trim().length > 0;
}

function syncUserFilterControls() {
    const searchActive = isUserSearchActive();

    if (usersSearchInput && usersSearchInput.value !== usersSearchTerm) {
        usersSearchInput.value = usersSearchTerm;
    }
    if (usersClassSelect) {
        usersClassSelect.value = usersClassFilter;
        usersClassSelect.disabled = searchActive;
        usersClassSelect.closest('.filter-field')?.classList.toggle('filter-disabled', searchActive);
    }

    if (!usersFilterState) {
        return;
    }

    usersFilterState.classList.toggle('filter-state-active', searchActive || Boolean(usersClassFilter));
    if (searchActive) {
        usersFilterState.textContent = `Busca global ativa: "${usersSearchTerm.trim()}". Turma está sendo ignorada.`;
        return;
    }

    usersFilterState.textContent = usersClassFilter ? `Filtro ativo: Turma ${usersClassFilter}` : 'Sem filtros ativos.';
}

function updateUsersLocation() {
    const params = new URLSearchParams();

    if (isUserSearchActive()) {
        params.set('search', usersSearchTerm.trim());
    } else if (usersClassFilter) {
        params.set('turma', usersClassFilter);
    }

    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
}

function resetUsersListState() {
    usersOffset = 0;
    usersHasMore = true;
    UsersList.innerHTML = '';
    if (usersSummary) {
        usersSummary.textContent = 'Carregando resultados...';
    }
}

function applyUserFilters() {
    resetUsersListState();
    syncUserFilterControls();
    updateUsersLocation();
    loadUsers(true);
}

const scheduleUserSearchApply = debounce(() => {
    applyUserFilters();
}, 250);

if (usersFilterForm) {
    usersFilterForm.addEventListener('submit', (event) => {
        event.preventDefault();
        usersSearchTerm = usersSearchInput?.value.trim() || '';
        usersClassFilter = usersClassSelect?.value || '';
        applyUserFilters();
    });
}

if (usersSearchInput) {
    usersSearchInput.value = usersSearchTerm;
    usersSearchInput.addEventListener('input', () => {
        usersSearchTerm = usersSearchInput.value.trim();
        syncUserFilterControls();
        scheduleUserSearchApply();
    });
}

if (usersClassSelect) {
    usersClassSelect.addEventListener('change', () => {
        usersClassFilter = usersClassSelect.value;
        applyUserFilters();
    });
}

function buildUsersCard(id, nome, contato, turma, emprestimos, max_emprestimos) {
    const newid = parseInt(id);
    return `
    <div class="card shadow-sm m-2">
    <div class="card-body">
        <div class="container-fluid">
            <div class="row">
                <div class="col-md-6">
                    <h5 class="fw-bold">${escapeHtml(nome)}</h5>
                    <p class="mb-1">Contato: ${escapeHtml(contato)}</p>
                    <p class="mb-1">Empréstimos: ${emprestimos}/${max_emprestimos}</p><span class="badge bg-primary ms-0 m-1">${escapeHtml(turma)}</span>
                </div>
                <div class="col d-sm-flex d-md-flex d-lg-flex d-xl-flex justify-content-sm-end align-items-sm-center justify-content-md-end align-items-md-center justify-content-lg-end align-items-lg-center justify-content-xl-end align-items-xl-center">
                    <div class="dropdown"><button class="btn btn-primary dropdown-toggle mt-1" aria-expanded="false" data-bs-toggle="dropdown" type="button"><svg class="mb-1" xmlns="http://www.w3.org/2000/svg" viewBox="-32 0 512 512" width="1em" height="1em" fill="currentColor" style="margin-right: 6px;font-size: 16px;">
                                <path d="M201 10.3c14.3-7.8 31.6-7.8 46 0L422.3 106c5.1 2.8 8.3 8.2 8.3 14s-3.2 11.2-8.3 14L231.7 238c-4.8 2.6-10.5 2.6-15.3 0L25.7 134c-5.1-2.8-8.3-8.2-8.3-14s3.2-11.2 8.3-14L201 10.3zM23.7 170l176 96c5.1 2.8 8.3 8.2 8.3 14V496c0 5.6-3 10.9-7.8 13.8s-10.9 3-15.8 .3L25 423.1C9.6 414.7 0 398.6 0 381V184c0-5.6 3-10.9 7.8-13.8s10.9-3 15.8-.3zm400.7 0c5-2.7 11-2.6 15.8 .3s7.8 8.1 7.8 13.8V381c0 17.6-9.6 33.7-25 42.1L263.7 510c-5 2.7-11 2.6-15.8-.3s-7.8-8.1-7.8-13.8V280c0-5.9 3.2-11.2 8.3-14l176-96z"></path>
                            </svg>Ações</button>
                        <div class="dropdown-menu"><a class="dropdown-item" href="/leitores?modal=${newid}">Editar</a><a class="dropdown-item" href="/leitores?emprestimo=${newid}">Emprestimos</a><a class="dropdown-item" href="javascript:void(0)" onclick="removeUser(${id})">Deletar</a></div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
`;
}

function buildUsersUrl(reset) {
    const params = new URLSearchParams();
    params.set('limit', String(USERS_PAGE_SIZE));
    params.set('offset', String(reset ? 0 : usersOffset));

    if (isUserSearchActive()) {
        params.set('search', usersSearchTerm.trim());
    } else if (usersClassFilter) {
        params.set('turma', usersClassFilter);
    }

    return `/api/users?${params.toString()}`;
}

function updateLoadMoreUsersButton() {
    loadMoreUsersButton.classList.toggle('d-none', !usersHasMore);
    loadMoreUsersButton.disabled = usersLoading;
}

function renderUsers(users, reset) {
    if (reset) {
        UsersList.innerHTML = '';
    }

    if (users.length === 0 && usersOffset === 0) {
        alertError('Não consegui achar nenhum Leitor em sua pesquisa!');
        return;
    }

    const html = users
        .map(user => buildUsersCard(user.id, user.nome, user.contato, user.turma, user.emprestimos, userMaxEmprestimos))
        .join('');
    UsersList.insertAdjacentHTML('beforeend', html);
}

function loadUsers(reset = false) {
    if (usersLoading) {
        usersPendingReload = usersPendingReload || reset;
        return Promise.resolve();
    }
    if (!reset && !usersHasMore) {
        return Promise.resolve();
    }

    usersLoading = true;
    updateLoadMoreUsersButton();

    return fetch(buildUsersUrl(reset))
        .then(response => {
            if (!response.ok) {
                throw new Error('Erro ao carregar leitores');
            }

            usersHasMore = response.headers.get('X-Has-More') === '1';
            return response.json();
        })
        .then(data => {
            if (reset) {
                usersOffset = 0;
            }

            renderUsers(data, reset);
            usersOffset += data.length;
            if (usersSummary) {
                usersSummary.textContent = `${usersOffset} leitor(es) carregado(s)${usersHasMore ? ' - há mais resultados' : ''}`;
            }
        })
        .catch(error => {
            console.error(error);
            alertError('Erro ao carregar leitores!');
        })
        .finally(() => {
            usersLoading = false;
            updateLoadMoreUsersButton();
            if (usersPendingReload) {
                usersPendingReload = false;
                loadUsers(true);
            }
        });
}

syncUserFilterControls();
updateUsersLocation();

fetch('/api/config')
    .then(res => res.json())
    .then(data => {
        userMaxEmprestimos = data.max_per_user;
        return loadUsers(true);
    })
    .catch(error => {
        console.error('Error:', error);
        loadUsers(true);
    });

function reloadUsers() {
    usersHasMore = true;
    return loadUsers(true);
}

const modalUsers = document.getElementById('Modal_Leitor');

if (usersPageParams.get('modal')) {
    const valor = usersPageParams.get('modal');
    if (valor == 'new') {
        setModalType('new');
        const myModal = new bootstrap.Modal(modalUsers);
        myModal.show();
    } else {
        fetch(`/api/users/${valor}`)
            .then(response => {
                if (response.status == 404) {
                    alertError('Leitor não encontrado!');
                    return;
                }
                return response.json();
            })
            .then(data => {
                setModalType('edit');
                SelectedLeitor = data.id;
                document.getElementById('leitor-nome').value = data.nome;
                document.getElementById('leitor-contato').value = data.contato;
                $('#leitor-turma').selectpicker('val', data.turma);
                const myModal = new bootstrap.Modal(modalUsers);
                myModal.show();
            });
    }
}

const modal_emp = document.getElementById('Modal_Emprestimos_leitor');

if (usersPageParams.get('emprestimo')) {
    const valor = usersPageParams.get('emprestimo');
    fetch(`/api/users/${valor}`)
        .then(response => {
            if (response.status == 404) {
                alertError('Leitor não encontrado!');
                return;
            }
            return response.json();
        })
        .then(data => {
            if (data.livros_emprestados_ids.length == 0) {
                alertError('Leitor não tem emprestimos!');
                return;
            }

            const idsLivros = data.livros_emprestados_ids.split(',');
            const nomesLivros = data.livros_emprestados_nomes.split(',');
            const emprestimos = [];

            for (let i = 0; i < idsLivros.length; i++) {
                emprestimos.push({
                    id: idsLivros[i],
                    livro: nomesLivros[i]
                });
            }

            const myModal = new bootstrap.Modal(modal_emp);
            myModal.show();

            const cardEmp = document.getElementById('card-todos-os-emprestimos');
            cardEmp.innerHTML = emprestimos.map(emp => genCardsEmp(emp.livro, emp.id)).join('');
        });
}

function setModalType(type) {
    const modal_btn_save_leitor = document.getElementById('modal_btn_save_leitor');
    const modal_btn_edit_leitor = document.getElementById('modal_btn_edit_leitor');

    if (type == 'new') {
        modal_btn_save_leitor.classList.remove('d-none');
        modal_btn_save_leitor.classList.add('d-flex');
        modal_btn_edit_leitor.classList.remove('d-flex');
        modal_btn_edit_leitor.classList.add('d-none');
    } else {
        modal_btn_save_leitor.classList.remove('d-flex');
        modal_btn_save_leitor.classList.add('d-none');
        modal_btn_edit_leitor.classList.remove('d-none');
        modal_btn_edit_leitor.classList.add('d-flex');
    }
}

function addUser() {
    const data = getModalData();
    if (data == undefined) {
        return;
    }

    fetch('/api/users/add', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    }).then(res => {
        res.status == 200 ? alertSucess('Leitor adicionado com sucesso!') : alertError('Erro ao adicionar Leitor!');
        reloadUsers();
        $('#Modal_Leitor').modal('hide');
    }).catch(error => {
        console.error(error);
        alertError('Erro ao adicionar Leitor!');
    });
}

function editUser() {
    const data = getModalData();
    if (data == undefined) {
        return;
    }

    fetch(`/api/users/edit/${SelectedLeitor}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    }).then(res => {
        res.status == 200 ? alertSucess('Leitor atualizado com sucesso!') : alertError('Erro ao atualizar Leitor!');
        reloadUsers();
        $('#Modal_Leitor').modal('hide');
    }).catch(error => {
        console.error(error);
        alertError('Erro ao atualizar Leitor!');
    });
}

function getModalData() {
    const nome = document.getElementById('leitor-nome').value;
    if (nome.length < 1) {
        alertError('Nome do Leitor não pode ser vazio!');
        return;
    }

    const contato = document.getElementById('leitor-contato').value;
    if (contato.length < 1) {
        alertError('Contato do Leitor não pode ser vazio!');
        return;
    }

    const turma = document.getElementById('leitor-turma').value;
    if (turma.length < 1) {
        alertError('Turma do Leitor não pode ser vazio!');
        return;
    }

    return {
        nome,
        contato,
        turma
    };
}

function removeUser(id) {
    pendingUserDeleteId = id;
    fetch(`/api/users/${id}`)
        .then(response => response.ok ? response.json() : null)
        .then(user => {
            showDeleteConfirmation({
                title: 'Excluir leitor',
                message: `Tem certeza que deseja excluir "${user?.nome || `leitor #${id}`}"? Essa ação não pode ser desfeita.`,
                onConfirm: confirmRemoveUser
            });
        })
        .catch(() => {
            showDeleteConfirmation({
                title: 'Excluir leitor',
                message: `Tem certeza que deseja excluir o leitor #${id}? Essa ação não pode ser desfeita.`,
                onConfirm: confirmRemoveUser
            });
        });
}

function confirmRemoveUser() {
    if (!pendingUserDeleteId) {
        return;
    }

    const id = pendingUserDeleteId;
    pendingUserDeleteId = null;

    fetch(`/api/users/remove/${id}`)
        .then(res => {
            res.status == 200 ? alertSucess('Leitor removido com sucesso!') : alertError('Erro ao remover Leitor, Verifique se ele não está emprestado!');
            reloadUsers();
        }).catch(error => {
            console.error(error);
            alertError('Erro ao remover leitor!');
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

function genCardsEmp(name, id) {
    return `
    <div class="card mx-1 my-2">
<div class="card-body d-flex align-items-center justify-content-between">
    <h4 class="card-title mb-0">${escapeHtml(name)}</h4>
    <div><a href="/?emprestimo=${id}" class="btn btn-primary" type="button">Detalhes</a></div>
</div>
</div>
`;
}
