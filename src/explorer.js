/**
 * @import { Triple } from './concepts.js'
 */

/**
 * @typedef {'subject'|'relation'|'object'} SortColumn
 * @typedef {'asc'|'desc'} SortDir
 */

/**
 * Build the concepts explorer: a searchable, sortable table of all triples.
 * @param {HTMLElement} container
 * @param {Triple[]} triples
 */
export function buildExplorer(container, triples) {
  container.innerHTML = ''

  /** @type {SortColumn} */
  let sortCol = 'subject'
  /** @type {SortDir} */
  let sortDir = 'asc'
  let query = ''

  // ── Search bar ──
  const searchRow = document.createElement('div')
  searchRow.className = 'explorer-search-row'

  const searchInput = document.createElement('input')
  searchInput.type = 'text'
  searchInput.className = 'explorer-search'
  searchInput.placeholder = 'search concepts...'
  searchInput.setAttribute('aria-label', 'search concepts')

  const countEl = document.createElement('span')
  countEl.className = 'explorer-count'

  searchRow.append(searchInput, countEl)
  container.appendChild(searchRow)

  // ── Table ──
  const table = document.createElement('table')
  table.className = 'explorer-table'

  const thead = document.createElement('thead')
  const headerRow = document.createElement('tr')

  /** @type {Array<{ col: SortColumn, label: string }>} */
  const columns = [
    { col: 'subject', label: 'subject' },
    { col: 'relation', label: 'relation' },
    { col: 'object', label: 'object' },
  ]

  const thEls = columns.map(({ col, label }) => {
    const th = document.createElement('th')
    th.className = 'explorer-th'
    th.dataset['col'] = col
    th.textContent = label
    th.addEventListener('click', () => {
      if (sortCol === col) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc'
      } else {
        sortCol = col
        sortDir = 'asc'
      }
      render()
    })
    return th
  })

  headerRow.append(...thEls)
  thead.appendChild(headerRow)
  table.appendChild(thead)

  const tbody = document.createElement('tbody')
  table.appendChild(tbody)
  container.appendChild(table)

  // ── Render ──
  function render() {
    // Update sort indicators on headers
    for (const th of thEls) {
      const col = th.dataset['col']
      th.classList.toggle('sort-active', col === sortCol)
      th.classList.toggle('sort-asc', col === sortCol && sortDir === 'asc')
      th.classList.toggle('sort-desc', col === sortCol && sortDir === 'desc')
    }

    const q = query.toLowerCase().trim()

    const filtered = q
      ? triples.filter(([s, r, o]) =>
          s.includes(q) || r.includes(q) || o.includes(q)
        )
      : triples.slice()

    const colIndex = sortCol === 'subject' ? 0 : sortCol === 'relation' ? 1 : 2
    filtered.sort((a, b) => {
      const cmp = a[colIndex].localeCompare(b[colIndex])
      return sortDir === 'asc' ? cmp : -cmp
    })

    countEl.textContent = `${filtered.length} of ${triples.length}`

    tbody.innerHTML = ''
    for (const [subject, relation, object] of filtered) {
      const tr = document.createElement('tr')
      tr.className = 'explorer-row'

      const tdS = document.createElement('td')
      tdS.className = 'explorer-td concept'
      tdS.textContent = subject

      const tdR = document.createElement('td')
      tdR.className = `explorer-td relation rel-${relation}`
      tdR.textContent = relation

      const tdO = document.createElement('td')
      tdO.className = 'explorer-td concept'
      tdO.textContent = object

      // Clicking a concept cell filters to that concept
      for (const [td, text] of /** @type {[HTMLElement, string][]} */ ([[tdS, subject], [tdO, object]])) {
        td.classList.add('clickable')
        td.title = `filter: ${text}`
        td.addEventListener('click', () => {
          searchInput.value = text
          query = text.toLowerCase()
          render()
          searchInput.focus()
        })
      }

      tr.append(tdS, tdR, tdO)
      tbody.appendChild(tr)
    }
  }

  searchInput.addEventListener('input', () => {
    query = searchInput.value.toLowerCase()
    render()
  })

  render()
}
