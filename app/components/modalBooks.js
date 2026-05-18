const tags = require("../../configs.json").tags
let tagsOptions = ""
tags.forEach(tag => {
    tagsOptions += `<option value="${tag}">${tag}</option>`
})
let modal = `<div id="Modal_Livro" class="modal fade" role="dialog" tabindex="-1" >
<div class="modal-dialog modal-lg modal-dialog-centered" role="document">
    <div class="modal-content">
        <div class="modal-header">
            <h4 class="modal-title"><svg class="mb-1 me-2" xmlns="http://www.w3.org/2000/svg" viewBox="-32 0 512 512" width="1em" height="1em" fill="currentColor">
                    <path d="M96 0C43 0 0 43 0 96V416c0 53 43 96 96 96H384h32c17.7 0 32-14.3 32-32s-14.3-32-32-32V384c17.7 0 32-14.3 32-32V32c0-17.7-14.3-32-32-32H384 96zm0 384H352v64H96c-17.7 0-32-14.3-32-32s14.3-32 32-32zm32-240c0-8.8 7.2-16 16-16H336c8.8 0 16 7.2 16 16s-7.2 16-16 16H144c-8.8 0-16-7.2-16-16zm16 48H336c8.8 0 16 7.2 16 16s-7.2 16-16 16H144c-8.8 0-16-7.2-16-16s7.2-16 16-16z"></path>
                </svg>Livro</h4><button class="btn-close" aria-label="Close" data-bs-dismiss="modal" type="button"></button>
        </div>
        <div class="modal-body">
            <form>
                <p class="text-start mb-1"><span style="font-weight: normal !important;">Nome: </span></p><input id="book-name" class="form-control form-control-sm" type="text" required minlength="1" autocomplete="on" inputmode="verbatim" placeholder="Grimorio de Inanimalia Fortuna" />
                <p class="text-start mb-1"><span style="font-weight: normal !important;">Autor: </span></p><input id="book-autor" class="form-control form-control-sm" type="text" required minlength="1" autocomplete="on" inputmode="verbatim" placeholder="Inanimalia" />
                <p class="text-start mb-1"><span style="font-weight: normal !important;">Editora: </span></p><input id="book-editora" class="form-control form-control-sm" type="text" required minlength="1" autocomplete="on" inputmode="verbatim" placeholder="Arkanus" />
                <p class="text-start mb-1"><span style="font-weight: normal !important;">ISBN (opcional): </span></p><div class="input-group input-group-sm"><input id="book-isbn" class="form-control form-control-sm" type="text" placeholder="000.000.000-00" autocomplete="off" /><button id="book-isbn-lookup" class="btn btn-outline-primary" type="button">Buscar ISBN</button></div>
                <p class="text-start mb-1"><span style="font-weight: normal !important;">Quantidade de exemplares: </span></p><input id="book-copy-total" class="form-control form-control-sm" type="number" min="1" max="999" value="1" required />
                <div id="book-copy-summary" class="copy-summary mt-2 mb-2"></div>
                <p class="text-start mb-1"><span style="font-weight: normal !important;">Tags: </span></p><select id="book-tags" class="bg-dark form-select form-select-sm selectpicker p-0" data-live-search="true" data-width="100%" data-bs-theme="dark" multiple data-max-options="3" data-style="btn-dark" required>
                    ${tagsOptions}
                </select>
                <div class="col text-end d-flex justify-content-md-end"><button onclick="addBook()" id="modal_btn_save_book" class="btn btn-primary d-flex align-items-center align-content-center mt-4" type="button"><svg class="m-1" xmlns="http://www.w3.org/2000/svg" viewBox="-32 0 512 512" width="1em" height="1em" fill="currentColor">
                            <path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32V224H48c-17.7 0-32 14.3-32 32s14.3 32 32 32H192V432c0 17.7 14.3 32 32 32s32-14.3 32-32V288H400c17.7 0 32-14.3 32-32s-14.3-32-32-32H256V80z"></path>
                        </svg>Adicionar Livro</button><button id="modal_btn_edit_book" onclick="editBook()"class="btn btn-primary d-flex align-items-center align-content-center mt-4" type="button"><svg class="m-1" xmlns="http://www.w3.org/2000/svg" viewBox="-32 0 512 512" width="1em" height="1em" fill="currentColor">
                            <path d="M64 32C28.7 32 0 60.7 0 96V416c0 35.3 28.7 64 64 64H384c35.3 0 64-28.7 64-64V173.3c0-17-6.7-33.3-18.7-45.3L352 50.7C340 38.7 323.7 32 306.7 32H64zm0 96c0-17.7 14.3-32 32-32H288c17.7 0 32 14.3 32 32v64c0 17.7-14.3 32-32 32H96c-17.7 0-32-14.3-32-32V128zM224 288a64 64 0 1 1 0 128 64 64 0 1 1 0-128z"></path>
                        </svg>Salvar Edição</button></div>
            </form>
        </div>
    </div>
</div>
</div>
`

module.exports = {
    modal
}
