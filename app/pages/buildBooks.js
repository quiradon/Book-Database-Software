const {GenPage} = require("../buildStructure.js");
const {page} = require("../components/booksBar.js")
const modalDevolva = require("../components/modalDevolva.js")
const modalConfirmDelete = require("../components/modalConfirmDelete.js")

async function BooksPage (selectedPage = 0) {
    let {genModalLeitores} = require("../components/modalLeitores.js")
    const modalLeitos = await genModalLeitores()
    let {modal} = require("../components/modalBooks.js")
    return GenPage(selectedPage,page(),`
    <script src="/functions/loadBooks.js"></script>
    `,
    `
    ${modal}
    ${modalLeitos}
    ${modalDevolva}
    ${modalConfirmDelete}
    `)

}

module.exports = {
    BooksPage
}
