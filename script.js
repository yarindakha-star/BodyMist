'use strict';

/* ==========================================================
   Body Scent — shared script (product / order / admin pages)
   Each init function runs only if its page's elements exist.
   ========================================================== */

var PRODUCTS_URL = 'products.json';

var SHEET_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vT6O6xvUE6P4gX3heR34-Py0fy4ob4UKLrFO912NNtzS_JKf3qoEgaIjWkedn1z-QuIV3DcfE5IONkX/pub?output=csv';

var MOODS = [
  { key: 'all', label: 'ทั้งหมด' },
  { key: 'fresh', label: 'Fresh' },
  { key: 'sweet', label: 'Sweet' },
  { key: 'confident', label: 'Confident' },
  { key: 'romance', label: 'Romance' }
];

/* ---------- Small DOM helper (builds nodes safely, no innerHTML) ---------- */
function el(tag, attrs, children) {
  var node = document.createElement(tag);
  if (attrs) {
    Object.keys(attrs).forEach(function (key) {
      if (key === 'text') {
        node.textContent = attrs[key];
      } else {
        node.setAttribute(key, attrs[key]);
      }
    });
  }
  (children || []).forEach(function (child) {
    if (child) node.appendChild(child);
  });
  return node;
}

function formatPrice(price) {
  return Number(price).toLocaleString('th-TH');
}

/* ==========================================================
   1) product.html — product cards + mood filter
   ========================================================== */
function initProductPage() {
  var filterBar = document.getElementById('filter-bar');
  var productList = document.getElementById('product-list');
  if (!filterBar || !productList) return;

  var products = [];

  function getInitialMood() {
    var param = new URLSearchParams(window.location.search).get('mood');
    var mood = param ? param.toLowerCase() : 'all';
    var valid = MOODS.some(function (m) { return m.key === mood; });
    return valid ? mood : 'all';
  }

  function renderFilters(activeMood) {
    filterBar.textContent = '';
    MOODS.forEach(function (m) {
      var button = el('button', {
        type: 'button',
        class: 'filter-btn' + (m.key === activeMood ? ' is-active' : ''),
        'aria-pressed': m.key === activeMood ? 'true' : 'false',
        'data-mood': m.key === 'all' ? '' : m.key
      });
      if (m.key !== 'all') {
        button.appendChild(el('span', { class: 'mood-dot' }));
      }
      button.appendChild(document.createTextNode(m.label));
      button.addEventListener('click', function () {
        selectMood(m.key);
      });
      filterBar.appendChild(button);
    });
  }

  function buildOrderUrl(product) {
    var itemName = product.name + (product.size ? ' ' + product.size : '');
    return (
      'order.html?item=' + encodeURIComponent(itemName) +
      '&price=' + encodeURIComponent(product.price)
    );
  }

  function buildCard(product) {
    var moodLabel = product.mood.charAt(0).toUpperCase() + product.mood.slice(1);
    var sizeLabel = product.size ? product.size : 'โรลออน';

    var image = el('img', {
      src: product.image,
      alt: product.name,
      loading: 'lazy'
    });

    var meta = el('div', { class: 'product-card__meta' }, [
      el('span', { class: 'mood-dot' }),
      el('span', { text: moodLabel + ' · ' + sizeLabel })
    ]);

    var name = el('h3', { class: 'product-card__name', text: product.name });

    var price = el('span', { class: 'price' }, [
      document.createTextNode(formatPrice(product.price) + ' '),
      el('small', { text: 'บาท' })
    ]);

    var orderBtn = el('a', {
      class: 'btn btn--small',
      href: buildOrderUrl(product),
      text: 'สั่งซื้อ'
    });

    var footer = el('div', { class: 'product-card__footer' }, [price, orderBtn]);

    return el('article', { class: 'product-card', 'data-mood': product.mood }, [
      el('div', { class: 'product-card__image' }, [image]),
      el('div', { class: 'product-card__body' }, [meta, name, footer])
    ]);
  }

  function renderProducts(activeMood) {
    productList.textContent = '';
    var visible = products.filter(function (p) {
      return activeMood === 'all' || p.mood === activeMood;
    });
    if (visible.length === 0) {
      productList.appendChild(el('p', { text: 'ยังไม่มีสินค้าในหมวดนี้' }));
      return;
    }
    visible.forEach(function (p) {
      productList.appendChild(buildCard(p));
    });
  }

  function selectMood(mood) {
    renderFilters(mood);
    renderProducts(mood);
    // keep the URL in sync so the filtered view can be shared
    var url = new URL(window.location.href);
    if (mood === 'all') {
      url.searchParams.delete('mood');
    } else {
      url.searchParams.set('mood', mood);
    }
    window.history.replaceState(null, '', url.toString());
  }

  fetch(PRODUCTS_URL)
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(function (data) {
      products = data;
      var mood = getInitialMood();
      renderFilters(mood);
      renderProducts(mood);
    })
    .catch(function (error) {
      console.error(error);
      productList.textContent = 'ไม่สามารถโหลดรายการสินค้าได้ กรุณาลองใหม่อีกครั้ง';
    });
}

/* ==========================================================
   2) order.html — prefill from URL + submit to Apps Script
   ========================================================== */
function initOrderPage() {
  var form = document.getElementById('orderForm');
  if (!form) return;

  // Prefill #items and #total from ?item=...&price=...
  var params = new URLSearchParams(window.location.search);
  var item = params.get('item');
  var price = params.get('price');

  var itemsInput = document.getElementById('items');
  var totalInput = document.getElementById('total');

  if (item !== null && itemsInput) itemsInput.value = item;
  if (price !== null && totalInput) totalInput.value = price;

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var submitBtn = form.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    var payload = {
      customerName: document.getElementById('customerName').value.trim(),
      contact: document.getElementById('contact').value.trim(),
      items: document.getElementById('items').value.trim(),
      total: document.getElementById('total').value.trim(),
      note: document.getElementById('note').value.trim()
    };

    fetch('https://script.google.com/macros/s/AKfycbzMwvF0BHI_Z9P1oXoVuxh3DXUUIkacuKpyWRflXOgrcUv38gA4esdpVQQ0JMT_5EV5/exec', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
    .then(() => { window.location.href = 'thankyou.html'; })
    .catch(error => {
      console.error(error);
      alert('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      if (submitBtn) submitBtn.disabled = false;
    });
  });
}

/* ==========================================================
   3) admin.html — read published CSV and show newest first
   ========================================================== */

// Minimal CSV parser: handles quoted fields, escaped quotes (""),
// commas and line breaks inside quotes, CRLF/LF, and a leading BOM.
function parseCSV(text) {
  var rows = [];
  var row = [];
  var field = '';
  var inQuotes = false;

  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  for (var i = 0; i < text.length; i++) {
    var c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // drop completely empty lines
  return rows.filter(function (r) {
    return r.some(function (cell) { return cell.trim() !== ''; });
  });
}

function initAdminPage() {
  var tbody = document.querySelector('#ordersTable tbody');
  if (!tbody) return;

  var COLUMN_COUNT = 6;

  function showMessage(message) {
    tbody.textContent = '';
    var cell = el('td', { colspan: String(COLUMN_COUNT), text: message });
    tbody.appendChild(el('tr', null, [cell]));
  }

  showMessage('กำลังโหลดข้อมูล...');

  // timestamp param helps avoid a stale cached copy
  var url = SHEET_CSV_URL + '&_=' + Date.now();

  fetch(url)
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then(function (text) {
      var rows = parseCSV(text);

      // If the sheet has a header row (first cell has no digits, so it is not a date), skip it
      if (rows.length > 0 && !/\d/.test(rows[0][0])) rows.shift();

      if (rows.length === 0) {
        showMessage('ยังไม่มีรายการสั่งซื้อ');
        return;
      }

      // Rows are appended at the bottom of the sheet, so reverse = newest first
      rows.reverse();

      tbody.textContent = '';
      rows.forEach(function (r) {
        var cells = [];
        for (var i = 0; i < COLUMN_COUNT; i++) {
          cells.push(el('td', { text: r[i] !== undefined ? r[i] : '' }));
        }
        tbody.appendChild(el('tr', null, cells));
      });
    })
    .catch(function (error) {
      console.error(error);
      showMessage('ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง');
    });
}

/* ---------- Start ---------- */
function initPage() {
  initProductPage();
  initOrderPage();
  initAdminPage();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPage);
} else {
  initPage();
}
