const {GenPage} = require("../buildStructure.js");
const {page} = require("../components/historyBar.js");

function HistoryPage() {
    return GenPage(3, page(), `
    <script src="/functions/loadHistory.js"></script>
    `);
}

module.exports = {
    HistoryPage
};
