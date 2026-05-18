const {GenPage} = require("../buildStructure.js");
const {page} = require("../components/usersBar.js")
const modalFinal = require("../components/modalTodosOsEmp")
const modalConfirmDelete = require("../components/modalConfirmDelete.js")
function requireUncached(module){
    delete require.cache[require.resolve(module)]
    return require(module)
}


function UsersPage () {
    
    let {modal} = require("../components/modalUsers.js")
    return GenPage(2,page(),`
    <script src="/functions/loadUsers.js"></script>
    `,
    `
    ${modal}
    ${modalFinal}
    ${modalConfirmDelete}
    `)

}

module.exports = {
    UsersPage
}
