(() => {
  'use strict';
  document.documentElement.classList.add('js');
  window.dataLayer = window.dataLayer || [];
  const emit = (event, params = {}) => {
    window.dataLayer.push({ event, ...params });
    if (typeof window.gtag === 'function') window.gtag('event', event, params);
  };
  const header = document.querySelector('.site-header');
  if (header) {
    const updateHeader = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
    updateHeader();
    window.addEventListener('scroll', updateHeader, { passive: true });
  }
  const bar = document.querySelector('.action-bar');
  const fitCall = () => {
    if (!bar || !bar.getClientRects().length) return;
    const call = bar.querySelector('.action-call');
    call.textContent = call.dataset.fullLabel;
    bar.classList.add('has-full-call');
    const links = [...bar.querySelectorAll('a')];
    const style = getComputedStyle(bar);
    const needed = links.reduce((width, link) => width + link.getBoundingClientRect().width, 0) + parseFloat(style.gap);
    const available = bar.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    if (needed > available || links.some((link) => link.scrollWidth > link.clientWidth)) {
      call.textContent = call.dataset.shortLabel;
      bar.classList.remove('has-full-call');
    }
  };
  // fonts.ready can resolve before the webfont starts loading, so measure again when a font arrives and on load.
  document.fonts.ready.then(fitCall);
  document.fonts.addEventListener('loadingdone', fitCall);
  window.addEventListener('load', fitCall);
  window.addEventListener('resize', fitCall);
  const es = document.documentElement.lang.startsWith('es');
  const text = (en, spanish) => es ? spanish : en;
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    const link_location = link.dataset.location || link.closest('[data-location]')?.dataset.location || 'content';
    if (link.protocol === 'tel:') emit('call_click', { link_location });
    if (link.protocol === 'mailto:') emit('email_click', { link_location });
    if (link.hostname === 'wa.me') emit('whatsapp_click', { link_location });
  });
  document.querySelectorAll('.services-menu').forEach((details) => {
    details.querySelector('summary').setAttribute('aria-expanded', String(details.open));
    details.addEventListener('toggle', () => details.querySelector('summary').setAttribute('aria-expanded', String(details.open)));
    // In the header Services is a panel: Escape, a click or keyboard focus outside it closes it. In the phone menu its
    // pages stay open under it until Services is pressed again, and Escape closes the whole menu.
    if (!details.closest('.desktop-nav')) return;
    details.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { details.open = false; details.querySelector('summary').focus(); }
    });
    document.addEventListener('click', (event) => { if (details.open && !details.contains(event.target)) details.open = false; });
    details.addEventListener('focusout', (event) => { if (event.relatedTarget && !details.contains(event.relatedTarget)) details.open = false; });
  });
  const menu = document.getElementById('mobile-menu');
  const menuToggle = document.querySelector('.menu-toggle');
  if (menu && menuToggle) {
    menuToggle.addEventListener('click', () => { delete menu.dataset.instant; menu.showModal(); menuToggle.setAttribute('aria-expanded', 'true'); });
    menu.querySelector('.menu-close').addEventListener('click', () => menu.close());
    menu.addEventListener('close', () => { menuToggle.setAttribute('aria-expanded', 'false'); menuToggle.focus(); });
    // A page link closes the menu without its fade, and so does leaving the page, before the page transition captures it.
    // The call link leaves the menu open behind the dialler.
    const closeNow = () => { menu.dataset.instant = ''; if (menu.open) menu.close(); };
    menu.addEventListener('click', (event) => { if (event.target.closest('a:not([href^="tel:"])')) closeNow(); });
    window.addEventListener('pageswap', closeNow);
  }
  const dialog = document.getElementById('quote');
  let opener;
  const tokenFor = async (form, refresh = false) => {
    if (!refresh && form.tokenPromise) return form.tokenPromise;
    form.tokenPromise = fetch(`${window.regalConfig.restUrl}quote-token`, { cache: 'no-store', credentials: 'same-origin' })
      .then((response) => { if (!response.ok) throw new Error('token'); return response.json(); })
      .then(({ token }) => { form.elements.token.value = token; form.tokenTime = Date.now(); return token; })
      .catch((error) => { form.tokenPromise = null; throw error; });
    return form.tokenPromise;
  };
  const pageLanguage = es ? 'es' : 'en';
  const inline = document.getElementById('quote-inline');
  const cardService = { 'gas-logs': 'gas-logs', outdoor: 'outdoor', 'outdoor-living': 'outdoor', 'exterior-designs': 'outdoor' };
  // A page with its own form scrolls to it instead of opening a second, empty draft.
  const goInline = () => {
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    (inline.closest('.quote-column') || inline).scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    const form = inline.querySelector('form');
    const target = form ? ['name', 'phone', 'email'].map((name) => form.elements[name]).find((field) => field && !field.value) || form.elements.name : inline.querySelector('.quote-thanks');
    target?.focus({ preventScroll: true });
  };
  document.addEventListener('click', (event) => {
    const link = event.target.closest('.js-quote');
    if (!link) return;
    const product = link.dataset.product || '';
    const link_location = link.dataset.location || 'content';
    if (inline && !product) {
      event.preventDefault();
      // The menu's close handler refocuses its toggle, so wait for it before focusing the form.
      if (menu && link.closest('#mobile-menu')) { menu.addEventListener('close', goInline, { once: true }); if (menu.open) menu.close(); } else goInline();
      emit('quote_open', { product, link_location });
      return;
    }
    if (!dialog || typeof dialog.showModal !== 'function') return;
    event.preventDefault();
    opener = link;
    if (menu?.open) menu.close();
    const form = dialog.querySelector('form');
    if (form && !form.dataset.sent) {
      form.elements.product.value = product;
      form.querySelector('.field-product').hidden = !product;
      const need = form.elements.need;
      const card = product && link.closest('.product-card');
      need.value = card ? cardService[card.dataset.cat] || 'other' : [...need.options].find((option) => option.defaultSelected)?.value || 'other';
      tokenFor(form).catch(() => {});
    }
    dialog.showModal();
    emit('quote_open', { product, link_location });
  });
  if (dialog) {
    dialog.querySelector('.close-dialog').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => opener?.focus());
    dialog.addEventListener('click', (event) => {
      const bounds = dialog.getBoundingClientRect();
      if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
    });
  }
  // A job strip that scrolls sideways (phones) is a named region keyboard users can focus and scroll with the arrow keys.
  const strips = [...document.querySelectorAll('.job-strip')];
  const stripFocus = () => strips.forEach((strip) => {
    if (strip.scrollWidth > strip.clientWidth + 1) {
      strip.tabIndex = 0; strip.setAttribute('role', 'region'); strip.setAttribute('aria-label', text('Job photos', 'Fotos de trabajos'));
    } else { strip.removeAttribute('tabindex'); strip.removeAttribute('role'); strip.removeAttribute('aria-label'); }
  });
  if (strips.length) { stripFocus(); addEventListener('resize', stripFocus); }
  document.querySelectorAll('.quote-form').forEach((form) => {
    if (!form.closest('dialog')) tokenFor(form).catch(() => {});
    form.addEventListener('focusin', () => { tokenFor(form).catch(() => {}); }, { once: true });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (form.dataset.sending || form.dataset.sent) return;
      const status = form.querySelector('.form-status');
      const submit = form.querySelector('[type=submit]');
      form.querySelectorAll('[data-error]').forEach((node) => { node.textContent = ''; });
      form.querySelectorAll('[aria-invalid]').forEach((node) => node.removeAttribute('aria-invalid'));
      status.textContent = text('Sending…', 'Enviando…');
      form.dataset.sending = '1'; submit.disabled = true;
      try {
        await tokenFor(form, form.tokenTime && Date.now() - form.tokenTime > 7000000);
        // The server refuses tokens younger than 3 s, so a fresh one waits out the rest.
        const wait = 3200 - (Date.now() - form.tokenTime);
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
        // Sent urlencoded: the server refuses multipart bodies outside the admin.
        const response = await fetch(`${window.regalConfig.restUrl}quote`, { method: 'POST', body: new URLSearchParams(new FormData(form)), credentials: 'same-origin' });
        const result = await response.json();
        status.textContent = '';
        if (result.success) {
          emit('generate_lead', { form_language: result.language, page_language: pageLanguage, product: result.product || '' });
          form.dataset.sent = '1';
          const notice = document.createElement('div'); notice.className = 'quote-thanks'; notice.setAttribute('role', 'status'); notice.tabIndex = -1;
          const title = document.createElement('h2'); title.className = 'thanks-title'; title.textContent = text('Thank you', 'Gracias');
          const detail = document.createElement('p'); detail.className = 'thanks-detail'; detail.textContent = result.message;
          notice.append(title, detail); form.replaceWith(notice); notice.focus();
        } else {
          Object.entries(result.errors || {}).forEach(([name, message]) => {
            const error = form.querySelector(`[data-error="${name}"]`);
            if (error) { error.textContent = message; form.elements[name]?.setAttribute('aria-invalid', 'true'); }
            else status.textContent = message;
          });
          form.querySelector('[aria-invalid]')?.focus();
        }
      } catch {
        status.textContent = text('Your request could not be confirmed. Please try again or call us.', 'No se pudo confirmar su solicitud. Inténtelo de nuevo o llámenos.');
      } finally { delete form.dataset.sending; submit.disabled = false; }
    });
  });
  const notice = document.getElementById('quote-notice');
  if (notice) {
    emit('generate_lead', { form_language: notice.dataset.language, page_language: pageLanguage, product: notice.dataset.product || '' });
    const url = new URL(location.href); ['quote', 'quote_product', 'quote_lang'].forEach((key) => url.searchParams.delete(key)); history.replaceState({}, '', url);
  }
  document.querySelectorAll('.play-video').forEach((button) => {
    button.hidden = false;
    button.addEventListener('click', () => {
      let player;
      if (button.dataset.youtube) {
        // The embed is created on the click, so nothing loads from YouTube before it.
        player = document.createElement('iframe');
        player.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(button.dataset.youtube)}?autoplay=1&rel=0`;
        player.allow = 'autoplay; encrypted-media; picture-in-picture'; player.allowFullscreen = true; player.referrerPolicy = 'strict-origin-when-cross-origin';
        player.title = 'Video: ' + button.dataset.title;
        button.closest('.product-card').classList.add('is-playing');
        button.parentElement.replaceChildren(player); player.focus();
        return;
      }
      player = document.createElement('video'); player.controls = true; player.preload = 'none'; player.poster = button.dataset.poster; player.src = button.dataset.video; player.playsInline = true;
      player.setAttribute('aria-label', button.getAttribute('aria-label'));
      button.parentElement.replaceChildren(player); player.focus(); player.play().catch(() => {});
    });
  });
  // Every value of a query key: repeated keys and comma lists both count; first appearance wins.
  const listed = (query, key) => [...new Set(query.getAll(key).flatMap((value) => value.split(',')).map((value) => value.trim()).filter(Boolean))];
  const encode = (value) => encodeURIComponent(value).replace(/%20/g, '+');
  // The EN/ES links carry the same filters and product, so changing language keeps the view after filtering in place.
  const syncSwitch = () => {
    const here = new URL(location.href).searchParams;
    document.querySelectorAll('.lang-switch[data-carry]').forEach((nav) => {
      const carry = nav.dataset.carry.split(',');
      nav.querySelectorAll('a').forEach((link) => {
        const url = new URL(link.href);
        carry.forEach((key) => {
          const value = ['cat', 'brand', 'venting', 'size'].includes(key) ? listed(here, key).slice(0, key === 'cat' ? 1 : undefined).join(',') : here.get(key);
          if (value) url.searchParams.set(key, value); else url.searchParams.delete(key);
        });
        link.href = url.href;
      });
    });
  };
  // Matches regal_search_text(): lower case without accents.
  const fold = (value) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  // Our Work: the service chips are links that reload the page with ?service=; with scripts they filter the cards in
  // place and keep the address in step, the way the catalogue's chips do.
  document.querySelectorAll('.project-filters').forEach((filters) => {
    const scope = filters.parentElement;
    const chips = [...filters.querySelectorAll('.chip[data-service]')];
    const grid = scope.querySelector('.project-grid');
    const cards = [...scope.querySelectorAll('.project-card[data-service]')];
    const empty = scope.querySelector('.project-empty');
    const status = document.createElement('p');
    status.className = 'screen-reader-text';
    status.setAttribute('role', 'status');
    filters.after(status);
    const labelOf = (service) => chips.find((chip) => chip.dataset.service === service)?.textContent.trim() || '';
    // A service with no chip here is ignored, as the server ignores it.
    const read = () => {
      const service = new URL(location.href).searchParams.get('service') || '';
      return chips.some((chip) => chip.dataset.service === service) ? service : '';
    };
    const apply = (service, announce = false) => {
      chips.forEach((chip) => { if (chip.dataset.service === service) chip.setAttribute('aria-current', 'true'); else chip.removeAttribute('aria-current'); });
      let shown = 0;
      cards.forEach((card) => { card.hidden = Boolean(service) && card.dataset.service !== service; if (!card.hidden) shown += 1; });
      if (grid) grid.hidden = shown === 0;
      if (empty) {
        empty.hidden = shown > 0;
        empty.querySelector('.empty-message').textContent = text(`${labelOf(service)}: no jobs in the gallery yet.`, `${labelOf(service)}: todavía no hay trabajos en la galería.`);
      }
      if (announce) status.textContent = text(`${shown} ${shown === 1 ? 'project' : 'projects'}`, `${shown} ${shown === 1 ? 'trabajo' : 'trabajos'}`);
    };
    scope.addEventListener('click', (event) => {
      const link = event.target.closest('a[data-service]');
      // A modified click still opens the link, in a new tab or window.
      if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const service = link.dataset.service;
      apply(service, true);
      const url = new URL(location.href);
      if (service) url.searchParams.set('service', service); else url.searchParams.delete('service');
      history.replaceState(history.state, '', url);
      if (link.classList.contains('show-all')) chips.find((chip) => !chip.dataset.service)?.focus();
    });
    apply(read());
  });
  document.querySelectorAll('.catalog').forEach((catalog) => {
    const cards = [...catalog.querySelectorAll('.product-card')];
    const groups = [...catalog.querySelectorAll('[data-filter]')];
    const rows = [...catalog.querySelectorAll('.filter-chips')];
    const filters = catalog.querySelector('.filters');
    const search = catalog.querySelector('.catalog-search');
    const paging = catalog.querySelector('.catalog-paging');
    const more = paging.querySelector('.show-more');
    const tokenBox = catalog.querySelector('.result-tokens');
    const pageSize = 24;
    if (!filters) return;
    filters.hidden = false;
    let requested = pageSize;
    let current = pageSize;
    let typing;
    let searching = false;
    let total = 0;
    const multi = ['brand', 'venting', 'size'];
    const params = ['cat', ...multi];
    const chosen = { cat: '', brand: [], venting: [], size: [], q: '' };
    const picked = (key) => key === 'cat' ? (chosen.cat ? [chosen.cat] : []) : chosen[key];
    const chipFor = (key, value) => catalog.querySelector(`[data-filter="${key}"] button[data-value="${CSS.escape(value)}"]`);
    const labelOf = (chip) => chip.querySelector('.chip-label-full')?.textContent || [...chip.childNodes].filter((node) => node.nodeType === 3).map((node) => node.textContent).join('').trim();
    const ranges = Object.fromEntries([...catalog.querySelectorAll('[data-filter="size"] button[data-min]')].map((button) => [button.dataset.value, [Number(button.dataset.min), Number(button.dataset.max)]]));
    // A range key, or the range holding a single size such as an older "24" link, as regal_size_range() reads it.
    const sizeRange = (value) => ranges[value] ? value : (/^\d+$/.test(value) && Object.keys(ranges).find((key) => Number(value) >= ranges[key][0] && Number(value) <= ranges[key][1])) || '';
    // A value with no chip on this page is ignored, as the server ignores it.
    const read = () => {
      const query = new URL(location.href).searchParams;
      chosen.cat = listed(query, 'cat').find((value) => chipFor('cat', value)) || '';
      ['brand', 'venting'].forEach((key) => { chosen[key] = listed(query, key).filter((value) => chipFor(key, value)); });
      chosen.size = chosen.cat === 'gas-logs' ? [...new Set(listed(query, 'size').map(sizeRange).filter((value) => value && chipFor('size', value)))] : [];
      chosen.q = (query.get('q') || '').slice(0, 80);
      const shown = Number(query.get('shown'));
      requested = Number.isInteger(shown) && shown > 0 ? shown : pageSize;
      if (search) search.elements.q.value = chosen.q;
    };
    const supports = (card, key, value) => {
      if (key !== 'size') return card.dataset[key] === value;
      const [min, max] = ranges[value] || [1, 0];
      return card.dataset.sizes.split(',').filter(Boolean).map(Number).some((size) => size >= min && size <= max);
    };
    const found = (card) => fold(chosen.q).split(' ').every((term) => !term || card.dataset.search.includes(term));
    // Values in a group combine with OR, groups with AND; skip leaves a group out so its options can be counted.
    const matches = (card, skip = [], searching = true) => (!searching || found(card)) && params.every((key) => skip.includes(key) || !picked(key).length || picked(key).some((value) => supports(card, key, value)));
    // On phones each chip row scrolls sideways; a fade marks a row with more chips to its right.
    const cue = () => rows.forEach((row) => row.classList.toggle('more-right', row.scrollLeft + row.clientWidth < row.scrollWidth - 1));
    const reveal = () => rows.forEach((row) => {
      const pressed = row.querySelector('[aria-pressed="true"]:not([data-value=""]), [aria-checked="true"]:not([data-value=""])');
      if (pressed && row.scrollWidth > row.clientWidth) row.scrollLeft += pressed.getBoundingClientRect().left - row.getBoundingClientRect().left - parseFloat(getComputedStyle(row).paddingLeft);
    });
    const info = catalog.querySelector('.info-button');
    const panel = catalog.querySelector('.info-panel');
    const setInfo = (open) => { panel.hidden = !open; info.setAttribute('aria-expanded', String(open)); };
    const tokenList = () => [
      ...picked('cat').map((value) => ({ key: 'cat', value, label: labelOf(chipFor('cat', value)) })),
      ...multi.flatMap((key) => chosen[key].map((value) => ({ key, value, label: labelOf(chipFor(key, value)) }))),
      ...(chosen.q ? [{ key: 'q', value: chosen.q, label: `“${chosen.q}”` }] : []),
    ];
    // Tokens update in place, so only a newly applied filter's token enters. The search token keeps one node while typing.
    const tokenId = (key, value) => (key === 'q' ? 'q' : `${key}\u0000${value}`);
    const renderTokens = () => {
      const have = new Map([...tokenBox.querySelectorAll('.token')].map((node) => [tokenId(node.dataset.key, node.dataset.value), node]));
      const wanted = tokenList();
      const keep = new Set(wanted.map(({ key, value }) => tokenId(key, value)));
      have.forEach((node, id) => { if (!keep.has(id)) node.remove(); });
      let next = tokenBox.firstElementChild;
      wanted.forEach(({ key, value, label }) => {
        let token = have.get(tokenId(key, value));
        if (token && key === 'q' && token.dataset.value !== value) {
          token.dataset.value = value; token.querySelector('span').textContent = label;
          token.setAttribute('aria-label', text('Remove ', 'Quitar ') + label);
        }
        token ||= makeToken(key, value, label);
        if (token === next) next = token.nextElementSibling; else tokenBox.insertBefore(token, next);
      });
    };
    const makeToken = (key, value, label) => {
        const token = document.createElement('button');
        token.type = 'button'; token.className = 'token'; token.dataset.key = key; token.dataset.value = value;
        token.setAttribute('aria-label', text('Remove ', 'Quitar ') + label);
        const name = document.createElement('span'); name.textContent = label;
        const x = document.createElement('span'); x.className = 'token-x'; x.setAttribute('aria-hidden', 'true'); x.textContent = '×';
        token.append(name, x);
        return token;
    };
    const apply = (write = '') => {
      const matching = cards.filter((card) => matches(card));
      total = matching.length;
      const emptySearch = !total && Boolean(chosen.q);
      const filtered = Boolean(chosen.q) || params.some((key) => picked(key).length);
      const batches = (number) => Math.max(pageSize, Math.ceil(number / pageSize) * pageSize);
      current = Math.min(batches(requested), batches(total));
      cards.forEach((card) => { card.hidden = true; });
      matching.slice(0, current).forEach((card) => { card.hidden = false; });
      const remaining = Math.max(0, total - current);
      paging.hidden = remaining === 0;
      more.textContent = remaining < pageSize ? more.dataset.lastLabel.replace('%d', remaining) : more.dataset.moreLabel;
      paging.querySelector('.paging-status').textContent = text(`Showing ${current} of ${total}`, `Mostrando ${current} de ${total}`);
      groups.forEach((group) => {
        const key = group.dataset.filter;
        // Choosing a category clears the log size, so the size never hides a category chip.
        const ignore = key === 'cat' ? ['cat', 'size'] : [key];
        const applicable = [];
        group.querySelectorAll('button[data-value]').forEach((button) => {
          const value = button.dataset.value;
          const on = value ? picked(key).includes(value) : !picked(key).length;
          button.setAttribute(key === 'cat' ? 'aria-checked' : 'aria-pressed', String(on));
          if (key === 'cat') button.tabIndex = on ? 0 : -1;
          if (!value) return;
          const number = cards.filter((card) => matches(card, ignore) && supports(card, key, value)).length;
          // A search with no results keeps every row: options list as they would without it, counts stay real.
          const listsAnyway = key === 'venting' || key === 'size' || (emptySearch ? cards.some((card) => matches(card, ignore, false) && supports(card, key, value)) : number > 0);
          button.hidden = !on && !listsAnyway;
          if (!on && !number) button.setAttribute('aria-disabled', 'true'); else button.removeAttribute('aria-disabled');
          const badge = button.querySelector('.chip-count');
          if (badge) badge.textContent = number;
          if (number) applicable.push({ button, number });
        });
        const single = group.querySelector('.filter-single');
        if (single) {
          const own = cards.filter((card) => matches(card, [key])).length;
          const only = !picked(key).length && applicable.length === 1 && applicable[0].number === own && own > 0 ? applicable[0].button : null;
          single.hidden = !only;
          if (only) single.textContent = `${group.querySelector('.filter-label').textContent}: ${labelOf(only)}`;
          group.querySelector('.filter-head').hidden = Boolean(only);
          group.querySelector('.filter-chips').hidden = Boolean(only);
          if (only && key === 'venting' && info) setInfo(false);
        }
        group.hidden = key === 'size' ? chosen.cat !== 'gas-logs' : ![...group.querySelectorAll('button[data-value]')].some((button) => !button.hidden);
      });
      catalog.querySelector('.result-count').textContent = filtered ? text(`${total} of ${cards.length} products`, `${total} de ${cards.length} productos`) : text(`${total} products`, `${total} productos`);
      renderTokens();
      const empty = catalog.querySelector('.empty-state');
      empty.hidden = total !== 0;
      empty.querySelector('.empty-message').textContent = chosen.q ? text(`Nothing matches “${chosen.q}”. Check the spelling or search a brand name.`, `Nada coincide con “${chosen.q}”. Revise la ortografía o busque una marca.`) : text('No products match these filters.', 'No hay productos que coincidan con estos filtros.');
      empty.querySelector('.clear-search').hidden = !chosen.q;
      empty.querySelector('.clear-filters').hidden = Boolean(chosen.q);
      catalog.querySelector('.results-bar .clear-filters').hidden = !filtered;
      syncSheet();
      cue();
      if (write) {
        const url = new URL(location.href);
        const kept = new URLSearchParams(url.search);
        [...params, 'q', 'shown'].forEach((key) => kept.delete(key));
        const written = [
          ...(chosen.cat ? [`cat=${encode(chosen.cat)}`] : []),
          ...multi.filter((key) => chosen[key].length).map((key) => `${key}=${chosen[key].map(encode).join(',')}`),
          ...(chosen.q ? [`q=${encode(chosen.q)}`] : []),
          ...(current > pageSize ? [`shown=${current}`] : []),
        ];
        url.search = [kept.toString(), ...written].filter(Boolean).join('&');
        history[write === 'replace' ? 'replaceState' : 'pushState']({}, '', url);
        syncSwitch();
      }
    };
    const change = (focus) => {
      requested = pageSize;
      apply('push');
      focus?.();
    };
    // Phones: the same group elements move into a sheet.
    const phone = matchMedia('(max-width: 599.98px)');
    const catGroup = groups.find((group) => group.dataset.filter === 'cat');
    const sheetGroups = groups.filter((group) => group !== catGroup);
    let bar, opener, sheet, afterClose;
    const build = () => {
      bar = document.createElement('div');
      bar.className = 'filter-bar';
      opener = document.createElement('button');
      opener.type = 'button'; opener.className = 'filters-button'; opener.setAttribute('aria-haspopup', 'dialog');
      bar.append(opener);
      filters.after(bar);
      const stick = () => { if (catalog.classList.contains('has-sheet')) bar.classList.toggle('is-stuck', scrollY > 0 && bar.getBoundingClientRect().top <= parseFloat(getComputedStyle(bar).top) + 1); };
      window.addEventListener('scroll', stick, { passive: true });
      sheet = document.createElement('dialog');
      sheet.className = 'filter-sheet';
      sheet.setAttribute('aria-labelledby', 'filter-sheet-title');
      sheet.innerHTML = '<div class="sheet-head"><h2 id="filter-sheet-title" tabindex="-1"></h2><button type="button" class="close-button sheet-close">×</button></div><div class="sheet-body"><p class="sheet-category"><span></span><button type="button" class="change-category"></button></p></div><div class="sheet-foot"><p class="sheet-status screen-reader-text" role="status" aria-live="polite"></p><div class="wp-block-button"><button type="button" class="wp-block-button__link wp-element-button sheet-done"></button></div></div>';
      sheet.querySelector('h2').textContent = text('Filters', 'Filtros');
      sheet.querySelector('.sheet-close').setAttribute('aria-label', text('Close filters', 'Cerrar filtros'));
      sheet.querySelector('.change-category').textContent = text('Change', 'Cambiar');
      catalog.append(sheet);
      opener.addEventListener('click', () => { sheet.showModal(); sheet.querySelector('h2').focus(); });
      sheet.querySelector('.sheet-close').addEventListener('click', () => sheet.close());
      sheet.querySelector('.sheet-done').addEventListener('click', () => sheet.close());
      sheet.querySelector('.change-category').addEventListener('click', () => { afterClose = catGroup?.querySelector('[role="radio"][aria-checked="true"]'); sheet.close(); });
      sheet.addEventListener('close', () => { const target = afterClose || opener; afterClose = null; target.focus(); });
      sheet.addEventListener('click', (event) => {
        const box = sheet.getBoundingClientRect();
        if (event.target === sheet && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) sheet.close();
      });
    };
    const syncSheet = () => {
      if (!sheet) return;
      const chosenInSheet = multi.reduce((sum, key) => sum + chosen[key].length, 0);
      opener.textContent = chosenInSheet ? text(`Filters (${chosenInSheet})`, `Filtros (${chosenInSheet})`) : text('Filters', 'Filtros');
      sheet.querySelector('.sheet-category span').textContent = text('Category: ', 'Categoría: ') + (chosen.cat ? labelOf(chipFor('cat', chosen.cat)) : text('All categories', 'Todas las categorías'));
      sheet.querySelector('.sheet-status').textContent = text(`${total} products`, `${total} productos`);
      sheet.querySelector('.sheet-done').textContent = text(`Show ${total} products`, `Ver ${total} productos`);
    };
    const mount = () => {
      if (!sheet) build();
      const held = catalog.contains(document.activeElement) ? document.activeElement : null;
      catalog.classList.add('has-sheet');
      if (catGroup) bar.append(catGroup);
      sheet.querySelector('.sheet-body').append(...sheetGroups);
      syncSheet();
      if (held) (sheetGroups.some((group) => group.contains(held)) ? opener : held).focus();
      cue(); reveal();
    };
    const unmount = () => {
      if (!sheet) return;
      const held = catalog.contains(document.activeElement) ? document.activeElement : null;
      const group = held && sheetGroups.find((item) => item.contains(held));
      catalog.classList.remove('has-sheet');
      filters.append(...(catGroup ? [catGroup] : []), ...sheetGroups);
      // Focus follows the control that held it.
      let target = held;
      if (sheet.contains(held)) target = group ? (held.hidden ? group.querySelector('button[data-value]:not([hidden])') : held) : catGroup?.querySelector('[role="radio"][aria-checked="true"]');
      if (sheet.open) { afterClose = target; sheet.close(); } else target?.focus();
      cue(); reveal();
    };
    phone.addEventListener('change', () => (phone.matches ? mount() : unmount()));
    catalog.addEventListener('click', (event) => {
      const chip = event.target.closest('[data-filter] button[data-value]');
      if (chip) {
        if (chip.getAttribute('aria-disabled') === 'true') return;
        const key = chip.closest('[data-filter]').dataset.filter;
        const value = chip.dataset.value;
        if (key === 'cat') {
          if (chosen.cat === value) return;
          chosen.cat = value;
          if (value !== 'gas-logs') chosen.size = [];
        } else if (!value) chosen[key] = [];
        else chosen[key] = chosen[key].includes(value) ? chosen[key].filter((item) => item !== value) : [...chosen[key], value];
        // A chosen option with no cards disappears when unchosen; focus moves to its group's reset chip.
        change(() => { if (chip.hidden) chipFor(key, '').focus(); });
        return;
      }
      const token = event.target.closest('.token');
      if (token) {
        if (token.classList.contains('is-leaving')) return;
        const id = (node) => `${node.dataset.key}\u0000${node.dataset.value}`;
        const before = [...tokenBox.querySelectorAll('.token')];
        const { key, value } = token.dataset;
        if (key === 'q') { chosen.q = ''; if (search) search.elements.q.value = ''; }
        else if (key === 'cat') { chosen.cat = ''; chosen.size = []; }
        else chosen[key] = chosen[key].filter((item) => item !== value);
        const remove = () => change(() => {
          const alive = new Map([...tokenBox.querySelectorAll('.token')].map((node) => [id(node), node]));
          const at = before.indexOf(token);
          const next = [...before.slice(at + 1), ...before.slice(0, at).reverse()].find((node) => alive.has(id(node)));
          (next ? alive.get(id(next)) : search?.elements.q)?.focus();
        });
        // The token shrinks away first, unless motion is reduced.
        if (catalog.hasAttribute('data-motion') && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
          token.classList.add('is-leaving');
          // A filter change during the leave has already removed the token and applied its change.
          setTimeout(() => { if (token.isConnected) remove(); }, parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--dur-1')) || 150);
        } else remove();
        return;
      }
      if (event.target.closest('.clear-search')) { chosen.q = ''; if (search) search.elements.q.value = ''; change(() => search?.elements.q.focus()); return; }
      if (event.target.closest('.clear-filters')) { params.forEach((key) => { chosen[key] = key === 'cat' ? '' : []; }); chosen.q = ''; if (search) search.elements.q.value = ''; change(); return; }
      if (event.target.closest('.show-more')) {
        const firstNew = cards.filter((card) => matches(card))[current];
        requested = current + pageSize;
        apply('replace');
        firstNew?.focus();
      }
    });
    // The category row is a radio group: arrow keys move the choice, and only the chosen radio is a tab stop.
    catalog.addEventListener('keydown', (event) => {
      const radio = event.target.closest('[role="radio"]');
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      if (!radio || (!step && event.key !== 'Home' && event.key !== 'End')) return;
      const radios = [...radio.parentElement.querySelectorAll('[role="radio"]')].filter((node) => !node.hidden && node.getAttribute('aria-disabled') !== 'true');
      const at = radios.indexOf(radio);
      const target = event.key === 'Home' ? radios[0] : event.key === 'End' ? radios.at(-1) : radios[(at + step + radios.length) % radios.length];
      event.preventDefault();
      target.focus();
      target.click();
    });
    if (info && panel) {
      info.hidden = false;
      setInfo(false);
      info.addEventListener('click', () => setInfo(panel.hidden));
      document.addEventListener('click', (event) => { if (!panel.hidden && !panel.contains(event.target) && !info.contains(event.target)) setInfo(false); });
      // In the sheet, Escape closes the note first.
      document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !panel.hidden) { setInfo(false); info.focus(); if (sheet?.open) event.preventDefault(); } });
    }
    if (search) {
      // The first keystroke of a search adds a history entry; the rest of that search replaces it.
      const query = (write) => { clearTimeout(typing); chosen.q = search.elements.q.value.trim().slice(0, 80); requested = pageSize; apply(write); };
      search.addEventListener('submit', (event) => { event.preventDefault(); query(searching ? 'replace' : 'push'); searching = false; });
      search.elements.q.addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(() => { query(searching ? 'replace' : 'push'); searching = true; }, 250); });
      search.elements.q.addEventListener('change', () => { searching = false; });
    }
    rows.forEach((row) => row.addEventListener('scroll', cue, { passive: true }));
    window.addEventListener('resize', cue);
    window.addEventListener('popstate', () => { clearTimeout(typing); searching = false; read(); apply(); reveal(); syncSwitch(); });
    read();
    if (phone.matches) mount();
    apply(); reveal();
    // Chip widths change when the webfont arrives, so the chosen chip is brought into view again.
    document.fonts.ready.then(reveal);
    // Catalogue motion starts after the first render, so the page does not animate in its first state.
    requestAnimationFrame(() => requestAnimationFrame(() => { catalog.dataset.motion = ''; }));
  });
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    document.fonts.ready.then(() => {
      const targets = [...document.querySelectorAll('.section > h2, .section-lede, .reviews > .big-score, .reviews > .stars-row, .service-cols > .wp-block-column, .band, .review-card, .project-grid > *, .product-grid > .product-card, .intro > *, .contact-panel, .faq, .price-note, .ready li, .job-strip > .wp-block-image')].filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.top > innerHeight && rect.width > 0 && rect.height > 0 && !node.closest('.home .job-strip');
      });
      const enter = (node, index = 0) => {
        node.style.setProperty('--reveal-i', Math.min(index, 5));
        node.classList.add('is-in'); observer.unobserve(node);
        if (node.matches('.catalog .product-card:focus-within')) node.classList.add('is-settled');
      };
      const observer = new IntersectionObserver((entries) => {
        const entering = entries.filter((entry) => entry.isIntersecting && entry.target.getClientRects().length).map((entry) => entry.target);
        targets.filter((node) => entering.includes(node)).forEach(enter);
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
      targets.forEach((node) => { node.classList.add('reveal'); observer.observe(node); });
      document.addEventListener('transitionend', (event) => {
        if (event.propertyName === 'opacity' && event.target.matches('.catalog .product-card.reveal.is-in')) event.target.classList.add('is-settled');
      });
      document.addEventListener('focusin', (event) => {
        for (let node = event.target.closest('.reveal'); node; node = node.parentElement?.closest('.reveal')) enter(node);
      });
    });
  }
})();
