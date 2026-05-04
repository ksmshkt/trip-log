const SUPABASE_URL = 'https://irowrhywlanakohpvdsa.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlyb3dyaHl3bGFuYWtvaHB2ZHNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0OTI2MjMsImV4cCI6MjA5MjA2ODYyM30.WLyZn59wW5TK3hMlt_XbBGzFZMBaPDDvQK3uGacCTQU';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentTripId = null;
let currentTrip = null;
let isLogin = true;

// ── セクション切り替え ──
const sections = {
  auth: document.getElementById('auth-section'),
  list: document.getElementById('trip-list-section'),
  form: document.getElementById('trip-form-section'),
  detail: document.getElementById('trip-detail-section'),
};
function showSection(name) {
  Object.values(sections).forEach(s => s.classList.add('hidden'));
  sections[name].classList.remove('hidden');
}

// ── 日付フォーマット ──
function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
}

// ── 認証 ──
document.getElementById('btn-switch-mode').onclick = () => {
  isLogin = !isLogin;
  document.getElementById('auth-title').textContent = isLogin ? 'ログイン' : '新規登録';
  document.getElementById('btn-auth').textContent = isLogin ? 'ログイン' : '登録する';
  document.getElementById('btn-switch-mode').textContent = isLogin ? '新規登録' : 'ログインはこちら';
  document.getElementById('auth-error').classList.add('hidden');
};

document.getElementById('btn-auth').onclick = async () => {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errEl = document.getElementById('auth-error');
  errEl.classList.add('hidden');

  if (!email || !password) {
    errEl.textContent = 'メールアドレスとパスワードを入力してください';
    errEl.classList.remove('hidden');
    return;
  }

  let result;
  if (isLogin) {
    result = await db.auth.signInWithPassword({ email, password });
  } else {
    result = await db.auth.signUp({ email, password });
  }

  if (result.error) {
    errEl.textContent = result.error.message;
    errEl.classList.remove('hidden');
    return;
  }

  if (!isLogin && !result.data.session) {
    errEl.style.color = '#080';
    errEl.textContent = '確認メールを送信しました。メールのリンクをクリックしてください。';
    errEl.classList.remove('hidden');
    return;
  }

  currentUser = result.data.user;
  onLogin();
};

document.getElementById('btn-logout').onclick = async () => {
  await db.auth.signOut();
  currentUser = null;
  document.getElementById('btn-logout').classList.add('hidden');
  showSection('auth');
};

function onLogin() {
  document.getElementById('btn-logout').classList.remove('hidden');
  loadTrips();
  showSection('list');
}

// ── 旅行一覧 ──
async function loadTrips() {
  const { data, error } = await db
    .from('trips')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return; }

  const list = document.getElementById('trip-list');
  const empty = document.getElementById('trip-empty');

  if (!data.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  list.innerHTML = data.map(t => `
    <div class="trip-card" onclick="openTrip('${t.id}')">
      <div>
        <div class="trip-card-title">${t.title}</div>
        <div class="trip-card-date">${fmtDate(t.start_date)} 〜 ${fmtDate(t.end_date)}</div>
      </div>
      <span class="trip-card-arrow">›</span>
    </div>
  `).join('');
}

// ── 旅行作成 ──
document.getElementById('btn-new-trip').onclick = () => {
  document.getElementById('trip-title').value = '';
  document.getElementById('trip-start').value = '';
  document.getElementById('trip-end').value = '';
  showSection('form');
};

document.getElementById('btn-cancel-trip').onclick = () => showSection('list');

document.getElementById('btn-save-trip').onclick = async () => {
  const title = document.getElementById('trip-title').value.trim();
  const start_date = document.getElementById('trip-start').value || null;
  const end_date = document.getElementById('trip-end').value || null;
  if (!title) { alert('タイトルを入力してください'); return; }

  const { data, error } = await db
    .from('trips')
    .insert({ title, start_date, end_date, user_id: currentUser.id })
    .select()
    .single();

  if (error) { console.error(error); alert('保存に失敗しました'); return; }

  openTrip(data.id);
};

// ── 旅行詳細 ──
async function openTrip(id) {
  currentTripId = id;
  const { data: trip, error } = await db.from('trips').select('*').eq('id', id).single();
  if (error) { console.error(error); return; }
  currentTrip = trip;
  document.getElementById('detail-title').textContent = trip.title;
  document.getElementById('detail-date').textContent = `${fmtDate(trip.start_date)} 〜 ${fmtDate(trip.end_date)}`;
  loadTodos();
  loadExpenses();
  showSection('detail');
}

document.getElementById('btn-back').onclick = () => {
  loadTrips();
  showSection('list');
};

// ── ToDo ──
async function loadTodos() {
  const { data, error } = await db
    .from('todos')
    .select('*')
    .eq('trip_id', currentTripId)
    .order('created_at', { ascending: true });

  if (error) { console.error(error); return; }

  const ul = document.getElementById('todo-list');
  const empty = document.getElementById('todo-empty');

  if (!data.length) {
    ul.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  ul.innerHTML = data.map(todo => `
    <li class="todo-item ${todo.done ? 'done' : ''}" id="todo-${todo.id}">
      <input type="checkbox" ${todo.done ? 'checked' : ''} onchange="toggleTodo('${todo.id}', ${todo.done})">
      <label>${todo.text}</label>
      <button class="todo-delete" onclick="deleteTodo('${todo.id}')">×</button>
    </li>
  `).join('');
}

document.getElementById('btn-add-todo').onclick = addTodo;
document.getElementById('todo-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') addTodo();
});

async function addTodo() {
  const input = document.getElementById('todo-input');
  const text = input.value.trim();
  if (!text) return;

  const { error } = await db
    .from('todos')
    .insert({ trip_id: currentTripId, text, done: false });

  if (error) { console.error(error); return; }
  input.value = '';
  input.focus();
  loadTodos();
}

async function toggleTodo(id, currentDone) {
  await db.from('todos').update({ done: !currentDone }).eq('id', id);
  loadTodos();
}

async function deleteTodo(id) {
  await db.from('todos').delete().eq('id', id);
  loadTodos();
}

// ── 支出 ──
async function loadExpenses() {
  const { data, error } = await db
    .from('expenses')
    .select('*')
    .eq('trip_id', currentTripId)
    .order('date', { ascending: false });

  if (error) { console.error(error); return; }

  const listEl   = document.getElementById('expense-list');
  const emptyEl  = document.getElementById('expense-empty');
  const totalEl  = document.getElementById('expense-total');
  const budgetEl = document.getElementById('budget-display');

  const total  = data.reduce((sum, e) => sum + (e.amount || 0), 0);
  const budget = currentTrip?.budget;

  if (budget) {
    const remaining = budget - total;
    budgetEl.textContent = `予算: ${Number(budget).toLocaleString()}　残額: ${remaining.toLocaleString()}`;
    budgetEl.classList.remove('hidden');
  } else {
    budgetEl.classList.add('hidden');
  }

  if (!data.length) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('hidden');
    totalEl.classList.add('hidden');
    return;
  }

  emptyEl.classList.add('hidden');
  totalEl.textContent = `合計: ${total.toLocaleString()}`;
  totalEl.classList.remove('hidden');

  listEl.innerHTML = data.map(e => `
    <div class="expense-item">
      <span class="exp-date">${fmtDate(e.date)}</span>
      <span class="exp-category">${e.category}</span>
      <span class="exp-amount">${Number(e.amount).toLocaleString()}</span>
      <span class="exp-memo">${e.memo || ''}</span>
      <button class="exp-del" onclick="deleteExpense('${e.id}')">×</button>
    </div>
  `).join('');
}

document.getElementById('btn-add-expense').onclick = addExpense;

async function addExpense() {
  const category = document.getElementById('exp-category').value;
  const amount   = parseFloat(document.getElementById('exp-amount').value);
  const memo     = document.getElementById('exp-memo').value.trim();
  const date     = document.getElementById('exp-date').value;

  if (!amount || amount <= 0) { alert('金額を入力してください'); return; }
  if (!date) { alert('日付を選択してください'); return; }

  const { error } = await db.from('expenses').insert({
    trip_id: currentTripId,
    category,
    amount,
    memo: memo || null,
    date,
  });

  if (error) { console.error(error); alert('保存に失敗しました'); return; }
  document.getElementById('exp-amount').value = '';
  document.getElementById('exp-memo').value = '';
  loadExpenses();
}

async function deleteExpense(id) {
  await db.from('expenses').delete().eq('id', id);
  loadExpenses();
}

// ── 初期化 ──
(async () => {
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    currentUser = session.user;
    onLogin();
  } else {
    showSection('auth');
  }
})();