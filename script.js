
const historyKeyBase = "love_calc_history_";
const usersKey = "love_calc_users";
const logsKey = "love_calc_logs";
const sessionKey = "love_calc_session";
const profilesKey = "love_calc_profiles";
const ownerKey = "love_calc_owner_email"; // central admin owner

// Will be initialized on DOM load
let modal, toast, authModal, adminPanel, profileModal;

let authMode = "login";
let currentUser = null;
let currentCaptcha = { prompt: "", answer: "" };

const surprisePrompts = [
    "Plan a 7-minute voice note date tonight.",
    "Swap playlists and listen together on a call.",
    "Leave a sticky note compliment somewhere unexpected.",
    "Cook or order the other person's comfort meal.",
    "Text them the first photo you took together.",
    "Send a meme that sums up your inside joke.",
    "Ask one new question you have never asked before."
];

const vibeTips = [
    { range: [0, 49], title: "Needs Work", detail: "Slow down. Align expectations and talk about boundaries.", duration: "Short-term unless habits change" },
    { range: [50, 79], title: "Good Match", detail: "You communicate well. Keep celebrating small wins and stay curious.", duration: "Solid with steady effort" },
    { range: [80, 100], title: "Cosmic Pair", detail: "You radiate together. Protect the trust and keep laughing often.", duration: "Long-lasting vibes" }
];

// Extra tip ideas pool
const tipsPool = [
    "Share highs and lows of your week.",
    "Plan a 15-min walk-and-talk call.",
    "Ask: what made you smile today?",
    "Swap three songs and explain why.",
    "Set a mini goal to do together.",
    "Write a 2-line appreciation text.",
    "Revisit a favorite memory with photos.",
    "Play a quick ‘two truths, one lie’.",
    "Try a small new thing together.",
    "Set a no-phones window for chatting.",
    "Pick a random prompt and discuss it.",
    "Celebrate a tiny win from this week.",
];

// UI wiring - Wait for DOM to be ready
document.addEventListener("DOMContentLoaded", function() {
    // Initialize DOM elements first
    modal = document.getElementById("modal");
    toast = document.getElementById("toast");
    authModal = document.getElementById("authModal");
    adminPanel = document.getElementById("adminPanel");
    profileModal = document.getElementById("profileModal");

    document.getElementById("calcBtn").addEventListener("click", calculateLove);
    document.getElementById("tipsBtn").addEventListener("click", showTips);
    document.getElementById("clearBtn").addEventListener("click", clearHistory);
    document.getElementById("exportPdfBtn").addEventListener("click", exportHistoryPdf);
    document.getElementById("closeModal").addEventListener("click", () => toggleModal(false));
    modal.addEventListener("click", (e) => { if (e.target === modal) toggleModal(false); });

    document.getElementById("closeAdmin").addEventListener("click", () => adminPanel.classList.remove("show"));

    document.getElementById("closeAuth").addEventListener("click", () => toggleAuth(false));
    authModal.addEventListener("click", (e) => { if (e.target === authModal) toggleAuth(false); });
    document.getElementById("tabLogin").addEventListener("click", () => setAuthMode("login"));
    document.getElementById("tabSignup").addEventListener("click", () => setAuthMode("signup"));
    document.getElementById("authSubmit").addEventListener("click", submitAuth);
    document.getElementById("sendCodeBtn").addEventListener("click", sendVerificationCode);
    document.getElementById("refreshCaptcha").addEventListener("click", () => setCaptcha());

    document.getElementById("closeProfile").addEventListener("click", () => toggleProfile(false));
    document.getElementById("saveAvatar").addEventListener("click", saveAvatar);
    document.getElementById("saveProfile").addEventListener("click", saveProfile);
    document.getElementById("logoutBtn").addEventListener("click", logout);
    document.getElementById("profileBtn").addEventListener("click", () => {
        if (!currentUser) { showToast("Login first", "warn"); toggleAuth(true, "login"); return; }
        openProfile();
    });
    document.getElementById("historyBtn").addEventListener("click", () => {
        if (!currentUser) { showToast("Login first", "warn"); toggleAuth(true, "login"); return; }
        openHistoryModal();
    });
    document.getElementById("closeHistory").addEventListener("click", () => toggleHistory(false));

    hydrateSession();
    renderHistory();
    renderAdmin();
    setupOwner();
    setCaptcha();
    animateNotes();

    // If opened with admin token, auto-open admin panel on main site
    try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('admin') === '1') {
            // Only open if logged-in and owner; otherwise prompt login
            const ownerEmail = localStorage.getItem('love_calc_owner_email');
            if (!currentUser) {
                toggleAuth(true, 'login');
                showToast('Login with owner account to open admin', 'warn');
            } else if (currentUser.email !== ownerEmail) {
                showToast('Owner access required for admin', 'warn');
            } else {
                adminPanel.classList.add('show');
            }
        }
    } catch (e) {}
});

function calculateLove() {
    if (!currentUser) {
        showToast("Please login first", "warn");
        toggleAuth(true, "login");
        return;
    }

    const boy = document.getElementById("boyName").value.trim();
    const girl = document.getElementById("girlName").value.trim();

    if (!boy || !girl) {
        showToast("Please enter both names", "warn");
        return;
    }

    const lovePercent = generateScore(boy, girl);
    const vibe = vibeTips.find(v => lovePercent >= v.range[0] && lovePercent <= v.range[1]);

    document.getElementById("percentage").innerText = `${lovePercent}%`;
    document.getElementById("prediction").innerText = vibe ? vibe.title : "Compatibility";

    // Do not auto-render tips; show only on button click
    document.getElementById("tips").innerHTML = "";
    document.getElementById("duration").innerText = vibe ? vibe.duration : "";
    document.getElementById("meterFill").style.width = `${lovePercent}%`;

    const entry = { boy, girl, lovePercent, summary: vibe?.title, user: currentUser.email, time: new Date().toLocaleString() };
    persist(entry);
    renderHistory();
    renderAdmin();
    showToast("Saved to history", "success");

}

function generateScore(a, b) {
    const seed = [...(a + b).toLowerCase()].reduce((acc, char, idx) => acc + char.charCodeAt(0) * (idx + 3), 7);
    const percent = 45 + (seed % 56);
    return Math.min(100, Math.max(15, percent));
}

function persist(entry) {
    const historyKey = historyKeyBase + currentUser.email;
    const history = JSON.parse(localStorage.getItem(historyKey) || "[]");
    history.unshift(entry);
    localStorage.setItem(historyKey, JSON.stringify(history.slice(0, 25)));

    const logs = JSON.parse(localStorage.getItem(logsKey) || "[]");
    logs.unshift(entry);
    localStorage.setItem(logsKey, JSON.stringify(logs.slice(0, 200)));
}

function renderHistory() {
    const wrap = document.getElementById("history");
    wrap.innerHTML = "";
    if (!currentUser) {
        wrap.innerHTML = '<p class="tips">Login to view your saved results.</p>';
        return;
    }

    const historyKey = historyKeyBase + currentUser.email;
    const history = JSON.parse(localStorage.getItem(historyKey) || "[]");
    if (!history.length) {
        wrap.innerHTML = '<p class="tips">No saved results yet.</p>';
        return;
    }

    const latest = history[0];
    const div = document.createElement("div");
    div.className = "history-item";
    div.innerHTML = `<strong>${latest.boy} & ${latest.girl}</strong><span>${latest.lovePercent}% · ${latest.time}</span>`;
    wrap.appendChild(div);
}

function openHistoryModal() {
    renderHistoryModal();
    toggleHistory(true);
}

function renderHistoryModal() {
    const list = document.getElementById("historyModalList");
    list.innerHTML = "";
    if (!currentUser) { list.innerHTML = '<p class="tips">Login required.</p>'; return; }
    const history = JSON.parse(localStorage.getItem(historyKeyBase + currentUser.email) || "[]");
    if (!history.length) { list.innerHTML = '<p class="tips">No entries yet.</p>'; return; }
    history.forEach(h => {
        const card = document.createElement("div");
        card.className = "history-card";
        card.innerHTML = `<strong>${h.boy} & ${h.girl}</strong><span>${h.lovePercent}% · ${h.summary || ''} · ${h.time}</span>`;
        list.appendChild(card);
    });
}

function toggleHistory(state) {
    document.getElementById("historyModal").classList.toggle("show", state);
}

function clearHistory() {
    if (!currentUser) { showToast("Login first", "warn"); return; }
    localStorage.removeItem(historyKeyBase + currentUser.email);
    renderHistory();
    showToast("History cleared", "warn");
}

function exportHistoryPdf() {
    if (!currentUser) { showToast("Login first", "warn"); return; }
    const history = JSON.parse(localStorage.getItem(historyKeyBase + currentUser.email) || "[]");
    if (!history.length) { showToast("Nothing to export", "warn"); return; }
    const win = window.open("", "_blank", "width=800,height=900");
    const rows = history.map(h => `<tr><td>${h.boy}</td><td>${h.girl}</td><td>${h.lovePercent}%</td><td>${h.summary || ''}</td><td>${h.time}</td></tr>`).join("");
    win.document.write(`<!DOCTYPE html><html><head><title>History PDF</title>
    <style>body{font-family:Arial;padding:16px} table{width:100%;border-collapse:collapse} th,td{border:1px solid #ccc;padding:8px;text-align:left} th{background:#f2f2f2}</style>
    </head><body><h2>${currentUser.email} - Love History</h2><table><thead><tr><th>Boy</th><th>Girl</th><th>%</th><th>Summary</th><th>Time</th></tr></thead><tbody>${rows}</tbody></table>
    <script>window.onload=()=>{window.print();};</script>
    </body></html>`);
    win.document.close();
    showToast("Print to PDF opened", "success");
}

function showTips() {
    if (!currentUser) { showToast("Login first", "warn"); toggleAuth(true, "login"); return; }
    const percentText = document.getElementById("percentage").innerText.replace("%", "");
    const lovePercent = Number(percentText) || 0;
    const vibe = vibeTips.find(v => lovePercent >= v.range[0] && lovePercent <= v.range[1]);
    const listSize = Math.floor(Math.random() * 6) + 5; // 5..10
    const picked = [];
    if (vibe && vibe.detail) picked.push(vibe.detail);
    const poolCopy = [...tipsPool].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(listSize - picked.length, poolCopy.length); i++) picked.push(poolCopy[i]);
    const tipsHtml = `<ul class="tips-list">${picked.map(t => `<li>${t}</li>`).join("")}</ul>`;
    document.getElementById("modalTitle").innerText = "Pro Tips for you";
    document.getElementById("modalBody").innerHTML = tipsHtml;
    toggleModal(true);
}

function toggleModal(state) { modal.classList.toggle("show", state); }

function toggleAuth(state, mode = "login") {
    setAuthMode(mode);
    authModal.classList.toggle("show", state);
}

function setAuthMode(mode) {
    authMode = mode;
    document.getElementById("tabLogin").classList.toggle("active", mode === "login");
    document.getElementById("tabSignup").classList.toggle("active", mode === "signup");
    document.getElementById("authTitle").innerText = mode === "login" ? "Login to continue" : "Create your account";
    document.getElementById("authEyebrow").innerText = mode === "login" ? "Access" : "New here";
    document.getElementById("authHint").innerText = mode === "login" ? "Use your saved credentials." : "We will verify your email with a code.";
    document.getElementById("verifyWrap").style.display = mode === "signup" ? "grid" : "none";
    if (mode === "login") {
        document.getElementById("authCode").value = "";
        document.getElementById("captchaAnswer").value = "";
    }
    if (mode === "signup") setCaptcha();
}

function submitAuth() {
    const email = document.getElementById("authEmail").value.trim().toLowerCase();
    const password = document.getElementById("authPassword").value.trim();
    const code = document.getElementById("authCode").value.trim();
    const captchaAns = document.getElementById("captchaAnswer").value.trim();

    if (!email || !password) { showToast("Email and password required", "warn"); return; }
    if (!validateEmail(email)) { showToast("Enter a valid email", "warn"); return; }
    if (authMode === "signup" && !isStrongPassword(password)) { showToast("Use a strong password (8+ chars with upper, lower, number, symbol)", "warn"); return; }

    const users = JSON.parse(localStorage.getItem(usersKey) || "[]");
    const profiles = JSON.parse(localStorage.getItem(profilesKey) || "{}");

    if (authMode === "signup") {
        if (users.some(u => u.email === email)) { showToast("Account already exists", "warn"); return; }
        if (!captchaAns || captchaAns.toLowerCase() !== String(currentCaptcha.answer).toLowerCase()) { showToast("Captcha incorrect", "warn"); return; }
        const existingCode = sessionStorage.getItem("verify:" + email);
        if (!existingCode) { showToast("Click Send Code first", "warn"); return; }
        if (code !== existingCode) { showToast("Incorrect verification code", "warn"); return; }
        sessionStorage.removeItem("verify:" + email);

        users.push({ email, password });
        localStorage.setItem(usersKey, JSON.stringify(users));
        profiles[email] = { displayName: email.split('@')[0], avatar: "" };
        localStorage.setItem(profilesKey, JSON.stringify(profiles));
        setSession({ email });
        showToast("Account created", "success");
    } else {
        const found = users.find(u => u.email === email && u.password === password);
        if (!found) { showToast("Invalid credentials", "warn"); return; }
        setSession({ email });
        showToast("Logged in", "success");
    }

    toggleAuth(false);
    renderHistory();
    renderAdmin();
}

function hydrateSession() {
    const saved = localStorage.getItem(sessionKey);
    if (saved) {
        currentUser = JSON.parse(saved);
    }
}

function setSession(user) {
    currentUser = user;
    localStorage.setItem(sessionKey, JSON.stringify(user));
}

function logout() {
    localStorage.removeItem(sessionKey);
    currentUser = null;
    renderHistory();
    showToast("Logged out", "success");
    toggleProfile(false);
}

function openProfile() { toggleProfile(true); loadProfile(); }
function toggleProfile(state) { profileModal.classList.toggle("show", state); }

function loadProfile() {
    if (!currentUser) return;
    const profiles = JSON.parse(localStorage.getItem(profilesKey) || "{}");
    const p = profiles[currentUser.email] || { displayName: "", avatar: "" };
    document.getElementById("displayName").value = p.displayName || "";
    document.getElementById("avatarImg").src = p.avatar || "";

    const historyKey = historyKeyBase + currentUser.email;
    const history = JSON.parse(localStorage.getItem(historyKey) || "[]");
    const latest = history[0];
    const metaEmail = document.getElementById("metaEmail");
    const metaSaves = document.getElementById("metaSaves");
    const metaLastCheck = document.getElementById("metaLastCheck");
    const metaLastSummary = document.getElementById("metaLastSummary");
    if (metaEmail) metaEmail.innerText = currentUser.email;
    if (metaSaves) metaSaves.innerText = history.length;
    if (latest) {
        if (metaLastCheck) metaLastCheck.innerText = `${latest.boy} & ${latest.girl}`;
        if (metaLastSummary) metaLastSummary.innerText = `${latest.lovePercent}% · ${latest.summary || ""} · ${latest.time}`;
    } else {
        if (metaLastCheck) metaLastCheck.innerText = "No entries yet";
        if (metaLastSummary) metaLastSummary.innerText = "Run your first check to see it here.";
    }
}

function saveAvatar() {
    if (!currentUser) return;
    const file = document.getElementById("avatarInput").files[0];
    if (!file) { showToast("Pick a picture first", "warn"); return; }
    const reader = new FileReader();
    reader.onload = () => {
        const profiles = JSON.parse(localStorage.getItem(profilesKey) || "{}");
        const p = profiles[currentUser.email] || {};
        p.avatar = reader.result;
        profiles[currentUser.email] = p;
        localStorage.setItem(profilesKey, JSON.stringify(profiles));
        document.getElementById("avatarImg").src = reader.result;
        showToast("Avatar saved", "success");
    };
    reader.readAsDataURL(file);
}

function saveProfile() {
    if (!currentUser) return;
    const name = document.getElementById("displayName").value.trim();
    const newPw = document.getElementById("newPassword").value.trim();
    const profiles = JSON.parse(localStorage.getItem(profilesKey) || "{}");
    const p = profiles[currentUser.email] || {};
    p.displayName = name;
    profiles[currentUser.email] = p;
    localStorage.setItem(profilesKey, JSON.stringify(profiles));

    if (newPw) {
        if (!isStrongPassword(newPw)) { showToast("New password must be strong (8+ chars with upper, lower, number, symbol)", "warn"); return; }
        const users = JSON.parse(localStorage.getItem(usersKey) || "[]");
        const idx = users.findIndex(u => u.email === currentUser.email);
        if (idx >= 0) { users[idx].password = newPw; localStorage.setItem(usersKey, JSON.stringify(users)); }
    }
    showToast("Profile saved", "success");
}

function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}
function isStrongPassword(pw) {
    if (!pw || pw.length < 8) return false;
    const hasUpper = /[A-Z]/.test(pw);
    const hasLower = /[a-z]/.test(pw);
    const hasNumber = /\d/.test(pw);
    const hasSymbol = /[^A-Za-z0-9]/.test(pw);
    return hasUpper && hasLower && hasNumber && hasSymbol;
}

function generateCode() { return String(Math.floor(100000 + Math.random() * 900000)); }

function sendVerificationCode() {
    const email = document.getElementById("authEmail").value.trim().toLowerCase();
    const captchaAns = document.getElementById("captchaAnswer").value.trim();
    if (!validateEmail(email)) { showToast("Enter a valid email first", "warn"); return; }
    if (!captchaAns || captchaAns.toLowerCase() !== String(currentCaptcha.answer).toLowerCase()) { showToast("Captcha incorrect", "warn"); return; }
    const code = generateCode();
    sessionStorage.setItem("verify:" + email, code);
    document.getElementById("codeHint").innerText = "Code sent. Check popup.";
    showCodePopup(code);
}

function showCodePopup(code) {
    const popup = document.createElement("div");
    popup.className = "code-popup";
    const fonts = ["'Courier New', monospace", "'Segoe UI', sans-serif", "'Space Grotesk', sans-serif", "'Georgia', serif", "'Lucida Console', monospace"]; 
    const font = fonts[Math.floor(Math.random() * fonts.length)];
    popup.innerHTML = `<div class="code-box"><p class="eyebrow">Verification</p><h4 style="font-family:${font};letter-spacing:1.5px;">${code}</h4><p class="tips">Enter this code and solve captcha.</p><div class="code-actions"><button class="ghost" id="copyCode">Copy</button><button class="secondary" id="closeCodePopup">Close</button></div></div>`;
    document.body.appendChild(popup);
    popup.querySelector("#copyCode").addEventListener("click", () => {
        navigator.clipboard.writeText(code).then(() => {
            showToast("Code copied", "success");
            popup.remove();
        });
    });
    popup.querySelector("#closeCodePopup").addEventListener("click", () => popup.remove());
    popup.addEventListener("click", (e) => { if (e.target === popup) popup.remove(); });
}

function setCaptcha() {
    const { prompt, answer } = generateCaptcha();
    currentCaptcha = { prompt, answer };
    document.getElementById("captchaPrompt").innerText = prompt;
    document.getElementById("captchaAnswer").value = "";
}

function generateCaptcha() {
    const a = Math.floor(Math.random() * 9) + 1;
    const b = Math.floor(Math.random() * 9) + 1;
    const ops = ["+", "-"]; const op = ops[Math.floor(Math.random() * ops.length)];
    const answer = op === "+" ? a + b : a - b;
    return { prompt: `Solve: ${a} ${op} ${b}`, answer };
}

function setupOwner() {
    // Set owner email once, if not set
    if (!localStorage.getItem(ownerKey)) {
        localStorage.setItem(ownerKey, "admin@love.local");
    }
}

function renderAdmin() {
    const users = JSON.parse(localStorage.getItem(usersKey) || "[]");
    const logs = JSON.parse(localStorage.getItem(logsKey) || "[]");
    const ownerEmail = localStorage.getItem(ownerKey);

    const userWrap = document.getElementById("adminUsers");
    const logWrap = document.getElementById("adminLogs");
    userWrap.innerHTML = "";
    logWrap.innerHTML = "";

    if (!users.length) userWrap.innerHTML = '<p class="tips">No users yet.</p>';
    users.forEach(u => {
        const item = document.createElement("div");
        item.className = "admin-item";
        const tag = u.email === ownerEmail ? "owner" : "user";
        item.innerHTML = `<strong>${u.email}</strong><span>${tag}</span>`;
        userWrap.appendChild(item);
    });

    if (!logs.length) logWrap.innerHTML = '<p class="tips">No calculations yet.</p>';
    logs.slice(0, 50).forEach(log => {
        const item = document.createElement("div");
        item.className = "admin-item";
        item.innerHTML = `<strong>${log.boy} & ${log.girl}</strong><span>${log.lovePercent}% · ${log.user || "anon"} · ${log.time}</span>`;
        logWrap.appendChild(item);
    });
}

function showToast(message, type = "info") {
    toast.innerText = message;
    const color = type === "success" ? "var(--success)" : type === "warn" ? "var(--warn)" : "var(--text)";
    toast.style.borderLeft = `4px solid ${color}`;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2500);
}

function animateNotes() {
    const notes = document.querySelectorAll(".note");
    // Force reflow to ensure animation triggers
    notes.forEach((note, index) => {
        // Reset animation
        note.style.animation = "none";
        // Trigger reflow
        void note.offsetWidth;
        // Apply animation with staggered delay
        const delaySeconds = index * 0.2;
        note.style.animationDelay = delaySeconds + "s";
        note.style.animation = "slideInNote 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards " + delaySeconds + "s";
    });
}
