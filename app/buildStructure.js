
const {genNav} = require('./components/navbar.js');
const alerts = require('./components/alerts.js');
function GenPage(navIndex, content, scripts, bodyExtra) {
    let searchEnable = false
    if (navIndex == 0 || navIndex == 2) {
        searchEnable = true
    }
    return `
    <!DOCTYPE html>
    <html data-bs-theme="dark" lang="pt-br">
        <head>
            <title>Book DB</title>
            <link rel="stylesheet" href="/assets/bootstrap/css/bootstrap.min.css">
            <link rel="stylesheet" href="/assets/css/styles.css">
            <link rel="stylesheet" href="/assets/css_bootstrap-select.min.css">
        </head>
        <body>
        ${alerts}
        ${bodyExtra ?? ""}
        <div class="container-fluid">
        <div class="row">
        ${content}
        ${genNav(navIndex, searchEnable)}
        </div>
        </div>
        <script src="/assets/js/jquery.min.js"></script>
        <script src="/assets/bootstrap/js/bootstrap.min.js"></script>
        <script src="/assets/bootstrap-select.min.js"></script>
        <script src="/functions/alerts.js"></script>
        ${scripts ?? ""}
        <script src="/functions/macros.js"></script>
        </body>
        `
}
module.exports = {
    GenPage
}
