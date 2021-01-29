
function elementFromHTML(html: string): HTMLElement {
    let div = document.createElement('div')
    div.innerHTML = html
    let el = <HTMLElement>div.firstElementChild
    div.removeChild(el)
    return el
}
