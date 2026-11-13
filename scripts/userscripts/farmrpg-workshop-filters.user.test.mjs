// @vitest-environment node
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { afterEach, expect, test, vi } from 'vitest';

const source = readFileSync(new URL('./farmrpg-workshop-filters.user.js', import.meta.url), 'utf8');
let dom;
let observer;

afterEach(() => {
  observer?.disconnect();
  dom?.window.close();
});

function row(name, ingredient, max, price, control) {
  return `<li data-name="${name}">
    <div class="item-title"><strong>${name}</strong>
      <span>20 / <span data-amt="1">10</span> ${ingredient}<br></span>
      <input class="qty" type="number" value="1" data-max="${max}" data-price="${price}">
    </div>
    <div class="item-after">${control ?? '<button class="btngreen">10 Silver</button>'}</div>
  </li>`;
}

function openWorkshop() {
  dom = new JSDOM(`<div class="page page-on-center" data-page="workshop">
    <form class="searchbar"><input class="workshopsearch"></form>
    <div class="searchbar-overlay"></div>
    <div class="page-content">
    <div class="favcraftitems"><ul>${row('Favorite', 'Steel', 5, 6)}</ul></div>
    <div class="craftitems"><ul>
      ${row('Low quantity', 'Steel Wire', 2, 30)}
      ${row('Missing', 'Steel', 0, 1, '<button disabled>Missing Res</button>')}
      ${row('High quantity', 'Board', 9, 3)}
      ${row('Full', 'Steel', 5, 1, '<button>Inv Full</button>')}
      ${row('Craftworks', 'Oak', 4, 1, '<a href="craftworks.php">In Craftworks</a>')}
    </ul></div>
    </div>
  </div>`, {
    url: 'https://farmrpg.com/#!/workshop.php',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  window.MutationObserver = class extends window.MutationObserver {
    constructor(callback) {
      super(callback);
      observer = this;
    }
  };
  const gameRequest = vi.fn();
  window.fetch = gameRequest;
  window.XMLHttpRequest = gameRequest;
  window.eval(source);
  const find = selector => window.document.querySelector(selector);
  const names = (list = '.craftitems', visibleOnly = false) =>
    [...window.document.querySelectorAll(`${list} li[data-name]`)]
      .filter(item => !visibleOnly || !item.classList.contains('frpg-workshop-filtered'))
      .map(item => item.dataset.name);
  const settle = () => new Promise(resolve => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
  });
  async function change(selector, value) {
    const control = find(selector);
    if (typeof value === 'boolean') control.checked = value;
    else control.value = value;
    control.dispatchEvent(new window.Event('change', { bubbles: true }));
    await settle();
  }
  return { window, gameRequest, find, names, settle, change };
}

test('mounts inside the Workshop scroll area and ignores a second copy', async () => {
  const { window, find, settle, change, names } = openWorkshop();
  const panel = find('#frpg-workshop-filters');
  expect(panel).toBe(find('.page-content').firstElementChild);
  expect(find('.searchbar').nextElementSibling).toBe(find('.searchbar-overlay'));
  const firstObserver = observer;
  window.eval(source);
  await settle();
  expect(observer).toBe(firstObserver);
  expect(window.document.querySelectorAll('#frpg-workshop-filters')).toHaveLength(1);
  await change('[name="craftable"]', true);
  expect(names('.craftitems', true)).toEqual(['Low quantity', 'High quantity']);
});

test('sorts existing rows by maximum and full-batch price and restores Workshop order', async () => {
  const { gameRequest, find, names, settle, change } = openWorkshop();
  const originalOrder = names();
  const button = find('[data-name="High quantity"] .item-after button');
  const click = vi.fn();
  button.addEventListener('click', click);
  await change('select', 'quantity');
  expect(names()).toEqual(['High quantity', 'Low quantity', 'Missing', 'Full', 'Craftworks']);
  expect(names('.favcraftitems')).toEqual(['Favorite']);
  await change('select', 'silver-desc');
  expect(names().slice(0, 2)).toEqual(['Low quantity', 'High quantity']);
  await change('select', 'silver-asc');
  expect(names().slice(0, 2)).toEqual(['High quantity', 'Low quantity']);
  find('#frpg-workshop-filters button').click();
  await settle();
  expect(names()).toEqual(originalOrder);
  expect(find('[data-name="High quantity"] .item-after button')).toBe(button);
  expect(click).not.toHaveBeenCalled();
  expect(gameRequest).not.toHaveBeenCalled();
});

test('combines exact ingredient matches with craftability and rechecks redrawn rows', async () => {
  const { window, find, names, settle, change } = openWorkshop();
  await change('[value="steel"]', true);
  expect(names('.craftitems', true)).toEqual(['Missing', 'Full']);
  await change('[value="board"]', true);
  await change('[name="craftable"]', true);
  expect(names('.craftitems', true)).toEqual(['High quantity']);
  find('[data-name="Missing"]').outerHTML = row('Newly ready', 'Steel', 7, 2);
  await settle();
  expect(names('.craftitems', true)).toEqual(['Newly ready', 'High quantity']);
  window.location.hash = '#!/inventory.php';
  await settle();
  expect(find('#frpg-workshop-filters')).toBeNull();
  expect(names('.craftitems', true)).toEqual(names());
});
