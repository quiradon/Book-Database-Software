const {GenPage} = require("../buildStructure.js");
const {page} = require("../components/labelsBar.js");

function LabelsPage() {
    return GenPage(3, page(), `
    <script src="/functions/loadLabels.js"></script>
    `);
}

module.exports = {
    LabelsPage
};
