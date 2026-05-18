const {GenPage} = require("../buildStructure.js");
const {page} = require("../components/bookDetailPage.js");

function BookDetailPage() {
    return GenPage(0, page(), `
    <script src="/functions/loadBookDetail.js"></script>
    `);
}

module.exports = {
    BookDetailPage
};
