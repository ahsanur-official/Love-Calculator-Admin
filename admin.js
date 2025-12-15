(function(){
  const usersKey = "love_calc_users";
  const logsKey = "love_calc_logs";
  const profilesKey = "love_calc_profiles";
  const ownerKey = "love_calc_owner_email";
  let selectedUser = null;

  const gate = document.getElementById('gate');
  const dashboard = document.getElementById('dashboard');
  const toast = document.getElementById('toast');

  document.getElementById('unlockBtn').addEventListener('click', unlock);
  document.getElementById('refreshBtn').addEventListener('click', renderAll);

  // Auto open if owner previously verified in this session
  let savedOwner = localStorage.getItem(ownerKey);
  if (!savedOwner) {
    localStorage.setItem(ownerKey, 'admin@love.local');
    savedOwner = 'admin@love.local';
  }
  const lastUnlock = sessionStorage.getItem('admin_unlocked_email');
  if (savedOwner && lastUnlock === savedOwner) {
    gate.style.display = 'none';
    dashboard.style.display = 'block';
    renderAll();
  }

  function unlock(){
    const input = document.getElementById('ownerEmail').value.trim().toLowerCase();
    const owner = localStorage.getItem(ownerKey);
    if (!input){ showToast('Enter owner email'); return; }
    if (!owner){ showToast('Owner not set. Use Set As Owner'); return; }
    if (input !== owner){ showToast('Access denied'); return; }
    sessionStorage.setItem('admin_unlocked_email', input);
    gate.style.display = 'none';
    dashboard.style.display = 'block';
    renderAll();
    showToast('Admin unlocked');
  }



  function renderAll(){ renderUsers(); renderLogs(); renderHistories(); renderUserDetail(); }

  function renderUsers(){
    const users = JSON.parse(localStorage.getItem(usersKey) || '[]');
    const profiles = JSON.parse(localStorage.getItem(profilesKey) || '{}');
    const wrap = document.getElementById('usersList');
    wrap.innerHTML = '';
    if (!users.length){ wrap.innerHTML = '<p class="muted">No users.</p>'; return; }
    users.forEach(u => {
      const item = document.createElement('div'); item.className = 'item';
      if (selectedUser === u.email) item.classList.add('active');
      const prof = profiles[u.email] || {displayName:'', avatar:''};
      item.innerHTML = `<strong>${u.email}</strong><div class="muted">name: ${prof.displayName || '-'} · pw: saved locally</div>`;
      item.addEventListener('click', () => selectUser(u.email));
      wrap.appendChild(item);
    });
  }

  function selectUser(email){
    selectedUser = email;
    renderUsers();
    renderUserDetail();
  }

  function renderLogs(){
    const logs = JSON.parse(localStorage.getItem(logsKey) || '[]');
    const wrap = document.getElementById('logsList');
    wrap.innerHTML = '';
    if (!logs.length){ wrap.innerHTML = '<p class="muted">No logs.</p>'; return; }
    logs.slice(0,100).forEach(l => {
      const item = document.createElement('div'); item.className = 'item';
      item.innerHTML = `<strong>${l.boy} & ${l.girl}</strong><div class="muted">${l.lovePercent}% · ${l.user || 'anon'} · ${l.time}</div>`;
      wrap.appendChild(item);
    });
  }

  function renderHistories(){
    const users = JSON.parse(localStorage.getItem(usersKey) || '[]');
    const wrap = document.getElementById('histories');
    wrap.innerHTML = '';
    if (!users.length){ wrap.innerHTML = '<p class="muted">No histories.</p>'; return; }
    users.forEach(u => {
      const key = 'love_calc_history_' + u.email;
      const hist = JSON.parse(localStorage.getItem(key) || '[]');
      const item = document.createElement('div'); item.className = 'item';
      if (!hist.length){ item.innerHTML = `<strong>${u.email}</strong><div class="muted">No entries</div>`; }
      else {
        const preview = hist.slice(0,3).map(h => `${h.boy}&${h.girl} ${h.lovePercent}%`).join(' · ');
        item.innerHTML = `<strong>${u.email}</strong><div class="muted">${preview}</div>`;
      }
      wrap.appendChild(item);
    });
  }

  function renderUserDetail(){
    const hint = document.getElementById('detailHint');
    const meta = document.getElementById('detailMeta');
    const emailEl = document.getElementById('detailEmail');
    const nameEl = document.getElementById('detailName');
    const savesEl = document.getElementById('detailSaves');
    const lastEl = document.getElementById('detailLast');
    const detailHistory = document.getElementById('detailHistory');
    const detailLogs = document.getElementById('detailLogs');
    const historyCountEl = document.getElementById('detailHistoryCount');
    const logsCountEl = document.getElementById('detailLogsCount');

    if (!selectedUser) {
      hint.style.display = 'block';
      meta.style.display = 'none';
      detailHistory.innerHTML = '<p class="muted">Select a user to view history.</p>';
      detailLogs.innerHTML = '<p class="muted">Select a user to view logs.</p>';
      if (historyCountEl) historyCountEl.textContent = '';
      if (logsCountEl) logsCountEl.textContent = '';
      return;
    }

    const users = JSON.parse(localStorage.getItem(usersKey) || '[]');
    const profiles = JSON.parse(localStorage.getItem(profilesKey) || '{}');
    const logs = JSON.parse(localStorage.getItem(logsKey) || '[]');
    const userExists = users.find(u => u.email === selectedUser);
    if (!userExists){
      selectedUser = null;
      renderUserDetail();
      return;
    }

    const prof = profiles[selectedUser] || {displayName:'', avatar:''};
    const historyKey = 'love_calc_history_' + selectedUser;
    const hist = JSON.parse(localStorage.getItem(historyKey) || '[]');
    const userLogs = logs.filter(l => (l.user || '').toLowerCase() === selectedUser.toLowerCase()).slice(0,20);

    hint.style.display = 'none';
    meta.style.display = 'grid';
    emailEl.textContent = selectedUser;
    nameEl.textContent = prof.displayName || '-';
    savesEl.textContent = hist.length;

    if (hist.length) {
      const latest = hist[0];
      lastEl.textContent = `${latest.boy} & ${latest.girl} · ${latest.lovePercent}% · ${latest.time}`;
    } else {
      lastEl.textContent = 'No entries yet';
    }

    if (historyCountEl) historyCountEl.textContent = `(${hist.length})`;
    if (logsCountEl) logsCountEl.textContent = `(${userLogs.length})`;

    detailHistory.innerHTML = '';
    if (!hist.length) {
      detailHistory.innerHTML = '<p class="muted">No history entries.</p>';
    } else {
      hist.slice(0, 50).forEach(h => {
        const div = document.createElement('div');
        div.className = 'item slim';
        div.innerHTML = `<strong>${h.boy} & ${h.girl}</strong><div class="muted">${h.lovePercent}% · ${h.summary || ''} · ${h.time}</div>`;
        detailHistory.appendChild(div);
      });
    }

    detailLogs.innerHTML = '';
    if (!userLogs.length) {
      detailLogs.innerHTML = '<p class="muted">No logs.</p>';
    } else {
      userLogs.slice(0, 100).forEach(l => {
        const div = document.createElement('div');
        div.className = 'item slim';
        div.innerHTML = `<strong>${l.boy} & ${l.girl}</strong><div class="muted">${l.lovePercent}% · ${l.time}</div>`;
        detailLogs.appendChild(div);
      });
    }
  }

  function showToast(msg){
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(()=> toast.classList.remove('show'), 2000);
  }
})();
