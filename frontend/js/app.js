import { api } from './api.js';
import { t, setLang, getLang, errorMessage, formatDate } from './i18n.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};

const STATUSES = ['todo', 'in_progress', 'review', 'done'];
const PRIORITIES = ['low', 'medium', 'high'];
const VIEWS = ['dashboard', 'tasks', 'board', 'projects', 'profile'];
const ICON = {
  edit: '<svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v6M14 11v6"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
};

const S = {
  user: null, view: 'dashboard', projects: [], boardProject: '',
  filters: { q: '', status: '', priority: '', project_id: '', sort: 'newest' },
};
let renderToken = 0;

/* ---------------- helpers ---------------- */
function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), 3200);
}

function handle(err) {
  if (err.status === 401 && S.user) { showAuth(); toast(t('err_unauthorized'), 'error'); return; }
  toast(errorMessage(err), 'error');
}

const todayStr = () => new Date().toLocaleDateString('en-CA');
const isOverdue = (x) => x.due_date && x.status !== 'done' && x.due_date < todayStr();

function confirmBox(message) {
  return new Promise((resolve) => {
    const d = $('#confirm-dialog');
    $('#confirm-msg').textContent = message;
    d.returnValue = '';
    d.addEventListener('close', () => resolve(d.returnValue === 'ok'), { once: true });
    d.showModal();
  });
}

/* ---------------- theme / language ---------------- */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  store.set('tf-theme', theme);
}

function applyLang(lang) {
  setLang(lang);
  store.set('tf-lang', getLang());
  if (S.user) { updateChrome(); render(); }
}

async function savePref(prefs) {
  if (!S.user) return;
  try { S.user = (await api.put('/api/profile', prefs)).user; } catch { /* preference is still applied locally */ }
}

/* ---------------- auth / shell ---------------- */
function showAuth() {
  S.user = null;
  renderToken++;
  $('#app-view').hidden = true;
  $('#auth-view').hidden = false;
  $$('#auth-view form').forEach((f) => { f.reset(); $('.form-error', f).textContent = ''; });
}

async function enterApp(user) {
  S.user = user;
  applyTheme(user.theme);
  setLang(user.language);
  store.set('tf-lang', user.language);
  $('#auth-view').hidden = true;
  $('#app-view').hidden = false;
  const fromHash = location.hash.slice(1);
  go(VIEWS.includes(fromHash) ? fromHash : 'dashboard');
}

function updateChrome() {
  $('#user-name').textContent = S.user.name;
  $('#user-email').textContent = S.user.email;
  $('#user-avatar').textContent = [...S.user.name][0].toUpperCase();
  $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === S.view));
  $('#page-title').textContent = t('nav_' + S.view);
}

function closeMenu() { $('#sidebar').classList.remove('open'); $('#overlay').classList.remove('show'); }

function go(view) {
  S.view = VIEWS.includes(view) ? view : 'dashboard';
  history.replaceState(null, '', '#' + S.view);
  closeMenu();
  updateChrome();
  render();
}

/* ---------------- data ---------------- */
async function loadProjects() { S.projects = (await api.get('/api/projects')).projects; }

async function fetchTasks(params) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v));
  return (await api.get('/api/tasks' + (qs.toString() ? '?' + qs : ''))).tasks;
}

function projectOptions(selected, mode) {
  const first = mode === 'all'
    ? `<option value="">${t('all_projects')}</option><option value="none" ${selected === 'none' ? 'selected' : ''}>${t('no_project')}</option>`
    : `<option value="">${t('no_project')}</option>`;
  return first + S.projects.map((p) => `<option value="${p.id}" ${String(selected) === String(p.id) ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
}

const enumOptions = (list, prefix, selected, allKey) =>
  (allKey ? `<option value="">${t(allKey)}</option>` : '') +
  list.map((v) => `<option value="${v}" ${v === selected ? 'selected' : ''}>${t(prefix + v)}</option>`).join('');

/* ---------------- fragments ---------------- */
function metaHtml(x) {
  const project = x.project_id ? `<span class="chip"><i style="background:${esc(x.project_color)}"></i>${esc(x.project_name)}</span>` : '';
  const due = x.due_date ? `<span class="due ${isOverdue(x) ? 'late' : ''}">${isOverdue(x) ? esc(t('overdue_label')) + ' · ' : ''}${esc(formatDate(x.due_date))}</span>` : '';
  return `${project}<span class="badge pr-${x.priority}">${t('priority_' + x.priority)}</span>${due}`;
}

const actionBtns = (type, id) =>
  `<button class="icon-btn" data-action="edit-${type}" data-id="${id}" title="${esc(t('edit'))}" aria-label="${esc(t('edit'))}">${ICON.edit}</button>` +
  `<button class="icon-btn danger" data-action="delete-${type}" data-id="${id}" title="${esc(t('delete'))}" aria-label="${esc(t('delete'))}">${ICON.trash}</button>`;

function taskRow(x) {
  const done = x.status === 'done';
  return `<li class="task ${done ? 'is-done' : ''}">
    <button class="check" data-action="toggle" data-id="${x.id}" aria-pressed="${done}" aria-label="${esc(t('mark_done'))}">${done ? '✓' : ''}</button>
    <div class="task-main">
      <div class="task-title">${esc(x.title)}</div>
      ${x.description ? `<div class="task-desc">${esc(x.description)}</div>` : ''}
      <div class="meta"><span class="badge st-${x.status}">${t('status_' + x.status)}</span>${metaHtml(x)}</div>
    </div>
    <div class="task-actions">${actionBtns('task', x.id)}</div></li>`;
}

const taskListHtml = (tasks) => tasks.length ? tasks.map(taskRow).join('') : `<li class="empty">${t('empty_tasks')}</li>`;

function kanbanCard(x) {
  return `<article class="kcard" draggable="true" data-id="${x.id}">
    <div class="task-title">${esc(x.title)}</div>
    <div class="meta">${metaHtml(x)}</div>
    <div class="kcard-foot">
      <select data-action="move" data-id="${x.id}" aria-label="${esc(t('move_to'))}">${enumOptions(STATUSES, 'status_', x.status)}</select>
      <span>${actionBtns('task', x.id)}</span>
    </div></article>`;
}

/* ---------------- views ---------------- */
async function viewDashboard() {
  const s = await api.get('/api/stats');
  const pct = s.total ? Math.round((s.by_status.done / s.total) * 100) : 0;
  const stat = (label, value, cls = '') => `<div class="card stat ${cls}"><span class="muted">${label}</span><strong>${value}</strong></div>`;
  const bars = (map, prefix, cls) => {
    const max = Math.max(1, ...Object.values(map));
    return Object.entries(map).map(([k, n]) =>
      `<div class="bar-row"><span>${t(prefix + k)}</span><div class="bar"><span class="fill ${cls}-${k}" style="width:${(n / max) * 100}%"></span></div><b>${n}</b></div>`).join('');
  };
  return `<h2>${esc(t('welcome', { name: S.user.name }))}</h2>
    <div class="stats">
      ${stat(t('stat_total'), s.total)}
      ${stat(t('stat_progress'), s.by_status.in_progress)}
      ${stat(t('stat_done'), s.by_status.done)}
      ${stat(t('stat_overdue'), s.overdue, s.overdue ? 'warn' : '')}
    </div>
    <div class="panels">
      <section class="card"><h3 class="panel-title">${t('completion')}</h3>
        <div class="big-pct">${pct}%</div><div class="bar"><span class="fill st-done" style="width:${pct}%"></span></div>
        <p class="muted">${s.due_week} ${t('due_week')}</p></section>
      <section class="card"><h3 class="panel-title">${t('by_status')}</h3>${bars(s.by_status, 'status_', 'st')}</section>
      <section class="card"><h3 class="panel-title">${t('by_priority')}</h3>${bars(s.by_priority, 'priority_', 'pr')}</section>
    </div>
    <h3 class="panel-title" style="margin-top:24px">${t('upcoming')}</h3>
    <ul class="task-list">${s.upcoming.length ? s.upcoming.map(taskRow).join('') : `<li class="empty">${t('empty_upcoming')}</li>`}</ul>`;
}

async function viewTasks() {
  await loadProjects();
  const tasks = await fetchTasks(S.filters);
  const f = S.filters;
  return `<div class="toolbar">
      <input type="search" data-filter="q" value="${esc(f.q)}" placeholder="${esc(t('search_placeholder'))}" aria-label="${esc(t('search_placeholder'))}">
      <select data-filter="status">${enumOptions(STATUSES, 'status_', f.status, 'all_statuses')}</select>
      <select data-filter="priority">${enumOptions(PRIORITIES, 'priority_', f.priority, 'all_priorities')}</select>
      <select data-filter="project_id">${projectOptions(f.project_id, 'all')}</select>
      <select data-filter="sort">${enumOptions(['newest', 'due', 'priority'], 'sort_', f.sort)}</select>
    </div><ul class="task-list" id="task-list">${taskListHtml(tasks)}</ul>`;
}

async function refreshTaskList() {
  try {
    const tasks = await fetchTasks(S.filters);
    if (S.view === 'tasks') $('#task-list').innerHTML = taskListHtml(tasks);
  } catch (e) { handle(e); }
}

async function viewBoard() {
  await loadProjects();
  const tasks = await fetchTasks({ project_id: S.boardProject });
  const cols = STATUSES.map((st) => {
    const items = tasks.filter((x) => x.status === st);
    return `<section class="column" data-status="${st}"><header class="st-${st}"><span class="dot"></span>${t('status_' + st)}<b>${items.length}</b></header>
      <div class="cards">${items.map(kanbanCard).join('')}</div></section>`;
  }).join('');
  return `<div class="toolbar"><select data-board-project>${projectOptions(S.boardProject, 'all')}</select></div><div class="board">${cols}</div>`;
}

async function viewProjects() {
  await loadProjects();
  const cards = S.projects.map((p) => {
    const pct = p.task_count ? Math.round((p.done_count / p.task_count) * 100) : 0;
    return `<article class="card project">
      <div class="project-head"><i class="swatch" style="background:${esc(p.color)}"></i><h3>${esc(p.name)}</h3></div>
      <p class="muted">${esc(p.description)}</p>
      <div class="bar"><span class="fill" style="width:${pct}%;--c:${esc(p.color)}"></span></div>
      <small class="muted">${p.done_count}/${p.task_count} · ${pct}%</small>
      <div class="project-actions"><button class="btn ghost" data-action="project-tasks" data-id="${p.id}">${t('view_tasks')}</button>${actionBtns('project', p.id)}</div>
    </article>`;
  }).join('');
  return `<div class="toolbar"><button class="btn primary" data-action="new-project">${ICON.plus}<span>${t('new_project')}</span></button></div>` +
    (S.projects.length ? `<div class="grid-cards">${cards}</div>` : `<div class="empty">${t('empty_projects')}</div>`);
}

function viewProfile() {
  const u = S.user;
  return `<div class="grid-2 profile">
    <form class="card form" data-form="profile" novalidate>
      <h3>${t('profile_info')}</h3>
      <label>${t('name')}<input name="name" value="${esc(u.name)}" maxlength="100" required></label>
      <label>${t('email')}<input name="email" type="email" value="${esc(u.email)}" required></label>
      <label>${t('language')}<select name="language"><option value="ar" ${u.language === 'ar' ? 'selected' : ''}>العربية</option><option value="en" ${u.language === 'en' ? 'selected' : ''}>English</option></select></label>
      <label>${t('theme_label')}<select name="theme"><option value="light" ${u.theme === 'light' ? 'selected' : ''}>${t('theme_light')}</option><option value="dark" ${u.theme === 'dark' ? 'selected' : ''}>${t('theme_dark')}</option></select></label>
      <p class="form-error" role="alert"></p>
      <button class="btn primary" type="submit">${t('save')}</button>
    </form>
    <form class="card form" data-form="password" novalidate>
      <h3>${t('change_password')}</h3>
      <label>${t('current_password')}<input name="current_password" type="password" autocomplete="current-password" required></label>
      <label>${t('new_password')}<input name="new_password" type="password" autocomplete="new-password" minlength="8" required><small class="muted">${t('password_hint')}</small></label>
      <p class="form-error" role="alert"></p>
      <button class="btn primary" type="submit">${t('save')}</button>
    </form></div>`;
}

const VIEW_FNS = { dashboard: viewDashboard, tasks: viewTasks, board: viewBoard, projects: viewProjects, profile: viewProfile };

async function render() {
  if (!S.user) return;
  const token = ++renderToken;
  const el = $('#view');
  el.setAttribute('aria-busy', 'true');
  try {
    const html = await VIEW_FNS[S.view]();
    if (token !== renderToken) return;
    el.innerHTML = html;
  } catch (e) {
    if (token === renderToken) handle(e);
  } finally {
    if (token === renderToken) el.removeAttribute('aria-busy');
  }
}

/* ---------------- dialogs ---------------- */
async function openTaskDialog(task = null) {
  await loadProjects().catch(handle);
  const form = $('#task-form');
  const f = form.elements;
  form.reset();
  $('.form-error', form).textContent = '';
  const preset = task ? task.project_id
    : S.view === 'board' ? S.boardProject
    : S.view === 'tasks' && /^\d+$/.test(S.filters.project_id) ? S.filters.project_id : '';
  $('#task-dialog-title').textContent = t(task ? 'edit_task' : 'new_task');
  f.project_id.innerHTML = projectOptions(preset ?? '', 'form');
  f.status.innerHTML = enumOptions(STATUSES, 'status_', task ? task.status : 'todo');
  f.priority.innerHTML = enumOptions(PRIORITIES, 'priority_', task ? task.priority : 'medium');
  f.title.value = task ? task.title : '';
  f.description.value = task ? task.description : '';
  f.due_date.value = task && task.due_date ? task.due_date.slice(0, 10) : '';
  if (task) form.dataset.editId = task.id; else delete form.dataset.editId;
  $('#task-dialog').showModal();
  f.title.focus();
}

function openProjectDialog(project = null) {
  const form = $('#project-form');
  const f = form.elements;
  form.reset();
  $('.form-error', form).textContent = '';
  $('#project-dialog-title').textContent = t(project ? 'edit_project' : 'new_project');
  f.name.value = project ? project.name : '';
  f.description.value = project ? project.description : '';
  f.color.value = project ? project.color : '#4f46e5';
  if (project) form.dataset.editId = project.id; else delete form.dataset.editId;
  $('#project-dialog').showModal();
  f.name.focus();
}

/* ---------------- form handlers ---------------- */
const FORMS = {
  async 'login-form'(form, d) {
    const { user } = await api.post('/api/auth/login', { email: d.email, password: d.password });
    await enterApp(user);
  },
  async 'register-form'(form, d) {
    const { user } = await api.post('/api/auth/register', {
      name: d.name, email: d.email, password: d.password,
      language: getLang(), theme: document.documentElement.dataset.theme,
    });
    await enterApp(user);
  },
  async 'task-form'(form, d) {
    const body = {
      title: d.title, description: d.description, status: d.status, priority: d.priority,
      project_id: d.project_id || null, due_date: d.due_date || null,
    };
    const id = form.dataset.editId;
    if (id) await api.put('/api/tasks/' + id, body); else await api.post('/api/tasks', body);
    $('#task-dialog').close();
    toast(t('saved'));
    render();
  },
  async 'project-form'(form, d) {
    const body = { name: d.name, description: d.description, color: d.color };
    const id = form.dataset.editId;
    if (id) await api.put('/api/projects/' + id, body); else await api.post('/api/projects', body);
    $('#project-dialog').close();
    toast(t('saved'));
    render();
  },
  async profile(form, d) {
    const { user } = await api.put('/api/profile', { name: d.name, email: d.email, language: d.language, theme: d.theme });
    S.user = user;
    applyTheme(user.theme);
    toast(t('saved'));
    applyLang(user.language);
  },
  async password(form, d) {
    await api.post('/api/profile/password', { current_password: d.current_password, new_password: d.new_password });
    form.reset();
    toast(t('password_changed'));
  },
};

document.addEventListener('submit', async (e) => {
  const form = e.target;
  const handler = FORMS[form.dataset.form || form.id];
  if (!handler) return;
  e.preventDefault();
  const errEl = $('.form-error', form);
  const btn = $('[type="submit"]', form);
  errEl.textContent = '';
  btn.disabled = true;
  try {
    await handler(form, Object.fromEntries(new FormData(form)));
  } catch (err) {
    errEl.textContent = errorMessage(err);
  } finally {
    btn.disabled = false;
  }
});

/* ---------------- actions ---------------- */
async function setStatus(id, status) {
  try { await api.patch('/api/tasks/' + id, { status }); render(); } catch (e) { handle(e); }
}

const ACTIONS = {
  'toggle-lang': () => { const next = getLang() === 'ar' ? 'en' : 'ar'; applyLang(next); savePref({ language: next }); },
  'toggle-theme': () => { const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; applyTheme(next); savePref({ theme: next }); },
  async logout() { try { await api.post('/api/auth/logout'); } finally { showAuth(); } },
  menu: () => { $('#sidebar').classList.toggle('open'); $('#overlay').classList.toggle('show'); },
  'new-task': () => openTaskDialog(),
  'new-project': () => openProjectDialog(),
  async 'edit-task'(el) { openTaskDialog((await api.get('/api/tasks/' + el.dataset.id)).task); },
  async 'delete-task'(el) {
    if (!(await confirmBox(t('confirm_delete_task')))) return;
    await api.del('/api/tasks/' + el.dataset.id);
    toast(t('deleted'));
    render();
  },
  async toggle(el) {
    const done = el.getAttribute('aria-pressed') === 'true';
    await setStatus(el.dataset.id, done ? 'todo' : 'done');
  },
  async 'edit-project'(el) { openProjectDialog(S.projects.find((p) => String(p.id) === el.dataset.id)); },
  async 'delete-project'(el) {
    if (!(await confirmBox(t('confirm_delete_project')))) return;
    await api.del('/api/projects/' + el.dataset.id);
    toast(t('deleted'));
    render();
  },
  'project-tasks'(el) { S.filters = { q: '', status: '', priority: '', project_id: el.dataset.id, sort: 'newest' }; go('tasks'); },
};

document.addEventListener('click', async (e) => {
  const tab = e.target.closest('[data-tab]');
  if (tab) {
    $$('.tab').forEach((b) => b.classList.toggle('active', b === tab));
    $('#login-form').hidden = tab.dataset.tab !== 'login';
    $('#register-form').hidden = tab.dataset.tab !== 'register';
    return;
  }
  const nav = e.target.closest('[data-view]');
  if (nav) return go(nav.dataset.view);
  const close = e.target.closest('[data-close]');
  if (close) return close.closest('dialog').close();
  if (e.target.id === 'overlay') return closeMenu();
  const el = e.target.closest('[data-action]');
  if (!el || el.tagName === 'SELECT') return;
  const fn = ACTIONS[el.dataset.action];
  if (!fn) return;
  try { await fn(el); } catch (err) { handle(err); }
});

let searchTimer;
const viewEl = $('#view');
viewEl.addEventListener('input', (e) => {
  if (e.target.dataset.filter !== 'q') return;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => { S.filters.q = e.target.value.trim(); refreshTaskList(); }, 300);
});
viewEl.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.filter && el.dataset.filter !== 'q') { S.filters[el.dataset.filter] = el.value; refreshTaskList(); }
  else if ('boardProject' in el.dataset) { S.boardProject = el.value; render(); }
  else if (el.dataset.action === 'move') setStatus(el.dataset.id, el.value);
});

/* Kanban drag & drop (touch devices use the "move to" select on each card) */
viewEl.addEventListener('dragstart', (e) => {
  const card = e.target.closest('.kcard');
  if (!card) return;
  e.dataTransfer.setData('text/plain', card.dataset.id);
  e.dataTransfer.effectAllowed = 'move';
  card.classList.add('dragging');
});
viewEl.addEventListener('dragend', () => { $$('.dragging, .over', viewEl).forEach((x) => x.classList.remove('dragging', 'over')); });
viewEl.addEventListener('dragover', (e) => { const col = e.target.closest('.column'); if (col) { e.preventDefault(); col.classList.add('over'); } });
viewEl.addEventListener('dragleave', (e) => { const col = e.target.closest('.column'); if (col && !col.contains(e.relatedTarget)) col.classList.remove('over'); });
viewEl.addEventListener('drop', (e) => {
  const col = e.target.closest('.column');
  if (!col) return;
  e.preventDefault();
  col.classList.remove('over');
  const id = e.dataTransfer.getData('text/plain');
  if (id) setStatus(id, col.dataset.status);
});

window.addEventListener('hashchange', () => {
  const v = location.hash.slice(1);
  if (S.user && VIEWS.includes(v) && v !== S.view) go(v);
});

/* ---------------- boot ---------------- */
(async function boot() {
  applyTheme(store.get('tf-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  setLang(store.get('tf-lang') || 'ar');
  try {
    const { user } = await api.get('/api/auth/me');
    await enterApp(user);
  } catch {
    showAuth();
  }
})();
