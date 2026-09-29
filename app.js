/* Tanzeemo Tool — app.js
   Single-page savings group tracker. All data lives in localStorage.
   No build step, no external dependencies. */
(function () {
'use strict';

var LS_KEY = 'tanzeemotool_v1';

/* ---------- utilities ---------- */
function uid() {
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function currentMonth() { return todayStr().slice(0, 7); }
function monthLabel(ym) {
  var parts = ym.split('-');
  var d = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}
function fmtDate(iso) {
  if (!iso) return '–';
  var p = iso.split('-');
  if (p.length < 3) return esc(iso);
  var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ---------- data ---------- */
function defaultData() {
  var members = [
    { id: uid(), name: 'Aqila' },
    { id: uid(), name: 'Nizar' },
    { id: uid(), name: 'Virgina' },
    { id: uid(), name: 'Illiana' }
  ];
  var shares = {};
  members.forEach(function (m) { shares[m.id] = 25; });
  return {
    members: members,
    contributions: [],   // {id, memberId, amount, date, note}
    monthlyTargets: {},  // memberId -> amount
    loans: [],           // {id, memberId, amount, date, note}
    repayments: [],      // {id, loanId, amount, date, note}
    profits: [],         // {id, amount, date, note}
    profitShares: shares,// memberId -> percent
    settings: { currency: 'Rs' }
  };
}

var data;
function load() {
  try {
    var raw = localStorage.getItem(LS_KEY);
    if (raw) { data = JSON.parse(raw); normalize(); return; }
  } catch (e) { /* corrupted -> reset to defaults */ }
  data = defaultData();
  save();
}
function normalize() {
  data.members = data.members || [];
  data.contributions = data.contributions || [];
  data.monthlyTargets = data.monthlyTargets || {};
  data.loans = data.loans || [];
  data.repayments = data.repayments || [];
  data.profits = data.profits || [];
  data.profitShares = data.profitShares || {};
  data.settings = data.settings || { currency: 'Rs' };
  // ensure every member has a profit share entry
  data.members.forEach(function (m) {
    if (typeof data.profitShares[m.id] !== 'number') data.profitShares[m.id] = 0;
  });
}
function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); }
  catch (e) { alert('Could not save data: browser storage is unavailable or full.'); }
}

function fmt(n) {
  var v = Number(n) || 0;
  return esc(data.settings.currency) + ' ' + v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
function memberName(id) {
  var m = null;
  data.members.forEach(function (x) { if (x.id === id) m = x; });
  return m ? m.name : '—';
}
function $(id) { return document.getElementById(id); }

/* ---------- aggregations ---------- */
function memberContributed(id) {
  return data.contributions.filter(function (c) { return c.memberId === id; })
    .reduce(function (s, c) { return s + Number(c.amount); }, 0);
}
function totalContributions() {
  return data.contributions.reduce(function (s, c) { return s + Number(c.amount); }, 0);
}
function loanRepaid(loanId) {
  return data.repayments.filter(function (r) { return r.loanId === loanId; })
    .reduce(function (s, r) { return s + Number(r.amount); }, 0);
}
function loanOutstanding(loan) {
  return Math.max(0, Number(loan.amount) - loanRepaid(loan.id));
}
function memberLoanBalance(id) {
  return data.loans.filter(function (l) { return l.memberId === id; })
    .reduce(function (s, l) { return s + loanOutstanding(l); }, 0);
}
function totalOutstanding() {
  return data.loans.reduce(function (s, l) { return s + loanOutstanding(l); }, 0);
}
function totalProfit() {
  return data.profits.reduce(function (s, p) { return s + Number(p.amount); }, 0);
}
function memberProfitShare(id) {
  return totalProfit() * (Number(data.profitShares[id]) || 0) / 100;
}
function memberMonthSaved(id, ym) {
  return data.contributions
    .filter(function (c) { return c.memberId === id && c.date.slice(0, 7) === ym; })
    .reduce(function (s, c) { return s + Number(c.amount); }, 0);
}

/* ---------- tabs ---------- */
function initTabs() {
  var tabs = document.querySelectorAll('.tab');
  tabs.forEach(function (btn) {
    btn.addEventListener('click', function () {
      tabs.forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      $('tab-' + btn.getAttribute('data-tab')).classList.add('active');
    });
  });
}

/* ---------- dashboard ---------- */
function renderDashboard() {
  $('d-total-savings').textContent = fmt(totalContributions());
  $('d-total-loans').textContent = fmt(totalOutstanding());
  $('d-total-profit').textContent = fmt(totalProfit());
  $('d-members').innerHTML = data.members.map(function (m) {
    return '<div class="member-card"><h3>' + esc(m.name) + '</h3><dl>' +
      '<div class="row"><dt>Total contributed</dt><dd>' + fmt(memberContributed(m.id)) + '</dd></div>' +
      '<div class="row"><dt>Loan balance</dt><dd>' + fmt(memberLoanBalance(m.id)) + '</dd></div>' +
      '<div class="row"><dt>Profit share</dt><dd>' + fmt(memberProfitShare(m.id)) + '</dd></div>' +
      '</dl></div>';
  }).join('') || '<p class="empty">No members yet.</p>';
}

/* ---------- contributions ---------- */
var cFilter = { memberId: '', month: '' };

function fillMemberSelect(sel, includeAll) {
  sel.innerHTML = (includeAll ? '<option value="">All members</option>' : '') +
    data.members.map(function (m) { return '<option value="' + m.id + '">' + esc(m.name) + '</option>'; }).join('');
}

function renderContributions() {
  fillMemberSelect($('c-member'), false);
  var fm = $('c-filter-member');
  var prev = fm.value || cFilter.memberId;
  fillMemberSelect(fm, true);
  fm.value = prev;
  cFilter.memberId = fm.value;

  var list = data.contributions.slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
  if (cFilter.memberId) list = list.filter(function (c) { return c.memberId === cFilter.memberId; });
  if (cFilter.month) list = list.filter(function (c) { return c.date.slice(0, 7) === cFilter.month; });

  $('c-list').innerHTML = list.map(function (c) {
    return '<div class="list-item"><div class="top">' +
      '<div><strong>' + esc(memberName(c.memberId)) + '</strong>' +
      '<div class="meta">' + fmtDate(c.date) + '</div></div>' +
      '<div class="amount">' + fmt(c.amount) + '</div></div>' +
      (c.note ? '<div class="note">' + esc(c.note) + '</div>' : '') +
      '<div class="actions"><button class="btn small" data-del="contribution" data-id="' + c.id + '">Delete</button></div></div>';
  }).join('') || '<p class="empty">No contributions recorded yet.</p>';
}

function initContributions() {
  $('c-date').value = todayStr();
  $('c-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var amount = parseFloat($('c-amount').value);
    if (!(amount > 0)) { alert('Please enter a valid amount.'); return; }
    if (!$('c-member').value || !$('c-date').value) { alert('Please choose a member and date.'); return; }
    data.contributions.push({
      id: uid(), memberId: $('c-member').value, amount: amount,
      date: $('c-date').value, note: $('c-note').value.trim()
    });
    save();
    $('c-amount').value = ''; $('c-note').value = '';
    renderAll();
  });
  $('c-filter-member').addEventListener('change', function () { cFilter.memberId = this.value; renderContributions(); });
  $('c-filter-month').addEventListener('change', function () { cFilter.month = this.value; renderContributions(); });
  $('c-clear-filters').addEventListener('click', function () {
    cFilter = { memberId: '', month: '' };
    $('c-filter-member').value = ''; $('c-filter-month').value = '';
    renderContributions();
  });
}

/* ---------- monthly savings ---------- */
function renderMonthly() {
  // target editor
  $('m-targets').innerHTML = data.members.map(function (m) {
    var t = Number(data.monthlyTargets[m.id]) || 0;
    return '<label>' + esc(m.name) + ' target' +
      '<input type="number" min="0" step="0.01" inputmode="decimal" data-target-for="' + m.id + '" value="' + t + '"></label>';
  }).join('');

  var ym = $('m-month').value || currentMonth();
  $('m-month').value = ym;
  $('m-view').innerHTML = data.members.map(function (m) {
    var saved = memberMonthSaved(m.id, ym);
    var target = Number(data.monthlyTargets[m.id]) || 0;
    var pct = target > 0 ? Math.min(100, Math.round(saved / target * 100)) : (saved > 0 ? 100 : 0);
    var remaining = Math.max(0, target - saved);
    return '<div class="list-item month-row"><div class="top">' +
      '<div><strong>' + esc(m.name) + '</strong>' +
      '<div class="meta">' + monthLabel(ym) + '</div></div>' +
      '<div class="pct">' + pct + '%</div></div>' +
      '<div class="progress"><div class="' + (pct >= 100 ? 'full' : '') + '" style="width:' + pct + '%"></div></div>' +
      '<div class="numbers"><span>Saved: <strong>' + fmt(saved) + '</strong></span>' +
      '<span>Target: <strong>' + fmt(target) + '</strong></span>' +
      '<span>Remaining: <strong>' + fmt(remaining) + '</strong></span></div></div>';
  }).join('') || '<p class="empty">No members yet.</p>';

  // month-by-month history
  var months = {};
  data.contributions.forEach(function (c) {
    var m = c.date.slice(0, 7);
    months[m] = months[m] || {};
    months[m][c.memberId] = (months[m][c.memberId] || 0) + Number(c.amount);
  });
  var sorted = Object.keys(months).sort().reverse();
  $('m-history').innerHTML = sorted.map(function (m) {
    var total = Object.keys(months[m]).reduce(function (s, k) { return s + months[m][k]; }, 0);
    var detail = data.members.map(function (mem) {
      return esc(mem.name) + ': ' + fmt(months[m][mem.id] || 0);
    }).join(' · ');
    return '<div class="list-item"><div class="history-month">' + monthLabel(m) +
      ' — ' + fmt(total) + '</div><div class="history-detail">' + detail + '</div></div>';
  }).join('') || '<p class="empty">No monthly records yet.</p>';
}

function initMonthly() {
  $('m-month').value = currentMonth();
  $('m-target-form').addEventListener('submit', function (e) {
    e.preventDefault();
    document.querySelectorAll('[data-target-for]').forEach(function (inp) {
      var v = parseFloat(inp.value);
      data.monthlyTargets[inp.getAttribute('data-target-for')] = (v > 0 ? v : 0);
    });
    save(); renderAll();
  });
  $('m-month').addEventListener('change', renderMonthly);
}

/* ---------- loans ---------- */
function renderLoans() {
  fillMemberSelect($('l-member'), false);

  $('l-summary').innerHTML = data.members.map(function (m) {
    return '<div class="member-card"><h3>' + esc(m.name) + '</h3><dl>' +
      '<div class="row"><dt>Outstanding</dt><dd>' + fmt(memberLoanBalance(m.id)) + '</dd></div>' +
      '</dl></div>';
  }).join('') || '<p class="empty">No members yet.</p>';

  var loans = data.loans.slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
  $('l-list').innerHTML = loans.map(function (l) {
    var repaid = loanRepaid(l.id);
    var bal = loanOutstanding(l);
    var cls = bal > 0 ? 'owed' : 'clear';
    var reps = data.repayments.filter(function (r) { return r.loanId === l.id; })
      .sort(function (a, b) { return b.date.localeCompare(a.date); });
    var repHtml = reps.map(function (r) {
      return '<div class="meta">Repaid ' + fmt(r.amount) + ' on ' + fmtDate(r.date) +
        (r.note ? ' — ' + esc(r.note) : '') +
        ' <button class="btn small" data-del="repayment" data-id="' + r.id + '">Delete</button></div>';
    }).join('');
    return '<div class="list-item loan-card"><div class="top">' +
      '<div><strong>' + esc(memberName(l.memberId)) + '</strong>' +
      '<div class="meta">Loaned on ' + fmtDate(l.date) + (l.note ? ' — ' + esc(l.note) : '') + '</div></div>' +
      '<div class="amount">' + fmt(l.amount) + '</div></div>' +
      '<div class="numbers" style="display:flex;justify-content:space-between;font-size:0.9rem;margin-top:0.3rem;">' +
      '<span>Repaid: <strong>' + fmt(repaid) + '</strong></span>' +
      '<span>Outstanding: <strong class="balance ' + cls + '">' + fmt(bal) + '</strong></span></div>' +
      repHtml +
      (bal > 0 ?
        '<form class="repay-form" data-repay-for="' + l.id + '">' +
        '<label>Repayment amount<input type="number" min="0.01" step="0.01" inputmode="decimal" required placeholder="0.00"></label>' +
        '<label>Date<input type="date" value="' + todayStr() + '" required></label>' +
        '<button type="submit" class="btn small primary">Add Repayment</button></form>'
        : '<div class="meta" style="margin-top:0.4rem;color:var(--good);font-weight:600;">Fully repaid ✓</div>') +
      '<div class="actions"><button class="btn small" data-del="loan" data-id="' + l.id + '">Delete Loan</button></div></div>';
  }).join('') || '<p class="empty">No loans recorded yet.</p>';

  // bind repayment forms (list is re-rendered, so bind fresh each time)
  document.querySelectorAll('[data-repay-for]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var inputs = form.querySelectorAll('input');
      var amount = parseFloat(inputs[0].value);
      if (!(amount > 0)) { alert('Please enter a valid repayment amount.'); return; }
      data.repayments.push({
        id: uid(), loanId: form.getAttribute('data-repay-for'),
        amount: amount, date: inputs[1].value || todayStr(), note: ''
      });
      save(); renderAll();
    });
  });
}

function initLoans() {
  $('l-date').value = todayStr();
  $('l-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var amount = parseFloat($('l-amount').value);
    if (!(amount > 0)) { alert('Please enter a valid amount.'); return; }
    if (!$('l-member').value || !$('l-date').value) { alert('Please choose a member and date.'); return; }
    data.loans.push({
      id: uid(), memberId: $('l-member').value, amount: amount,
      date: $('l-date').value, note: $('l-note').value.trim()
    });
    save();
    $('l-amount').value = ''; $('l-note').value = '';
    renderAll();
  });
}

/* ---------- profit ---------- */
function renderProfit() {
  $('p-total').textContent = fmt(totalProfit());

  $('p-shares').innerHTML = data.members.map(function (m) {
    var s = Number(data.profitShares[m.id]) || 0;
    return '<label>' + esc(m.name) + ' %' +
      '<input type="number" min="0" max="100" step="0.01" inputmode="decimal" data-share-for="' + m.id + '" value="' + s + '"></label>';
  }).join('');
  updateShareMsg();

  $('p-members').innerHTML = data.members.map(function (m) {
    var pct = Number(data.profitShares[m.id]) || 0;
    return '<div class="member-card"><h3>' + esc(m.name) + '</h3><dl>' +
      '<div class="row"><dt>Share</dt><dd>' + pct + '%</dd></div>' +
      '<div class="row"><dt>Amount</dt><dd>' + fmt(memberProfitShare(m.id)) + '</dd></div>' +
      '</dl></div>';
  }).join('') || '<p class="empty">No members yet.</p>';

  var list = data.profits.slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
  $('p-list').innerHTML = list.map(function (p) {
    return '<div class="list-item"><div class="top">' +
      '<div><div class="meta">' + fmtDate(p.date) + '</div></div>' +
      '<div class="amount good" style="color:var(--good)">' + fmt(p.amount) + '</div></div>' +
      (p.note ? '<div class="note">' + esc(p.note) + '</div>' : '') +
      '<div class="actions"><button class="btn small" data-del="profit" data-id="' + p.id + '">Delete</button></div></div>';
  }).join('') || '<p class="empty">No profit recorded yet.</p>';
}

function shareInputsTotal() {
  var t = 0;
  document.querySelectorAll('[data-share-for]').forEach(function (inp) { t += parseFloat(inp.value) || 0; });
  return t;
}
function updateShareMsg() {
  var t = shareInputsTotal();
  var msg = $('p-share-msg');
  msg.textContent = 'Total: ' + (Math.round(t * 100) / 100) + '% — shares must add up to exactly 100%.';
  msg.className = 'hint' + (Math.abs(t - 100) > 0.001 ? ' error' : '');
}

function initProfit() {
  $('p-date').value = todayStr();
  $('p-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var amount = parseFloat($('p-amount').value);
    if (!(amount > 0)) { alert('Please enter a valid amount.'); return; }
    if (!$('p-date').value) { alert('Please choose a date.'); return; }
    data.profits.push({ id: uid(), amount: amount, date: $('p-date').value, note: $('p-note').value.trim() });
    save();
    $('p-amount').value = ''; $('p-note').value = '';
    renderAll();
  });
  $('p-share-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var t = shareInputsTotal();
    if (Math.abs(t - 100) > 0.001) { alert('Shares must total exactly 100%. Current total: ' + (Math.round(t * 100) / 100) + '%'); return; }
    document.querySelectorAll('[data-share-for]').forEach(function (inp) {
      data.profitShares[inp.getAttribute('data-share-for')] = parseFloat(inp.value) || 0;
    });
    save(); renderAll();
  });
  document.addEventListener('input', function (e) {
    if (e.target && e.target.hasAttribute('data-share-for')) updateShareMsg();
  });
}

/* ---------- settings ---------- */
function renderSettings() {
  $('s-currency').value = data.settings.currency || '';
  $('s-members').innerHTML = data.members.map(function (m, i) {
    return '<label>Member ' + (i + 1) +
      '<input type="text" maxlength="40" data-member-name="' + m.id + '" value="' + esc(m.name) + '" required></label>';
  }).join('');
}

function initSettings() {
  $('s-currency-form').addEventListener('submit', function (e) {
    e.preventDefault();
    data.settings.currency = $('s-currency').value.trim() || 'Rs';
    save(); renderAll();
    alert('Currency saved.');
  });
  $('s-members-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var ok = true;
    document.querySelectorAll('[data-member-name]').forEach(function (inp) {
      var v = inp.value.trim();
      if (!v) ok = false;
      data.members.forEach(function (m) { if (m.id === inp.getAttribute('data-member-name')) m.name = v || m.name; });
    });
    if (!ok) { alert('Member names cannot be empty.'); return; }
    save(); renderAll();
    alert('Member names saved.');
  });
  $('s-export').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tanzeemotool-backup-' + todayStr() + '.json';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  });
  $('s-import').addEventListener('change', function () {
    var f = this.files && this.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var obj = JSON.parse(reader.result);
        if (!obj || !Array.isArray(obj.members) || !Array.isArray(obj.contributions)) {
          alert('That file does not look like a Tanzeemo Tool backup.'); return;
        }
        if (!confirm('Import this backup? It will REPLACE all current data in this browser.')) return;
        data = obj; normalize(); save(); renderAll();
        alert('Backup imported.');
      } catch (err) { alert('Could not read that file: ' + err.message); }
    };
    reader.readAsText(f);
    this.value = '';
  });
  $('s-reset').addEventListener('click', function () {
    if (!confirm('Delete ALL data (members, contributions, loans, repayments, profits)? This cannot be undone.')) return;
    if (!confirm('Are you really sure? All records will be permanently erased from this browser.')) return;
    localStorage.removeItem(LS_KEY);
    data = defaultData(); save(); renderAll();
  });
}

/* ---------- delete handling (event delegation) ---------- */
function initDeletes() {
  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-del]') : null;
    if (!btn) return;
    var type = btn.getAttribute('data-del');
    var id = btn.getAttribute('data-id');
    var label = { contribution: 'this contribution', loan: 'this loan and its repayments', repayment: 'this repayment', profit: 'this profit entry' }[type] || 'this record';
    if (!confirm('Delete ' + label + '?')) return;
    if (type === 'contribution') data.contributions = data.contributions.filter(function (c) { return c.id !== id; });
    else if (type === 'loan') {
      data.loans = data.loans.filter(function (l) { return l.id !== id; });
      data.repayments = data.repayments.filter(function (r) { return r.loanId !== id; });
    }
    else if (type === 'repayment') data.repayments = data.repayments.filter(function (r) { return r.id !== id; });
    else if (type === 'profit') data.profits = data.profits.filter(function (p) { return p.id !== id; });
    save(); renderAll();
  });
}

/* ---------- boot ---------- */
function renderAll() {
  renderDashboard();
  renderContributions();
  renderMonthly();
  renderLoans();
  renderProfit();
  renderSettings();
}

load();
initTabs();
initContributions();
initMonthly();
initLoans();
initProfit();
initSettings();
initDeletes();
renderAll();

})();
