const importTargets = {
    books: {
        inputId: 'import-books-file',
        endpoint: '/api/import/books',
        label: 'livros'
    },
    users: {
        inputId: 'import-users-file',
        endpoint: '/api/import/users',
        label: 'leitores'
    }
};

function selectImportFile(kind) {
    const target = importTargets[kind];
    if (!target) {
        alertError('Tipo de importação inválido.');
        return;
    }

    document.getElementById(target.inputId)?.click();
}

function setupImport(kind) {
    const target = importTargets[kind];
    const input = document.getElementById(target.inputId);

    if (!input) {
        return;
    }

    input.addEventListener('change', () => {
        const file = input.files?.[0];
        if (!file) {
            return;
        }

        file.text()
            .then(text => JSON.parse(text))
            .then(data => fetch(target.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            }))
            .then(response => {
                if (!response.ok) {
                    throw new Error('Falha ao importar arquivo');
                }
                return response.json();
            })
            .then(summary => {
                alertSucess(`Importação de ${target.label}: ${summary.created} criado(s), ${summary.updated} atualizado(s), ${summary.skipped} ignorado(s).`);
            })
            .catch(error => {
                console.error(error);
                alertError('Não foi possível importar esse JSON.');
            })
            .finally(() => {
                input.value = '';
            });
    });
}

setupImport('books');
setupImport('users');
