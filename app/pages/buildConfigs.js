const {GenPage} = require("../buildStructure.js");
const configPage = require("../components/config.js")
module.exports = GenPage(3,configPage,`
<script src="/functions/configManager.js"></script>
`)
