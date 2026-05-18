module.exports = `
<div id="Modal_Confirm_Delete" class="modal fade" role="dialog" tabindex="-1">
    <div class="modal-dialog modal-dialog-centered" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h4 id="confirm-delete-title" class="modal-title">Confirmar exclusão</h4>
                <button class="btn-close" aria-label="Close" data-bs-dismiss="modal" type="button"></button>
            </div>
            <div class="modal-body">
                <p id="confirm-delete-message" class="mb-0">Tem certeza que deseja excluir este registro?</p>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline-primary" data-bs-dismiss="modal" type="button">Cancelar</button>
                <button id="confirm-delete-action" class="btn btn-danger" type="button">Excluir</button>
            </div>
        </div>
    </div>
</div>
`;
