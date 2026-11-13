// ==UserScript==
// @name         Farm RPG Workshop Filters
// @namespace    https://github.com/liquidthex/farmrpg-tools
// @version      1.0.0
// @description  Filter Workshop recipes and sort by craftable quantity or full-batch silver.
// @match        https://farmrpg.com/*
// @match        https://www.farmrpg.com/*
// @run-at       document-idle
// @noframes
// @grant        none
// @license      MIT
// ==/UserScript==

(function workshopFilters() {
  'use strict';

  const pageSelector = '.page[data-page="workshop"]:is(.page-on-center, .page-current)';
  const listSelector = '.favcraftitems > ul, .craftitems > ul';
  const rowSelector = 'li[data-name]';
  const hiddenClass = 'frpg-workshop-filtered';
  const ingredients = ['Wood', 'Board', 'Wooden Plank', 'Twine', 'Rope', 'Steel', 'Steel Wire', 'Oak', 'Stone', 'Coal'];
  const originalOrders = new Map();
  let activePage;
  let panel;
  let frame;

  function currentWorkshop() {
    const route = window.location.hash.startsWith('#!/')
      ? window.location.hash.slice(2).split('?')[0]
      : window.location.pathname;
    return route === '/workshop.php' ? document.querySelector(pageSelector) : null;
  }

  function readRecipe(row) {
    const button = row.querySelector('.item-after button.btngreen');
    const quantity = row.querySelector('.item-title input.qty[data-max][data-price]');
    const max = readInteger(quantity?.getAttribute('data-max'));
    const unitPrice = readInteger(quantity?.getAttribute('data-price'));
    const craftable = Boolean(button && !button.disabled && max > 0);
    const cost = max * unitPrice;
    return {
      row,
      craftable,
      max: craftable ? max : 0,
      cost: craftable && unitPrice !== null && Number.isSafeInteger(cost) ? cost : null,
      ingredients: new Set(Array.from(row.querySelectorAll('.item-title span[data-amt]'), amount =>
        amount.nextSibling?.textContent.trim().toLowerCase()
      )),
    };
  }

  function readInteger(value) {
    if (!value || !/^\d+$/.test(value)) return null;
    const number = Number(value);
    return Number.isSafeInteger(number) ? number : null;
  }

  function createPanel() {
    const element = document.createElement('section');
    element.id = 'frpg-workshop-filters';
    element.setAttribute('aria-label', 'Workshop filters');
    element.innerHTML = `
      <style>
        .${hiddenClass} { display: none !important; }
        #frpg-workshop-filters { margin: 12px 16px; }
        #frpg-workshop-filters .frpg-controls {
          display: flex; align-items: center; flex-wrap: wrap; gap: 8px 16px;
        }
        #frpg-workshop-filters :is(select, button) { font: inherit; }
        #frpg-workshop-filters summary { cursor: pointer; }
        #frpg-workshop-filters .frpg-ingredients {
          display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 8px;
        }
        #frpg-workshop-filters label { white-space: nowrap; }
      </style>
      <div class="frpg-controls">
        <label><input type="checkbox" name="craftable"> Craftable now</label>
        <label>Sort <select name="order">
          <option value="">Workshop order</option>
          <option value="quantity">Most craftable</option>
          <option value="silver-asc">Batch silver: low to high</option>
          <option value="silver-desc">Batch silver: high to low</option>
        </select></label>
        <button type="button">Reset</button>
      </div>
      <details>
        <summary>Uses any selected ingredient</summary>
        <div class="frpg-ingredients">${ingredients.map(name =>
          `<label><input type="checkbox" name="ingredient" value="${name.toLowerCase()}"> ${name}</label>`
        ).join('')}</div>
      </details>`;
    element.addEventListener('change', scheduleUpdate);
    element.querySelector('button').addEventListener('click', () => {
      for (const checkbox of element.querySelectorAll('input:checked')) checkbox.checked = false;
      element.querySelector('select').value = '';
      scheduleUpdate();
    });
    return element;
  }

  function reorder(list, rows, desired) {
    // Move existing rows so game handlers and input state stay attached.
    for (let index = 0; index < desired.length; index++) {
      if (rows[index] === desired[index]) continue;
      list.insertBefore(desired[index], rows[index]);
      rows.splice(rows.indexOf(desired[index], index), 1);
      rows.splice(index, 0, desired[index]);
    }
  }

  function updateList(list, order, craftableOnly, selected) {
    const rows = Array.from(list.children).filter(row => row.matches(rowSelector));
    const current = new Set(rows);
    const previous = originalOrders.get(list);
    const original = previous ? previous.filter(row => current.has(row)) : [...rows];
    const remembered = new Set(original);
    original.push(...rows.filter(row => !remembered.has(row)));
    if (order) originalOrders.set(list, original);
    else originalOrders.delete(list);

    const recipes = original.map(readRecipe);
    for (const recipe of recipes) {
      const matchesIngredient = selected.length === 0 || selected.some(name => recipe.ingredients.has(name));
      recipe.row.classList.toggle(hiddenClass, !matchesIngredient || (craftableOnly && !recipe.craftable));
    }

    if (order === 'quantity') recipes.sort((a, b) => b.max - a.max);
    if (order.startsWith('silver-')) {
      const direction = order === 'silver-asc' ? 1 : -1;
      recipes.sort((a, b) => {
        if (a.cost === null || b.cost === null) return Number(a.cost === null) - Number(b.cost === null);
        return direction * (a.cost - b.cost);
      });
    }
    reorder(list, rows, recipes.map(recipe => recipe.row));
  }

  function update() {
    frame = undefined;
    observer.disconnect();
    try {
      const page = currentWorkshop();
      if (page !== activePage) {
        for (const [list, original] of originalOrders) {
          const rows = Array.from(list.children).filter(row => row.matches(rowSelector));
          const known = original.filter(row => row.parentElement === list);
          reorder(list, rows, [...known, ...rows.filter(row => !known.includes(row))]);
        }
        for (const row of activePage?.querySelectorAll(`.${hiddenClass}`) ?? []) row.classList.remove(hiddenClass);
        originalOrders.clear();
        panel?.remove();
        activePage = page;
      }
      if (!page) return;
      const search = page.querySelector('form.searchbar:has(.workshopsearch)');
      if (!search) return;
      if (!panel) panel = createPanel();
      if (search.nextElementSibling !== panel) search.after(panel);

      const lists = Array.from(page.querySelectorAll(listSelector));
      for (const list of originalOrders.keys()) {
        if (!lists.includes(list)) originalOrders.delete(list);
      }
      const order = panel.querySelector('select').value;
      const craftableOnly = panel.querySelector('[name="craftable"]').checked;
      const selected = Array.from(panel.querySelectorAll('[name="ingredient"]:checked'), input => input.value);
      for (const list of lists) updateList(list, order, craftableOnly, selected);
    } finally {
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['class', 'data-page', 'data-name', 'data-price', 'data-max', 'data-amt', 'disabled'],
      });
    }
  }

  function scheduleUpdate() {
    if (frame === undefined) frame = window.requestAnimationFrame(update);
  }

  const observer = new MutationObserver(records => {
    if (currentWorkshop() !== activePage || records.some(({ target }) =>
      activePage?.contains(target) && !panel?.contains(target)
    )) scheduleUpdate();
  });
  window.addEventListener('hashchange', scheduleUpdate);
  window.addEventListener('popstate', scheduleUpdate);
  update();
})();
