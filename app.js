const CATEGORIES = ['Chilled', 'Frozen', 'Veg', 'Store cupboard', 'Home'];
const DEFAULT_SHOPS = ['Tesco', 'Waitrose', 'M&S'];
const DAYS = [
  ['monday', 'Monday'],
  ['tuesday', 'Tuesday'],
  ['wednesday', 'Wednesday'],
  ['thursday', 'Thursday'],
  ['friday', 'Friday'],
  ['saturday', 'Saturday'],
  ['sunday', 'Sunday'],
];
const SLOTS = [
  ['lunch', 'Lunch'],
  ['dinner', 'Dinner'],
];
const STORAGE_KEY = 'shopping-list-v1';
const THEME_KEY = 'shopping-list-theme';
const TAB_KEY = 'shopping-list-tab';

const CATEGORY_CLASS = {
  Chilled: 'chilled',
  Frozen: 'frozen',
  Veg: 'veg',
  'Store cupboard': 'cupboard',
  Home: 'home',
};

const CHECK_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 9.2 17 19 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const PENCIL_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0 0-3L17.5 5a2.1 2.1 0 0 0-3 0L4 15.5V20Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12.5 7.5l4 4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
const PLUS_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

const $ = (id) => document.getElementById(id);

const state = load();
let confirming = null;
let deleteArmed = false;
let returnFocus = null;
let heldShop = '';

const draft = {
  mode: 'add',
  id: null,
  category: '',
  shop: '',
  mealLabel: '',
  mealName: '',
};

function defaultMeals() {
  return Object.fromEntries(DAYS.map(([id]) => [id, { lunch: '', dinner: '' }]));
}

function defaultState() {
  return {
    items: [],
    customShops: [],
    meals: defaultMeals(),
    shopFilter: 'all',
    lastCategory: '',
    lastShop: '',
  };
}

function clean(value, max) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function sameShop(a, b) {
  return String(a || '').toLowerCase() === String(b || '').toLowerCase();
}

function uid() {
  if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function announce(message) {
  const live = $('live');
  live.textContent = '';
  window.setTimeout(() => {
    live.textContent = message;
  }, 20);
}

function icon(markup) {
  const holder = document.createElement('span');
  holder.innerHTML = markup;
  return holder.firstElementChild;
}

function shopNames(source) {
  const names = [];
  const add = (shop) => {
    const value = clean(shop, 40);
    if (!value || names.some((existing) => sameShop(existing, value))) return;
    names.push(value);
  };
  DEFAULT_SHOPS.forEach(add);
  source.customShops.forEach(add);
  source.items.forEach((item) => add(item.shop));
  return names;
}

function normaliseItem(item) {
  if (!item || typeof item !== 'object') return null;
  const name = clean(item.name, 80);
  const shop = clean(item.shop, 40);
  if (!name || !shop) return null;
  return {
    id: typeof item.id === 'string' && item.id ? item.id : uid(),
    name,
    category: CATEGORIES.includes(item.category) ? item.category : 'Store cupboard',
    quantity: clean(item.quantity, 24),
    shop,
    ticked: Boolean(item.ticked),
    created: Number.isFinite(item.created) ? item.created : Date.now(),
  };
}

function normalise(data) {
  const next = defaultState();
  if (!data || typeof data !== 'object') return next;

  if (Array.isArray(data.customShops)) {
    const seen = new Set();
    next.customShops = data.customShops
      .filter((shop) => typeof shop === 'string')
      .map((shop) => clean(shop, 40))
      .filter((shop) => shop && !DEFAULT_SHOPS.some((preset) => sameShop(preset, shop)))
      .filter((shop) => {
        const key = shop.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.localeCompare(b, 'en-GB'));
  }

  if (Array.isArray(data.items)) {
    next.items = data.items.map(normaliseItem).filter(Boolean);
  }

  if (data.meals && typeof data.meals === 'object') {
    DAYS.forEach(([id]) => {
      const day = data.meals[id] || {};
      next.meals[id] = {
        lunch: typeof day.lunch === 'string' ? day.lunch.slice(0, 80) : '',
        dinner: typeof day.dinner === 'string' ? day.dinner.slice(0, 80) : '',
      };
    });
  }

  if (typeof data.shopFilter === 'string' && data.shopFilter) next.shopFilter = data.shopFilter;
  if (CATEGORIES.includes(data.lastCategory)) next.lastCategory = data.lastCategory;
  if (typeof data.lastShop === 'string') next.lastShop = clean(data.lastShop, 40);

  const known = new Set(['all', ...shopNames(next).map((shop) => shop.toLowerCase())]);
  if (!known.has(String(next.shopFilter).toLowerCase())) next.shopFilter = 'all';
  else if (next.shopFilter !== 'all') {
    const match = shopNames(next).find((shop) => sameShop(shop, next.shopFilter));
    if (match) next.shopFilter = match;
  }
  return next;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return normalise(JSON.parse(raw));
  } catch (error) {
    return defaultState();
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    announce('Could not save on this device.');
  }
}

function canonicalShop(value) {
  const typed = clean(value, 40);
  if (!typed) return '';
  const known = [...DEFAULT_SHOPS, ...state.customShops, ...state.items.map((item) => item.shop)];
  return known.find((shop) => sameShop(shop, typed)) || typed;
}

function rememberShop(shop) {
  if (!shop || DEFAULT_SHOPS.some((preset) => sameShop(preset, shop))) return;
  if (state.customShops.some((existing) => sameShop(existing, shop))) return;
  state.customShops.push(shop);
  state.customShops.sort((a, b) => a.localeCompare(b, 'en-GB'));
}

function visibleItems() {
  if (state.shopFilter === 'all') return state.items.slice();
  return state.items.filter((item) => sameShop(item.shop, state.shopFilter));
}

function plural(count, singular, pluralForm) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function render() {
  renderSummary();
  renderFilters();
  renderList();
  renderWeekActions();
}

function renderSummary() {
  const items = visibleItems();
  const open = items.filter((item) => !item.ticked).length;
  const ticked = items.length - open;
  const where = state.shopFilter === 'all' ? '' : ` at ${state.shopFilter}`;
  let text = open === 0 ? `Nothing to buy${where}` : `${plural(open, 'item', 'items')} to buy${where}`;
  if (ticked) text += ` · ${ticked} ticked`;
  $('summary').textContent = text;
}

function renderFilters() {
  const bar = $('filters');
  bar.replaceChildren();
  const filters = ['all', ...shopNames(state)];
  if (!filters.some((shop) => sameShop(shop, state.shopFilter))) state.shopFilter = 'all';

  filters.forEach((shop) => {
    const pressed = sameShop(shop, state.shopFilter);
    const count = state.items.filter((item) => (
      !item.ticked && (shop === 'all' || sameShop(item.shop, shop))
    )).length;
    const label = shop === 'all' ? 'All' : shop;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    button.textContent = count ? `${label} ${count}` : label;
    button.addEventListener('click', () => {
      state.shopFilter = shop === 'all' ? 'all' : canonicalShop(shop);
      if (confirming === 'ticked') confirming = null;
      save();
      render();
    });
    bar.append(button);
  });

  const selected = bar.querySelector('[aria-pressed="true"]');
  if (selected) {
    const left = selected.offsetLeft;
    const right = left + selected.offsetWidth;
    if (left < bar.scrollLeft) bar.scrollLeft = left - 16;
    else if (right > bar.scrollLeft + bar.clientWidth) {
      bar.scrollLeft = right - bar.clientWidth + 16;
    }
  }
}

function renderList() {
  const root = $('list');
  const items = visibleItems();
  root.replaceChildren();

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    const title = document.createElement('strong');
    title.textContent = state.shopFilter === 'all'
      ? 'Your list is empty'
      : `Nothing from ${state.shopFilter}`;
    const copy = document.createElement('p');
    copy.textContent = state.shopFilter === 'all'
      ? 'Add what you need, then filter by shop when you get there.'
      : 'Add an item for this shop, or choose another filter.';
    empty.append(title, copy);
    root.append(empty);
    return;
  }

  const open = items.filter((item) => !item.ticked).sort((a, b) => a.created - b.created);
  const ticked = items.filter((item) => item.ticked).sort((a, b) => a.created - b.created);
  if (!ticked.length && confirming === 'ticked') confirming = null;

  CATEGORIES.forEach((category) => {
    const group = open.filter((item) => item.category === category);
    if (!group.length) return;
    const section = document.createElement('section');
    section.append(categoryHeading(category));
    const list = document.createElement('ul');
    list.className = 'items';
    group.forEach((item) => list.append(itemRow(item, false)));
    section.append(list);
    root.append(section);
  });

  if (!ticked.length) return;

  const heading = document.createElement('div');
  heading.className = 'ticked-head';
  const title = document.createElement('h2');
  title.textContent = 'Ticked';
  heading.append(title);

  if (confirming === 'ticked') {
      const scope = state.shopFilter === 'all'
        ? 'Clear all ticked items?'
        : `Clear ticked items from ${state.shopFilter}?`;
      heading.append(confirmBar(
      scope,
      () => {
        const ids = new Set(ticked.map((item) => item.id));
        state.items = state.items.filter((item) => !ids.has(item.id));
        confirming = null;
        save();
        announce('Cleared ticked items.');
        render();
      },
      () => {
        confirming = null;
        render();
      }
    ));
  } else {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ghost';
    button.id = 'clear-ticked';
    button.textContent = 'Clear ticked items';
    button.addEventListener('click', () => {
      confirming = 'ticked';
      render();
    });
    heading.append(button);
  }

  const list = document.createElement('ul');
  list.className = 'items';
  ticked.forEach((item) => list.append(itemRow(item, true)));
  root.append(heading, list);
}

function categoryHeading(category) {
  const heading = document.createElement('h2');
  heading.className = 'category';
  const dot = document.createElement('span');
  dot.className = `dot ${CATEGORY_CLASS[category] || 'cupboard'}`;
  dot.setAttribute('aria-hidden', 'true');
  heading.append(dot, document.createTextNode(category));
  return heading;
}

function itemRow(item, showCategory) {
  const row = document.createElement('li');
  row.className = `item${item.ticked ? ' is-ticked' : ''}`;
  row.dataset.id = item.id;

  const tick = document.createElement('button');
  tick.type = 'button';
  tick.className = 'tick';
  tick.setAttribute('aria-pressed', item.ticked ? 'true' : 'false');
  tick.setAttribute('aria-label', `${item.ticked ? 'Untick' : 'Tick'} ${item.name}`);

  const box = document.createElement('span');
  box.className = 'tick-box';
  box.append(icon(CHECK_ICON));

  const text = document.createElement('span');
  text.className = 'item-copy';
  const name = document.createElement('span');
  name.className = 'name';
  name.textContent = item.name;
  text.append(name);

  const parts = [];
  if (showCategory) parts.push(item.category);
  if (state.shopFilter === 'all') parts.push(item.shop);
  if (item.quantity) parts.push(item.quantity);
  if (parts.length) {
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = parts.join(' · ');
    text.append(meta);
  }

  tick.append(box, text);
  tick.addEventListener('click', () => {
    item.ticked = !item.ticked;
    save();
    announce(`${item.ticked ? 'Ticked' : 'Unticked'} ${item.name}.`);
    render();
  });

  const edit = document.createElement('button');
  edit.type = 'button';
  edit.className = 'icon-btn';
  edit.setAttribute('aria-label', `Edit ${item.name}`);
  edit.append(icon(PENCIL_ICON));
  edit.addEventListener('click', () => openEditor({ mode: 'edit', item }));

  row.append(tick, edit);
  return row;
}

function confirmBar(message, onYes, onNo) {
  const bar = document.createElement('div');
  bar.className = 'confirm';
  const text = document.createElement('p');
  text.textContent = message;
  const yes = document.createElement('button');
  yes.type = 'button';
  yes.className = 'danger';
  yes.textContent = 'Clear';
  yes.addEventListener('click', onYes);
  const no = document.createElement('button');
  no.type = 'button';
  no.className = 'ghost';
  no.textContent = 'Keep';
  no.addEventListener('click', onNo);
  bar.append(text, yes, no);
  return bar;
}

function weekHasContent() {
  return DAYS.some(([id]) => state.meals[id].lunch.trim() || state.meals[id].dinner.trim());
}

function renderWeekActions() {
  const root = $('week-actions');
  root.replaceChildren();
  if (confirming === 'week') {
    root.append(confirmBar(
      'Clear the whole week?',
      () => {
        DAYS.forEach(([id]) => {
          state.meals[id] = { lunch: '', dinner: '' };
        });
        confirming = null;
        save();
        document.querySelectorAll('#days input').forEach((input) => {
          input.value = '';
        });
        document.querySelectorAll('#days .add-ingredient').forEach((button) => {
          button.disabled = true;
        });
        announce('Cleared the week.');
        renderWeekActions();
      },
      () => {
        confirming = null;
        renderWeekActions();
      }
    ));
    return;
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'ghost';
  button.id = 'clear-week';
  button.textContent = 'Clear week';
  button.disabled = !weekHasContent();
  button.addEventListener('click', () => {
    confirming = 'week';
    renderWeekActions();
  });
  root.append(button);
}

function buildMeals() {
  const root = $('days');
  DAYS.forEach(([id, label]) => {
    const card = document.createElement('section');
    card.className = 'day';
    const heading = document.createElement('h3');
    heading.textContent = label;
    card.append(heading);

    SLOTS.forEach(([slot, slotLabel]) => {
      const row = document.createElement('div');
      row.className = 'slot';
      const inputId = `${id}-${slot}`;
      const name = document.createElement('label');
      name.htmlFor = inputId;
      name.textContent = slotLabel;

      const input = document.createElement('input');
      input.id = inputId;
      input.type = 'text';
      input.maxLength = 80;
      input.autocomplete = 'off';
      input.autocapitalize = 'sentences';
      input.placeholder = slot === 'lunch' ? 'e.g. Soup and a roll' : 'e.g. Fish pie';
      input.value = state.meals[id][slot];
      input.setAttribute('aria-label', `${label} ${slotLabel}`);
      input.enterKeyHint = 'done';

      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'add-ingredient';
      add.disabled = !input.value.trim();
      add.setAttribute('aria-label', `Add ingredients from ${label} ${slotLabel.toLowerCase()}`);
      add.append(icon(PLUS_ICON));

      input.addEventListener('input', () => {
        state.meals[id][slot] = input.value;
        save();
        add.disabled = !input.value.trim();
        renderWeekActions();
      });
      input.addEventListener('focus', () => {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.setTimeout(() => {
          input.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
        }, 280);
      });
      add.addEventListener('click', () => {
        const mealName = input.value.trim();
        if (!mealName) return;
        openEditor({
          mode: 'ingredient',
          mealLabel: `${label} ${slotLabel.toLowerCase()}`,
          mealName,
        });
      });

      row.append(name, input, add);
      card.append(row);
    });

    root.append(card);
  });
}

function shopsForPicking() {
  const names = [...DEFAULT_SHOPS, ...state.customShops];
  if (draft.shop && !names.some((shop) => sameShop(shop, draft.shop))) names.push(draft.shop);
  return names;
}

function openEditor(options) {
  draft.mode = options.mode;
  draft.id = options.item ? options.item.id : null;
  draft.mealLabel = options.mealLabel || '';
  draft.mealName = options.mealName || '';
  heldShop = '';
  deleteArmed = false;

  if (options.item) {
    draft.category = options.item.category;
    draft.shop = options.item.shop;
    $('item-name').value = options.item.name;
    $('item-qty').value = options.item.quantity;
  } else {
    draft.category = CATEGORIES.includes(state.lastCategory) ? state.lastCategory : '';
    draft.shop = state.lastShop || '';
    $('item-name').value = '';
    $('item-qty').value = '';
  }

  $('shop-input').value = '';
  setError('');
  setStatus('');

  const context = $('editor-context');
  if (draft.mode === 'ingredient') {
    context.hidden = false;
    context.textContent = `${draft.mealLabel} · ${draft.mealName}`;
  } else {
    context.hidden = true;
    context.textContent = '';
  }

  $('name-label').textContent = draft.mode === 'ingredient' ? 'Ingredient' : 'Name';
  $('item-name').placeholder = draft.mode === 'ingredient'
    ? 'e.g. Cherry tomatoes'
    : 'e.g. Semi-skimmed milk';
  $('editor-title').textContent = draft.mode === 'edit'
    ? 'Edit item'
    : draft.mode === 'ingredient'
      ? 'Add ingredients'
      : 'Add item';
  $('editor-save').textContent = draft.mode === 'edit' ? 'Save' : 'Add to list';
  $('editor-delete').hidden = draft.mode !== 'edit';
  $('editor-delete').textContent = 'Delete item';
  $('editor-done').hidden = draft.mode !== 'ingredient';

  renderCategoryChoices();
  renderShopChoices();
  renderCustomShops();

  returnFocus = document.activeElement;
  const dialog = $('editor');
  if (!dialog.open) dialog.showModal();
  $('item-name').focus();
}

function closeEditor() {
  deleteArmed = false;
  const dialog = $('editor');
  if (dialog.open) dialog.close();
  if (returnFocus && typeof returnFocus.focus === 'function') returnFocus.focus();
}

function setError(message) {
  const node = $('editor-error');
  node.hidden = !message;
  node.textContent = message || '';
}

function setStatus(message) {
  const node = $('editor-status');
  node.hidden = !message;
  node.textContent = message || '';
}

function renderCategoryChoices() {
  const root = $('category-choices');
  root.replaceChildren();
  CATEGORIES.forEach((category) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice';
    button.setAttribute('aria-pressed', draft.category === category ? 'true' : 'false');
    button.textContent = category;
    button.addEventListener('click', () => {
      draft.category = category;
      renderCategoryChoices();
      setError('');
    });
    root.append(button);
  });
}

function renderShopChoices() {
  const root = $('shop-choices');
  root.replaceChildren();
  shopsForPicking().forEach((shop) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice';
    button.setAttribute('aria-pressed', sameShop(draft.shop, shop) ? 'true' : 'false');
    button.textContent = shop;
    button.addEventListener('click', () => {
      draft.shop = shop;
      heldShop = '';
      $('shop-input').value = '';
      renderShopChoices();
      setError('');
    });
    root.append(button);
  });
}

function renderCustomShops() {
  const root = $('custom-shops');
  root.replaceChildren();
  if (!state.customShops.length) return;
  const heading = document.createElement('p');
  heading.className = 'custom-label';
  heading.textContent = 'Your shops';
  const list = document.createElement('ul');
  state.customShops.forEach((shop) => {
    const item = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = shop;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.setAttribute('aria-label', `Remove ${shop}`);
    remove.addEventListener('click', () => removeCustomShop(shop));
    item.append(name, remove);
    list.append(item);
  });
  root.append(heading, list);
}

function removeCustomShop(shop) {
  state.customShops = state.customShops.filter((existing) => !sameShop(existing, shop));
  if (sameShop(draft.shop, shop)) draft.shop = '';
  if (sameShop(heldShop, shop)) heldShop = '';
  if (sameShop(state.lastShop, shop)) state.lastShop = '';
  const stillUsed = state.items.some((item) => sameShop(item.shop, shop));
  if (sameShop(state.shopFilter, shop) && !stillUsed) state.shopFilter = 'all';
  save();
  renderShopChoices();
  renderCustomShops();
  render();
  announce(`Removed ${shop}.`);
}

function addTypedShop() {
  const shop = canonicalShop($('shop-input').value);
  if (!shop) {
    setError('Type a shop name first.');
    $('shop-input').focus();
    return;
  }
  rememberShop(shop);
  draft.shop = shop;
  heldShop = '';
  $('shop-input').value = '';
  save();
  renderShopChoices();
  renderCustomShops();
  render();
  setError('');
  announce(`Saved shop ${shop}.`);
}

function chosenShop() {
  const typed = canonicalShop($('shop-input').value);
  if (typed) return typed;
  return draft.shop;
}

function readDraft() {
  const name = clean($('item-name').value, 80);
  const quantity = clean($('item-qty').value, 24);
  const shop = chosenShop();
  if (!name) {
    setError(draft.mode === 'ingredient' ? 'Add an ingredient.' : 'Add a name.');
    $('item-name').focus();
    return null;
  }
  if (!CATEGORIES.includes(draft.category)) {
    setError('Choose a category.');
    return null;
  }
  if (!shop) {
    setError('Choose a shop, or type one.');
    $('shop-input').focus();
    return null;
  }
  return { name, quantity, shop, category: draft.category };
}

function onEditorSubmit(event) {
  event.preventDefault();
  const data = readDraft();
  if (!data) return;

  rememberShop(data.shop);
  state.lastCategory = data.category;
  state.lastShop = data.shop;

  if (draft.mode === 'edit') {
    const item = state.items.find((entry) => entry.id === draft.id);
    if (item) {
      item.name = data.name;
      item.quantity = data.quantity;
      item.shop = data.shop;
      item.category = data.category;
    }
    save();
    announce(`Saved ${data.name}.`);
    render();
    closeEditor();
    return;
  }

  state.items.push({
    id: uid(),
    name: data.name,
    category: data.category,
    quantity: data.quantity,
    shop: data.shop,
    ticked: false,
    created: Date.now(),
  });
  save();
  announce(`Added ${data.name} to ${data.shop}.`);
  render();

  if (draft.mode === 'ingredient') {
    $('item-name').value = '';
    $('item-qty').value = '';
    $('shop-input').value = '';
    draft.shop = data.shop;
    heldShop = '';
    setError('');
    setStatus(`Added ${data.name}.`);
    renderShopChoices();
    $('item-name').focus();
    return;
  }

  closeEditor();
}

function onDelete() {
  if (!deleteArmed) {
    deleteArmed = true;
    $('editor-delete').textContent = 'Tap again to delete';
    return;
  }
  const item = state.items.find((entry) => entry.id === draft.id);
  state.items = state.items.filter((entry) => entry.id !== draft.id);
  save();
  announce(item ? `Deleted ${item.name}.` : 'Deleted item.');
  render();
  closeEditor();
}

function showTab(tab) {
  const meals = tab === 'meals';
  $('panel-list').hidden = meals;
  $('panel-meals').hidden = !meals;
  $('filters').hidden = meals;
  $('summary').hidden = meals;
  $('action-bar').hidden = meals;
  $('tab-list').setAttribute('aria-selected', meals ? 'false' : 'true');
  $('tab-meals').setAttribute('aria-selected', meals ? 'true' : 'false');
  $('page-title').textContent = meals ? 'Meal plan' : 'Shopping list';
  document.title = meals ? 'Meal plan' : 'Shopping list';
  try {
    localStorage.setItem(TAB_KEY, meals ? 'meals' : 'list');
  } catch (error) {
    /* The list still works if storage is blocked. */
  }
}

function isDark() {
  const theme = document.documentElement.dataset.theme;
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function syncThemeButton() {
  const dark = isDark();
  $('icon-moon').hidden = dark;
  $('icon-sun').hidden = !dark;
  $('theme-toggle').setAttribute('aria-label', dark ? 'Switch to light colours' : 'Switch to dark colours');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0c5534' : '#0e6b43');
}

function toggleTheme() {
  const next = isDark() ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch (error) {
    /* Theme still changes for this visit. */
  }
  syncThemeButton();
}

function init() {
  buildMeals();
  render();
  syncThemeButton();

  let tab = 'list';
  try {
    if (localStorage.getItem(TAB_KEY) === 'meals') tab = 'meals';
  } catch (error) {
    tab = 'list';
  }
  showTab(tab);

  $('add-item').addEventListener('click', () => openEditor({ mode: 'add' }));
  $('tab-list').addEventListener('click', () => showTab('list'));
  $('tab-meals').addEventListener('click', () => showTab('meals'));
  $('theme-toggle').addEventListener('click', toggleTheme);
  $('editor-form').addEventListener('submit', onEditorSubmit);
  $('editor-close').addEventListener('click', closeEditor);
  $('editor-done').addEventListener('click', closeEditor);
  $('editor-delete').addEventListener('click', onDelete);
  $('shop-add').addEventListener('click', addTypedShop);
  $('shop-input').addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addTypedShop();
    }
  });
  $('shop-input').addEventListener('input', () => {
    const typed = $('shop-input').value.trim();
    if (typed) {
      if (!heldShop) heldShop = draft.shop;
      draft.shop = '';
    } else if (heldShop) {
      draft.shop = heldShop;
      heldShop = '';
    }
    renderShopChoices();
    setError('');
  });
  $('item-name').addEventListener('input', () => {
    setError('');
    setStatus('');
    if (deleteArmed) {
      deleteArmed = false;
      $('editor-delete').textContent = 'Delete item';
    }
  });
  $('editor').addEventListener('close', () => {
    deleteArmed = false;
  });

  const colourScheme = window.matchMedia('(prefers-color-scheme: dark)');
  colourScheme.addEventListener('change', () => {
    if (!document.documentElement.dataset.theme) syncThemeButton();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* Offline support needs a successful registration. The list still works. */
    });
  }
}

init();
