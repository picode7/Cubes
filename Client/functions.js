function elementFromHTML(html) {
    var div = document.createElement('div');
    div.innerHTML = html;
    var el = div.firstElementChild;
    div.removeChild(el);
    return el;
}
//# sourceMappingURL=functions.js.map