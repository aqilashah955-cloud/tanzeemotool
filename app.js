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
    loans: [],           // {id, memberId, amount, date, note, interestPct, interestAmount, installmentCount}
    repayments: [],      // {id, loanId, amount, date, note}
    installments: [],    // {id, loanId, n, dueDate, amount} — auto-generated plan per loan
    profits: [],         // {id, amount, date, note}
    profitShares: shares,// memberId -> percent
    meetings: [],        // {id, date, hostMemberId, attendeeIds: [], agenda, summary}
    tours: [],           // {id, name, destination, startDate, endDate, costPerMember, notes}
    tourPayments: [],    // {id, tourId, memberId, amount, date, note}
    tourExpenses: [],    // {id, tourId, amount, date, note}
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
  data.installments = data.installments || [];
  data.profits = data.profits || [];
  data.profitShares = data.profitShares || {};
  data.meetings = data.meetings || [];
  data.tours = data.tours || [];
  data.tourPayments = data.tourPayments || [];
  data.tourExpenses = data.tourExpenses || [];
  data.settings = data.settings || { currency: 'Rs' };
  // normalize loan records (forward-compatible with older backups)
  data.loans.forEach(function (l) {
    if (typeof l.interestPct !== 'number') l.interestPct = 0;
    if (typeof l.interestAmount !== 'number') l.interestAmount = 0;
    if (typeof l.installmentCount !== 'number' || l.installmentCount < 1) l.installmentCount = 1;
  });
  // normalize installment records
  data.installments.forEach(function (it) {
    it.loanId = it.loanId || '';
    it.n = Number(it.n) || 0;
    it.dueDate = it.dueDate || '';
    it.amount = Number(it.amount) || 0;
  });
  // ensure every member has a profit share entry and a phone field
  data.members.forEach(function (m) {
    if (typeof data.profitShares[m.id] !== 'number') data.profitShares[m.id] = 0;
    if (m.phone == null) m.phone = '';
  });
  // normalize meeting records (forward-compatible with older backups)
  data.meetings.forEach(function (mt) {
    mt.date = mt.date || '';
    mt.hostMemberId = mt.hostMemberId || '';
    mt.attendeeIds = mt.attendeeIds || [];
    mt.agenda = mt.agenda || '';
    mt.summary = mt.summary || '';
  });
  // normalize tour records (forward-compatible with older backups)
  data.tours.forEach(function (t) {
    t.name = t.name || '';
    t.destination = t.destination || '';
    t.startDate = t.startDate || '';
    t.endDate = t.endDate || '';
    t.costPerMember = Number(t.costPerMember) || 0;
    t.notes = t.notes || '';
  });
  data.tourPayments.forEach(function (p) {
    p.tourId = p.tourId || '';
    p.memberId = p.memberId || '';
    p.amount = Number(p.amount) || 0;
    p.date = p.date || '';
    p.note = p.note || '';
  });
  data.tourExpenses.forEach(function (e) {
    e.tourId = e.tourId || '';
    e.amount = Number(e.amount) || 0;
    e.date = e.date || '';
    e.note = e.note || '';
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
function loanInterest(l) {
  return Number(l.interestAmount) || 0;
}
function loanTotalOwed(l) {
  return (Number(l.amount) || 0) + loanInterest(l);
}
function loanOutstanding(loan) {
  var bal = loanTotalOwed(loan) - loanRepaid(loan.id);
  return Math.max(0, Math.round(bal * 100) / 100);
}
function memberLoanBalance(id) {
  return data.loans.filter(function (l) { return l.memberId === id; })
    .reduce(function (s, l) { return s + loanOutstanding(l); }, 0);
}
function totalOutstanding() {
  return data.loans.reduce(function (s, l) { return s + loanOutstanding(l); }, 0);
}

/* ---------- installments ---------- */
function addMonths(iso, n) {
  var p = String(iso).split('-');
  var y = Number(p[0]) || 1970, m = (Number(p[1]) || 1) - 1 + n, d = Number(p[2]) || 1;
  y += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  var lastDay = new Date(y, m + 1, 0).getDate();
  return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(Math.min(d, lastDay)).padStart(2, '0');
}
function installmentsFor(loanId) {
  return data.installments.filter(function (i) { return i.loanId === loanId; })
    .sort(function (a, b) { return a.n - b.n; });
}
// Build an installment plan for a loan. Amounts are computed in cents so the
// installments always sum to principal + interest exactly (last one adjusted).
function buildInstallments(loan, firstDue) {
  var k = Math.max(1, Math.round(Number(loan.installmentCount) || 1));
  if (k <= 1) return [];
  var totalCents = Math.round(loanTotalOwed(loan) * 100);
  var base = Math.floor(totalCents / k);
  var out = [];
  for (var i = 1; i <= k; i++) {
    var cents = (i === k) ? (totalCents - base * (k - 1)) : base;
    out.push({ id: uid(), loanId: loan.id, n: i, dueDate: addMonths(firstDue, i - 1), amount: cents / 100 });
  }
  return out;
}
// Allocate a loan's repayments across its installments in order (FIFO).
// Returns [{inst, paid, unpaid, status}]
function installmentProgress(loanId) {
  var insts = installmentsFor(loanId);
  if (insts.length <= 1) return [];
  var remaining = loanRepaid(loanId);
  var today = todayStr();
  return insts.map(function (it) {
    var paid = Math.min(it.amount, Math.max(0, remaining));
    remaining = Math.max(0, remaining - paid);
    var unpaid = Math.round((it.amount - paid) * 100) / 100;
    var status, cls;
    if (unpaid <= 0.005) { status = 'Paid'; cls = 'status-paid'; }
    else if (paid > 0.005) { status = 'Partially paid'; cls = 'status-partial'; }
    else if (it.dueDate < today) { status = 'Overdue'; cls = 'status-overdue'; }
    else { status = 'Pending'; cls = 'status-unpaid'; }
    return { inst: it, paid: paid, unpaid: unpaid, status: status, cls: cls };
  });
}
function overdueInstallments() {
  var out = [];
  data.loans.forEach(function (l) {
    installmentProgress(l.id).forEach(function (pr) {
      if (pr.status === 'Overdue') out.push({ loan: l, inst: pr.inst, unpaid: pr.unpaid });
    });
  });
  out.sort(function (a, b) { return a.inst.dueDate.localeCompare(b.inst.dueDate); });
  return out;
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
function sortedTours() {
  return data.tours.slice().sort(function (a, b) {
    return (b.startDate || '').localeCompare(a.startDate || '');
  });
}
function latestTour() { return sortedTours()[0] || null; }
function tourById(id) {
  var t = null;
  data.tours.forEach(function (x) { if (x.id === id) t = x; });
  return t;
}
function tourCollected(tourId) {
  return data.tourPayments.filter(function (p) { return p.tourId === tourId; })
    .reduce(function (s, p) { return s + Number(p.amount); }, 0);
}
function tourSpent(tourId) {
  return data.tourExpenses.filter(function (e) { return e.tourId === tourId; })
    .reduce(function (s, e) { return s + Number(e.amount); }, 0);
}
function memberTourPaid(tourId, memberId) {
  return data.tourPayments.filter(function (p) { return p.tourId === tourId && p.memberId === memberId; })
    .reduce(function (s, p) { return s + Number(p.amount); }, 0);
}
function tourMembersPaidFull(tour) {
  var cost = Number(tour.costPerMember) || 0;
  if (cost <= 0) return 0;
  return data.members.filter(function (m) { return memberTourPaid(tour.id, m.id) >= cost; }).length;
}
function tourExpectedTotal(tour) {
  return (Number(tour.costPerMember) || 0) * data.members.length;
}
function tourDatesLabel(t) {
  if (t.startDate && t.endDate) return fmtDate(t.startDate) + ' → ' + fmtDate(t.endDate);
  if (t.startDate) return 'From ' + fmtDate(t.startDate);
  if (t.endDate) return 'Until ' + fmtDate(t.endDate);
  return 'Dates not set';
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
function latestMeeting() {
  if (!data.meetings.length) return null;
  return data.meetings.slice().sort(function (a, b) { return b.date.localeCompare(a.date); })[0];
}
function renderLatestMeeting() {
  var box = $('d-latest-meeting');
  var mt = latestMeeting();
  if (!mt) { box.innerHTML = '<p class="empty">No meetings recorded yet.</p>'; return; }
  var host = mt.hostMemberId ? esc(memberName(mt.hostMemberId)) + '&#8217;s home' : '&#8212;';
  var s = mt.summary || '';
  var trunc = s.length > 220 ? s.slice(0, 220) + '…' : s;
  box.innerHTML = '<h3>' + fmtDate(mt.date) + ' — Hosted at ' + host + '</h3>' +
    (trunc ? '<div class="summary-text">' + esc(trunc) + '</div>'
           : '<p class="empty">No summary written yet.</p>') +
    '<p class="hint" style="margin-bottom:0">View the full summary in the Meetings tab.</p>';
}
function renderLatestTour() {
  var box = $('d-latest-tour');
  var t = latestTour();
  if (!t) { box.innerHTML = '<p class="empty">No tour planned yet.</p>'; return; }
  var collected = tourCollected(t.id);
  var expected = tourExpectedTotal(t);
  var pct = expected > 0 ? Math.min(100, Math.round(collected / expected * 100)) : 0;
  box.innerHTML = '<h3>' + esc(t.name) + '</h3>' +
    '<p class="hint" style="margin:0.25rem 0">' + esc(t.destination) + ' · ' + tourDatesLabel(t) + '</p>' +
    '<div class="progress"><div class="' + (pct >= 100 ? 'full' : '') + '" style="width:' + pct + '%"></div></div>' +
    '<div class="numbers" style="display:flex;justify-content:space-between;font-size:0.9rem;margin-top:0.25rem;">' +
    '<span>Collected: <strong>' + fmt(collected) + '</strong></span>' +
    '<span>Expected: <strong>' + fmt(expected) + '</strong></span></div>' +
    '<p class="hint" style="margin-bottom:0">See the Tours tab for details.</p>';
}
function renderDashboard() {
  $('d-total-savings').textContent = fmt(totalContributions());
  $('d-total-loans').textContent = fmt(totalOutstanding());
  $('d-total-profit').textContent = fmt(totalProfit());
  var od = overdueInstallments();
  var odTotal = od.reduce(function (s, o) { return s + o.unpaid; }, 0);
  $('d-overdue-count').textContent = od.length;
  $('d-overdue-amt').textContent = od.length ? fmt(odTotal) + ' overdue' : 'All clear ✓';
  renderLatestMeeting();
  renderLatestTour();
  $('d-members').innerHTML = data.members.map(function (m) {
    return '<div class="member-card"><h3>' + esc(m.name) + '</h3><dl>' +
      '<div class="row"><dt>Total contributed</dt><dd>' + fmt(memberContributed(m.id)) + '</dd></div>' +
      '<div class="row"><dt>Loan balance</dt><dd>' + fmt(memberLoanBalance(m.id)) + '</dd></div>' +
      '<div class="row"><dt>Profit share</dt><dd>' + fmt(memberProfitShare(m.id)) + '</dd></div>' +
      '</dl></div>';
  }).join('') || '<p class="empty">No members yet.</p>';
}

/* ---------- members ---------- */
var mmSearch = '';

function renderMembers() {
  var ym = currentMonth();
  var q = mmSearch.trim().toLowerCase();
  var list = data.members.filter(function (m) { return !q || m.name.toLowerCase().indexOf(q) !== -1; });
  $('mm-count').textContent = '— ' + data.members.length + ' member' + (data.members.length === 1 ? '' : 's');
  $('mm-list').innerHTML = list.length ?
    '<div class="table-wrap"><table class="members-table"><thead><tr>' +
    '<th>Name</th><th>Phone</th><th>Total contributed</th><th>This month (saved / target)</th>' +
    '<th>Loan balance</th><th>Profit share</th><th></th>' +
    '</tr></thead><tbody>' + list.map(function (m) {
      var saved = memberMonthSaved(m.id, ym);
      var target = Number(data.monthlyTargets[m.id]) || 0;
      return '<tr><td><strong>' + esc(m.name) + '</strong></td>' +
        '<td>' + (m.phone ? esc(m.phone) : '<span class="dim">–</span>') + '</td>' +
        '<td>' + fmt(memberContributed(m.id)) + '</td>' +
        '<td>' + fmt(saved) + ' / ' + fmt(target) + '</td>' +
        '<td>' + fmt(memberLoanBalance(m.id)) + '</td>' +
        '<td>' + fmt(memberProfitShare(m.id)) + '</td>' +
        '<td><button class="btn small" data-del="member" data-id="' + m.id + '">Delete</button></td></tr>';
    }).join('') + '</tbody></table></div>'
    : '<p class="empty">No members found.</p>';
}

function deleteMember(id) {
  var m = null;
  data.members.forEach(function (x) { if (x.id === id) m = x; });
  var name = m ? m.name : 'this member';
  if (!confirm('Delete member "' + name + '"? This will also remove ALL of their contributions, loans, repayments, targets, tour payments and profit share.')) return;
  if (!confirm('Are you really sure? "' + name + '" and all their records will be permanently deleted.')) return;
  // cascade: contributions
  data.contributions = data.contributions.filter(function (c) { return c.memberId !== id; });
  // cascade: tour payments
  data.tourPayments = data.tourPayments.filter(function (p) { return p.memberId !== id; });
  // cascade: loans + their repayments
  var loanIds = {};
  data.loans.forEach(function (l) { if (l.memberId === id) loanIds[l.id] = true; });
  data.loans = data.loans.filter(function (l) { return l.memberId !== id; });
  data.repayments = data.repayments.filter(function (r) { return !loanIds[r.loanId]; });
  data.installments = data.installments.filter(function (i) { return !loanIds[i.loanId]; });
  // cascade: targets, profit shares
  delete data.monthlyTargets[id];
  delete data.profitShares[id];
  // remove from meeting attendee lists; clear host if it was theirs
  data.meetings.forEach(function (mt) {
    mt.attendeeIds = mt.attendeeIds.filter(function (a) { return a !== id; });
    if (mt.hostMemberId === id) mt.hostMemberId = '';
  });
  // remove member record
  data.members = data.members.filter(function (x) { return x.id !== id; });
  save(); renderAll();
}

function initMembers() {
  $('mm-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('mm-name').value.trim();
    if (!name) { alert('Please enter a member name.'); return; }
    var m = { id: uid(), name: name, phone: $('mm-phone').value.trim() };
    data.members.push(m);
    data.profitShares[m.id] = 0; // normalize() also guarantees this
    save();
    $('mm-name').value = ''; $('mm-phone').value = '';
    renderAll();
  });
  $('mm-search').addEventListener('input', function () { mmSearch = this.value; renderMembers(); });
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

/* ---------- meetings ---------- */
var editingMeetingId = null;
var mtFormTouched = false;
var mtAttSearch = '';

function suggestedHost() {
  // member who has hosted least recently (never-hosted members first)
  var lastHosted = {}; // memberId -> latest host date
  data.meetings.forEach(function (mt) {
    if (mt.hostMemberId && (!lastHosted[mt.hostMemberId] || mt.date > lastHosted[mt.hostMemberId])) {
      lastHosted[mt.hostMemberId] = mt.date;
    }
  });
  var sorted = data.members.slice().sort(function (a, b) {
    var la = lastHosted[a.id], lb = lastHosted[b.id];
    if (!la && lb) return -1;
    if (la && !lb) return 1;
    if (!la && !lb) return 0;
    return la.localeCompare(lb); // oldest hosting date first
  });
  return sorted[0] || null;
}

function checkedAttendees() {
  var ids = [];
  document.querySelectorAll('#mt-attendees input[type=checkbox]:checked').forEach(function (cb) { ids.push(cb.value); });
  return ids;
}

function renderAttendeeChecklist(checkedIds) {
  var q = mtAttSearch.trim().toLowerCase();
  var list = data.members.filter(function (m) { return !q || m.name.toLowerCase().indexOf(q) !== -1; });
  $('mt-attendees').innerHTML = list.map(function (m) {
    var c = checkedIds.indexOf(m.id) !== -1 ? ' checked' : '';
    return '<label><input type="checkbox" value="' + m.id + '"' + c + '>' + esc(m.name) + '</label>';
  }).join('') || '<p class="empty">No members match.</p>';
}

function fillHostSelect(selectedId) {
  $('mt-host').innerHTML = '<option value="">—</option>' +
    data.members.map(function (m) {
      return '<option value="' + m.id + '"' + (m.id === selectedId ? ' selected' : '') + '>' + esc(m.name) + '&#8217;s home</option>';
    }).join('');
}

function renderSuggestHint() {
  var s = suggestedHost();
  if (!s) { $('mt-suggest').textContent = ''; return; }
  var last = null;
  data.meetings.forEach(function (mt) {
    if (mt.hostMemberId === s.id && (!last || mt.date > last)) last = mt.date;
  });
  $('mt-suggest').textContent = 'Suggested next host: ' + s.name +
    (last ? ' (last hosted ' + fmtDate(last) + ')' : ' (has never hosted)');
}

function populateMeetingForm(mt) {
  // mt = meeting record to edit, or null for a new meeting
  editingMeetingId = mt ? mt.id : null;
  mtFormTouched = false;
  $('mt-id').value = mt ? mt.id : '';
  $('mt-date').value = mt ? mt.date : todayStr();
  fillHostSelect(mt ? mt.hostMemberId : '');
  renderSuggestHint();
  mtAttSearch = '';
  $('mt-att-search').value = '';
  renderAttendeeChecklist(mt ? mt.attendeeIds : data.members.map(function (m) { return m.id; }));
  $('mt-agenda').value = mt ? mt.agenda : '';
  $('mt-summary').value = mt ? mt.summary : '';
  $('mt-form-title').textContent = mt ? 'Edit Meeting' : 'Add Meeting';
  $('mt-save').textContent = mt ? 'Update Meeting' : 'Save Meeting';
  $('mt-cancel').hidden = !mt;
}

function resetMeetingForm() { populateMeetingForm(null); }

function renderMeetingForm() {
  // don't clobber a form the user is working on
  if (editingMeetingId || mtFormTouched) return;
  populateMeetingForm(null);
}

function renderMeetingHistory() {
  var list = data.meetings.slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
  $('mt-history').innerHTML = list.map(function (mt) {
    var host = mt.hostMemberId ? esc(memberName(mt.hostMemberId)) + '&#8217;s home' : '&#8212;';
    return '<div class="list-item"><div class="top">' +
      '<div><strong>' + fmtDate(mt.date) + '</strong>' +
      '<div class="meta">Hosted at ' + host + ' · ' + mt.attendeeIds.length + ' attendee' + (mt.attendeeIds.length === 1 ? '' : 's') + '</div></div>' +
      '</div>' +
      (mt.agenda ? '<div class="note"><strong>Agenda:</strong> ' + esc(mt.agenda) + '</div>' : '') +
      (mt.summary ? '<div class="summary-text">' + esc(mt.summary) + '</div>'
                  : '<p class="hint">No summary written.</p>') +
      '<div class="actions">' +
      '<button class="btn small" data-edit-meeting="' + mt.id + '">Edit</button>' +
      '<button class="btn small" data-del="meeting" data-id="' + mt.id + '">Delete</button>' +
      '</div></div>';
  }).join('') || '<p class="empty">No meetings recorded yet.</p>';
}

function renderMeetings() {
  renderMeetingForm();
  renderMeetingHistory();
}

function generateMeetingSummary(dateStr) {
  var ym = (dateStr || todayStr()).slice(0, 7);
  var att = checkedAttendees();
  if (!att.length) att = data.members.map(function (m) { return m.id; });
  var lines = [];
  lines.push('Meeting summary — ' + monthLabel(ym));
  lines.push('Date: ' + fmtDate(dateStr || todayStr()));
  var hostId = $('mt-host').value;
  lines.push('Hosted at: ' + (hostId ? memberName(hostId) + '’s home' : '—'));
  lines.push('Attendees (' + att.length + '): ' + att.map(function (id) { return memberName(id); }).join(', '));
  lines.push('');
  var monthTotal = data.contributions
    .filter(function (c) { return c.date.slice(0, 7) === ym; })
    .reduce(function (s, c) { return s + Number(c.amount); }, 0);
  lines.push('Total collected this month: ' + fmt(monthTotal));
  lines.push('');
  lines.push('Per-member savings (saved vs target):');
  data.members.forEach(function (m) {
    var saved = memberMonthSaved(m.id, ym);
    var target = Number(data.monthlyTargets[m.id]) || 0;
    var pct = target > 0 ? Math.round(saved / target * 100) : (saved > 0 ? 100 : 0);
    lines.push('- ' + m.name + ': ' + fmt(saved) + ' / ' + fmt(target) + ' (' + pct + '%)');
  });
  lines.push('');
  var loansM = data.loans.filter(function (l) { return l.date.slice(0, 7) === ym; });
  var loansTotal = loansM.reduce(function (s, l) { return s + Number(l.amount); }, 0);
  lines.push('Loans issued this month: ' + fmt(loansTotal) + ' (' + loansM.length + ' loan' + (loansM.length === 1 ? '' : 's') + ')');
  var repTotal = data.repayments
    .filter(function (r) { return r.date.slice(0, 7) === ym; })
    .reduce(function (s, r) { return s + Number(r.amount); }, 0);
  lines.push('Repayments received this month: ' + fmt(repTotal));
  var profTotal = data.profits
    .filter(function (p) { return p.date.slice(0, 7) === ym; })
    .reduce(function (s, p) { return s + Number(p.amount); }, 0);
  lines.push('Profit added this month: ' + fmt(profTotal));
  lines.push('Total savings pool to date: ' + fmt(totalContributions()));
  return lines.join('\n');
}

function initMeetings() {
  $('mt-form').addEventListener('input', function () { mtFormTouched = true; });
  $('mt-date').addEventListener('change', function () { mtFormTouched = true; });
  $('mt-host').addEventListener('change', function () { mtFormTouched = true; });
  $('mt-att-search').addEventListener('input', function () {
    mtAttSearch = this.value;
    renderAttendeeChecklist(checkedAttendees());
  });
  $('mt-generate').addEventListener('click', function () {
    var date = $('mt-date').value || todayStr();
    $('mt-summary').value = generateMeetingSummary(date);
    mtFormTouched = true;
  });
  $('mt-form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!$('mt-date').value) { alert('Please choose a meeting date.'); return; }
    var rec = {
      id: editingMeetingId || uid(),
      date: $('mt-date').value,
      hostMemberId: $('mt-host').value || '',
      attendeeIds: checkedAttendees(),
      agenda: $('mt-agenda').value.trim(),
      summary: $('mt-summary').value.trim()
    };
    if (editingMeetingId) {
      data.meetings = data.meetings.map(function (mt) { return mt.id === editingMeetingId ? rec : mt; });
    } else {
      data.meetings.push(rec);
    }
    save();
    resetMeetingForm();
    renderAll();
  });
  $('mt-cancel').addEventListener('click', function () {
    resetMeetingForm();
    renderMeetings();
  });
  // edit buttons (event delegation)
  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('[data-edit-meeting]') : null;
    if (!btn) return;
    var id = btn.getAttribute('data-edit-meeting');
    var mt = null;
    data.meetings.forEach(function (x) { if (x.id === id) mt = x; });
    if (!mt) return;
    populateMeetingForm(mt);
    $('mt-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/* ---------- tours ---------- */
var selectedTourId = null;
var tPaySearch = '';

function renderTourMembers() {
  var t = selectedTourId ? tourById(selectedTourId) : null;
  var box = $('t-pay-status');
  if (!box || !t) return;
  var cost = Number(t.costPerMember) || 0;
  var q = tPaySearch.trim().toLowerCase();
  var list = data.members.filter(function (m) { return !q || m.name.toLowerCase().indexOf(q) !== -1; });
  box.innerHTML = list.length ?
    '<div class="table-wrap"><table class="members-table"><thead><tr>' +
    '<th>Name</th><th>Paid</th><th>Remaining</th><th>Status</th>' +
    '</tr></thead><tbody>' + list.map(function (m) {
      var paid = memberTourPaid(t.id, m.id);
      var rem = Math.max(0, cost - paid);
      var st, cls;
      if (cost > 0 && paid >= cost) { st = 'Paid in full'; cls = 'status-paid'; }
      else if (paid > 0) { st = 'Partial'; cls = 'status-partial'; }
      else { st = 'Not paid'; cls = 'status-unpaid'; }
      return '<tr><td><strong>' + esc(m.name) + '</strong></td>' +
        '<td>' + fmt(paid) + '</td><td>' + fmt(rem) + '</td>' +
        '<td class="' + cls + '">' + st + '</td></tr>';
    }).join('') + '</tbody></table></div>'
    : '<p class="empty">No members found.</p>';
}

function renderTours() {
  var tours = sortedTours();
  if (!selectedTourId || !tourById(selectedTourId)) {
    selectedTourId = tours.length ? tours[0].id : null;
  }
  var sel = $('t-select');
  sel.innerHTML = tours.map(function (t) {
    return '<option value="' + t.id + '"' + (t.id === selectedTourId ? ' selected' : '') + '>' +
      esc(t.name) + (t.destination ? ' — ' + esc(t.destination) : '') + '</option>';
  }).join('');

  var box = $('t-detail');
  var t = selectedTourId ? tourById(selectedTourId) : null;
  if (!t) { box.innerHTML = '<p class="empty">No tours planned yet.</p>'; return; }

  var collected = tourCollected(t.id);
  var spent = tourSpent(t.id);
  var balance = collected - spent;
  var full = tourMembersPaidFull(t);

  var html = '';
  // overview stat cards
  html += '<div class="stats-row">' +
    '<div class="stat-card"><div class="stat-label">Total Collected</div><div class="stat-value good">' + fmt(collected) + '</div></div>' +
    '<div class="stat-card"><div class="stat-label">Total Spent</div><div class="stat-value warn">' + fmt(spent) + '</div></div>' +
    '<div class="stat-card"><div class="stat-label">Balance</div><div class="stat-value">' + fmt(balance) + '</div></div>' +
    '<div class="stat-card"><div class="stat-label">Members Paid</div><div class="stat-value">' + full + ' of ' + data.members.length + '</div></div>' +
    '</div>';
  // tour info card
  html += '<div class="list-item" style="margin-top:0.75rem"><div class="top">' +
    '<div><strong>' + esc(t.name) + '</strong>' +
    '<div class="meta">' + esc(t.destination) + ' · ' + tourDatesLabel(t) + ' · Cost per member: ' + fmt(t.costPerMember) + '</div></div>' +
    '</div>' +
    (t.notes ? '<div class="note">' + esc(t.notes) + '</div>' : '') +
    '<div class="actions"><button class="btn small danger" data-del="tour" data-id="' + t.id + '">Delete Tour</button></div></div>';
  // record payment form
  html += '<h2>Record Tour Payment</h2>' +
    '<form id="t-pay-form" class="form-card"><div class="form-grid">' +
    '<label>Member<select id="t-pay-member" required>' +
    data.members.map(function (m) { return '<option value="' + m.id + '">' + esc(m.name) + '</option>'; }).join('') +
    '</select></label>' +
    '<label>Amount<input id="t-pay-amount" type="number" min="0.01" step="0.01" inputmode="decimal" required placeholder="0.00"></label>' +
    '<label>Date<input id="t-pay-date" type="date" required value="' + todayStr() + '"></label>' +
    '<label>Note (optional)<input id="t-pay-note" type="text" maxlength="120" placeholder="e.g. advance"></label>' +
    '</div><button type="submit" class="btn primary">Add Payment</button></form>';
  // per-member payment status
  html += '<h2>Member Payments</h2>' +
    '<div class="filters"><label>Search<input id="t-pay-search" type="search" placeholder="Search members…" value="' + esc(tPaySearch) + '"></label></div>' +
    '<div id="t-pay-status"></div>';
  // record expense form
  html += '<h2>Record Tour Expense</h2>' +
    '<form id="t-exp-form" class="form-card"><div class="form-grid">' +
    '<label>Amount<input id="t-exp-amount" type="number" min="0.01" step="0.01" inputmode="decimal" required placeholder="0.00"></label>' +
    '<label>Date<input id="t-exp-date" type="date" required value="' + todayStr() + '"></label>' +
    '<label>Note (optional)<input id="t-exp-note" type="text" maxlength="120" placeholder="e.g. transport, hotel, food"></label>' +
    '</div><button type="submit" class="btn primary">Add Expense</button></form>';
  // expense history
  var exps = data.tourExpenses.filter(function (e) { return e.tourId === t.id; })
    .sort(function (a, b) { return b.date.localeCompare(a.date); });
  html += '<h2>Expense History</h2><div class="list">' +
    (exps.map(function (e) {
      return '<div class="list-item"><div class="top">' +
        '<div><div class="meta">' + fmtDate(e.date) + '</div></div>' +
        '<div class="amount">' + fmt(e.amount) + '</div></div>' +
        (e.note ? '<div class="note">' + esc(e.note) + '</div>' : '') +
        '<div class="actions"><button class="btn small" data-del="tourExpense" data-id="' + e.id + '">Delete</button></div></div>';
    }).join('') || '<p class="empty">No expenses recorded yet.</p>') + '</div>';

  box.innerHTML = html;
  renderTourMembers();
}

function deleteTour(id) {
  var t = tourById(id);
  var name = t ? t.name : 'this tour';
  if (!confirm('Delete tour "' + name + '"? This will also remove ALL of its payments and expenses.')) return;
  if (!confirm('Are you really sure? "' + name + '" and all its records will be permanently deleted.')) return;
  data.tours = data.tours.filter(function (x) { return x.id !== id; });
  data.tourPayments = data.tourPayments.filter(function (p) { return p.tourId !== id; });
  data.tourExpenses = data.tourExpenses.filter(function (e) { return e.tourId !== id; });
  if (selectedTourId === id) selectedTourId = null;
  save(); renderAll();
}

function initTours() {
  $('t-select').addEventListener('change', function () {
    selectedTourId = this.value || null;
    tPaySearch = '';
    renderTours();
  });
  document.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f || !f.id) return;
    if (f.id === 't-form') {
      e.preventDefault();
      var cost = parseFloat($('t-cost').value);
      if (!(cost > 0)) { alert('Please enter a valid cost per member.'); return; }
      if (!$('t-name').value.trim() || !$('t-dest').value.trim()) { alert('Please enter a tour name and destination.'); return; }
      var t = {
        id: uid(),
        name: $('t-name').value.trim(),
        destination: $('t-dest').value.trim(),
        startDate: $('t-start').value || '',
        endDate: $('t-end').value || '',
        costPerMember: cost,
        notes: $('t-notes').value.trim()
      };
      data.tours.push(t);
      selectedTourId = t.id;
      save();
      $('t-name').value = ''; $('t-dest').value = ''; $('t-start').value = '';
      $('t-end').value = ''; $('t-cost').value = ''; $('t-notes').value = '';
      renderAll();
    } else if (f.id === 't-pay-form') {
      e.preventDefault();
      var tour = selectedTourId ? tourById(selectedTourId) : null;
      if (!tour) { alert('Please select a tour first.'); return; }
      var amt = parseFloat($('t-pay-amount').value);
      if (!(amt > 0)) { alert('Please enter a valid amount.'); return; }
      if (!$('t-pay-member').value || !$('t-pay-date').value) { alert('Please choose a member and date.'); return; }
      data.tourPayments.push({
        id: uid(), tourId: tour.id, memberId: $('t-pay-member').value,
        amount: amt, date: $('t-pay-date').value, note: $('t-pay-note').value.trim()
      });
      save(); renderAll();
    } else if (f.id === 't-exp-form') {
      e.preventDefault();
      var tour2 = selectedTourId ? tourById(selectedTourId) : null;
      if (!tour2) { alert('Please select a tour first.'); return; }
      var amt2 = parseFloat($('t-exp-amount').value);
      if (!(amt2 > 0)) { alert('Please enter a valid amount.'); return; }
      if (!$('t-exp-date').value) { alert('Please choose a date.'); return; }
      data.tourExpenses.push({
        id: uid(), tourId: tour2.id, amount: amt2,
        date: $('t-exp-date').value, note: $('t-exp-note').value.trim()
      });
      save(); renderAll();
    }
  });
  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 't-pay-search') {
      tPaySearch = e.target.value;
      renderTourMembers();
    }
  });
}

/* ---------- loans ---------- */
function loanScheduleHtml(l) {
  var prog = installmentProgress(l.id);
  if (!prog.length) return '';
  var rows = prog.map(function (pr) {
    return '<tr><td>' + pr.inst.n + '</td><td>' + fmtDate(pr.inst.dueDate) + '</td>' +
      '<td>' + fmt(pr.inst.amount) + '</td><td>' + fmt(pr.paid) + '</td>' +
      '<td class="' + pr.cls + '">' + pr.status + '</td></tr>';
  }).join('');
  return '<div class="sched-title">Installment plan (' + prog.length + ')</div>' +
    '<div class="table-wrap"><table class="members-table"><thead><tr>' +
    '<th>#</th><th>Due date</th><th>Amount</th><th>Paid</th><th>Status</th>' +
    '</tr></thead><tbody>' + rows + '</tbody></table></div>';
}

function renderOverdue() {
  var od = overdueInstallments();
  $('l-overdue').innerHTML = od.map(function (o) {
    return '<div class="list-item"><div class="top">' +
      '<div><strong>' + esc(memberName(o.loan.memberId)) + '</strong>' +
      '<div class="meta">Loan of ' + fmtDate(o.loan.date) + ' — Installment ' + o.inst.n +
      ' · due ' + fmtDate(o.inst.dueDate) + '</div></div>' +
      '<div class="amount" style="color:var(--danger)">' + fmt(o.unpaid) + '</div></div></div>';
  }).join('') || '<p class="empty">No overdue installments. ✓</p>';
}

function renderLoans() {
  fillMemberSelect($('l-member'), false);

  $('l-summary').innerHTML = data.members.map(function (m) {
    return '<div class="member-card"><h3>' + esc(m.name) + '</h3><dl>' +
      '<div class="row"><dt>Outstanding</dt><dd>' + fmt(memberLoanBalance(m.id)) + '</dd></div>' +
      '</dl></div>';
  }).join('') || '<p class="empty">No members yet.</p>';

  renderOverdue();

  var loans = data.loans.slice().sort(function (a, b) { return b.date.localeCompare(a.date); });
  $('l-list').innerHTML = loans.map(function (l) {
    var repaid = loanRepaid(l.id);
    var bal = loanOutstanding(l);
    var total = loanTotalOwed(l);
    var interest = loanInterest(l);
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
      '<div class="amount">' + fmt(total) + '</div></div>' +
      '<div class="numbers" style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:0.25rem;font-size:0.9rem;margin-top:0.3rem;">' +
      '<span>Principal: <strong>' + fmt(l.amount) + '</strong></span>' +
      '<span>Interest: <strong>' + fmt(interest) + '</strong></span>' +
      '<span>Total owed: <strong>' + fmt(total) + '</strong></span></div>' +
      '<div class="numbers" style="display:flex;justify-content:space-between;font-size:0.9rem;margin-top:0.3rem;">' +
      '<span>Repaid: <strong>' + fmt(repaid) + '</strong></span>' +
      '<span>Outstanding: <strong class="balance ' + cls + '">' + fmt(bal) + '</strong></span></div>' +
      loanScheduleHtml(l) +
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
    // interest: explicit Rs override wins, otherwise computed from %
    var pct = parseFloat($('l-interest-pct').value) || 0;
    var overrideRaw = $('l-interest-amt').value.trim();
    var interestAmount = overrideRaw !== '' ? (parseFloat(overrideRaw) || 0) : Math.round(amount * pct / 100);
    // installment plan (optional)
    var kRaw = parseInt($('l-installments').value, 10);
    var k = (kRaw > 1) ? kRaw : 1;
    var firstDue = $('l-first-due').value || addMonths($('l-date').value, 1);
    var loan = {
      id: uid(), memberId: $('l-member').value, amount: amount,
      date: $('l-date').value, note: $('l-note').value.trim(),
      interestPct: pct, interestAmount: interestAmount, installmentCount: k
    };
    data.loans.push(loan);
    if (k > 1) {
      buildInstallments(loan, firstDue).forEach(function (it) { data.installments.push(it); });
    }
    save();
    $('l-amount').value = ''; $('l-note').value = '';
    $('l-interest-pct').value = '0'; $('l-interest-amt').value = '';
    $('l-installments').value = ''; $('l-first-due').value = '';
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
  $('p-split-equal').addEventListener('click', function () {
    var inputs = document.querySelectorAll('[data-share-for]');
    var n = inputs.length;
    if (!n) { alert('Add members first.'); return; }
    var each = Math.floor(10000 / n) / 100; // 2-decimal share, rounded down
    var assigned = 0;
    inputs.forEach(function (inp, i) {
      var v = (i === n - 1) ? Math.round((100 - assigned) * 100) / 100 : each;
      inp.value = v;
      assigned += each;
    });
    updateShareMsg();
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
    if (type === 'member') { deleteMember(id); return; }
    if (type === 'tour') { deleteTour(id); return; }
    var label = { contribution: 'this contribution', loan: 'this loan, its repayments and installment plan', repayment: 'this repayment', profit: 'this profit entry', meeting: 'this meeting', tourExpense: 'this expense' }[type] || 'this record';
    if (!confirm('Delete ' + label + '?')) return;
    if (type === 'contribution') data.contributions = data.contributions.filter(function (c) { return c.id !== id; });
    else if (type === 'tourExpense') data.tourExpenses = data.tourExpenses.filter(function (e) { return e.id !== id; });
    else if (type === 'loan') {
      data.loans = data.loans.filter(function (l) { return l.id !== id; });
      data.repayments = data.repayments.filter(function (r) { return r.loanId !== id; });
      data.installments = data.installments.filter(function (i) { return i.loanId !== id; });
    }
    else if (type === 'repayment') data.repayments = data.repayments.filter(function (r) { return r.id !== id; });
    else if (type === 'profit') data.profits = data.profits.filter(function (p) { return p.id !== id; });
    else if (type === 'meeting') {
      if (editingMeetingId === id) resetMeetingForm();
      data.meetings = data.meetings.filter(function (mt) { return mt.id !== id; });
    }
    save(); renderAll();
  });
}

/* ---------- boot ---------- */
function renderAll() {
  renderDashboard();
  renderMembers();
  renderContributions();
  renderMonthly();
  renderMeetings();
  renderTours();
  renderLoans();
  renderProfit();
  renderSettings();
}

load();
initTabs();
initMembers();
initContributions();
initMonthly();
initMeetings();
initTours();
initLoans();
initProfit();
initSettings();
initDeletes();
renderAll();

})();
