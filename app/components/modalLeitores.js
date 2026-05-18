async function genModalLeitores() {
    return `
            <div id="Modal_Emprestimo" class="modal fade" role="dialog" tabindex="-1">
    <div class="modal-dialog modal-lg modal-dialog-centered" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h4 class="modal-title"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="1em" height="1em" fill="currentColor">
                        <path d="M96 0C60.7 0 32 28.7 32 64V448c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V64c0-35.3-28.7-64-64-64H96zM208 288h64c44.2 0 80 35.8 80 80c0 8.8-7.2 16-16 16H144c-8.8 0-16-7.2-16-16c0-44.2 35.8-80 80-80zm-32-96a64 64 0 1 1 128 0 64 64 0 1 1 -128 0zM512 80c0-8.8-7.2-16-16-16s-16 7.2-16 16v64c0 8.8 7.2 16 16 16s16-7.2 16-16V80zM496 192c-8.8 0-16 7.2-16 16v64c0 8.8 7.2 16 16 16s16-7.2 16-16V208c0-8.8-7.2-16-16-16zm16 144c0-8.8-7.2-16-16-16s-16 7.2-16 16v64c0 8.8 7.2 16 16 16s16-7.2 16-16V336z"></path>
                    </svg> Realizar Emprestimo</h4><button class="btn-close" aria-label="Close" data-bs-dismiss="modal" type="button"></button>
            </div>
            <div class="modal-body">
                <form>
                    <p class="mb-2">Livro: <strong id="nome_do_livro_titulo_emprestimo">Bold</strong></p>
                    <p class="mb-2">Leitor</p><select id="seletor_leitor_emprestimo" class="form-select selectpicker p-0" data-live-search="true" data-width="100%" data-bs-theme="dark" data-max-options="1" data-style="btn-dark" required>
                        <option value="">Carregando leitores...</option>
                    </select>
                    <p class="mb-2">Exemplar</p><select id="seletor_exemplar_emprestimo" class="form-select" required>
                        <option value="">Carregando exemplares...</option>
                    </select>
                    <p class="mb-2">Prazo de Devolução</p><select id="seletor_de_tempo_do_emprestimo" class="form-select">
                        <option value="3">3 Dias</option>
                        <option value="7" selected>7 Dias</option>
                        <option value="15">15 Dias</option>
                        <option value="30">30 Dias</option>
                        <option value="45">45 Dias</option>
                    </select>
                </form>
                <div class="row">
                    <div class="col text-end mt-5"><button onclick="emprestimo()" class="btn btn-primary" type="button">Emprestar</button></div>
                </div>
            </div>
        </div>
    </div>
</div>
            `;
}

module.exports = {
    genModalLeitores
};
