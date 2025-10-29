let isGenerating = false; // 🔒 避免重複提交

document.getElementById("reportForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    // 如果正在處理中，就不讓再次提交
    if (isGenerating) {
        toast("系統正在處理中，請稍候…");
        return;
    }

    const obsEl = document.getElementById("observation");
    const resultEl = document.getElementById("result");
    const resultBadge = document.getElementById("resultBadge");

    const obs = obsEl.value.replace(/[\r\n]+/g, "").trim();
    if (!obs) {
        toast("請先輸入觀察內容");
        return;
    }

    // === 鎖定 ===
    isGenerating = true;
    resultEl.textContent = "生成中…";
    resultBadge.textContent = "處理中";
    localStorage.setItem("lastObservation", obs);

    try {
        const response = await fetch("https://n8n.fcubiolab.com/webhook/send-observation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ observation: obs }),
        });

        const result = await response.json();
        console.log("Result from server:", result);

        resultEl.innerText = result.response || result.error;

        if (result.form_data) {
            const formDataToSave = {
                ...result.form_data,
                imp: {
                    T: result.form_data?.T_stage,
                    N: result.form_data?.N_stage,
                    M: result.form_data?.M_stage,
                },
            };

            localStorage.setItem("generatedReport", JSON.stringify(formDataToSave));
            localStorage.setItem("reportText", result.response);

            // 延遲兩秒再跳轉
            setTimeout(() => {
                if (
                    result.form_data.benign_malignant?.toLowerCase() === "benign" ||
                    result.form_data.benign_malignant === "良性"
                ) {
                    window.location.href = "/benign.html";
                } else {
                    window.location.href = "/response.html";
                }
            }, 2000);
        }

        toast("生成完成 ✅");
    } catch (err) {
        console.error("Fetch error:", err);
        alert("資料送出失敗！");
    } finally {
        // === 解鎖 ===
        isGenerating = false;
        resultBadge.textContent = "完成";
    }
});

// === 輕量 toast ===
function toast(msg){
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.position='fixed';
    t.style.left='50%';
    t.style.top='24px';
    t.style.transform='translateX(-50%)';
    t.style.background='#111827';
    t.style.color='#fff';
    t.style.padding='10px 14px';
    t.style.borderRadius='8px';
    t.style.boxShadow='0 8px 24px rgba(0,0,0,.18)';
    t.style.zIndex='9999';
    document.body.appendChild(t);
    setTimeout(()=>{ t.style.opacity='0'; t.style.transition='opacity .25s'; }, 1200);
    setTimeout(()=>{ t.remove(); }, 1600);
}

// === 元素參照 ===
const obsEl = document.getElementById('observation');
const resultEl = document.getElementById('result');
const charCountEl = document.getElementById('charCount');
const obsBadge = document.getElementById('obsBadge');
const resultBadge = document.getElementById('resultBadge');

// === 預填：若本機有暫存，帶回輸入框（不覆蓋你 report.js 的流程） ===
const savedObs = localStorage.getItem('lastObservation');
if (savedObs) {
    obsEl.value = savedObs;
    charCountEl.textContent = savedObs.length + ' 字';
    obsBadge.textContent = 'Loaded';
}

// === 輸入字數即時更新 ===
obsEl.addEventListener('input', () => {
    charCountEl.textContent = (obsEl.value || '').length + ' 字';
});

// === 送出：Ctrl/Cmd+Enter 快捷 ===
obsEl.addEventListener('keydown', (e)=>{
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        document.getElementById('reportForm').requestSubmit();
    }
});

// === 複製觀察與結果 ===
function copy(text){ navigator.clipboard.writeText(text || ''); toast('已複製'); }
document.getElementById('copyObsBtn').addEventListener('click', ()=> copy(obsEl.value));
document.getElementById('quickCopyObs').addEventListener('click', ()=> copy(obsEl.value));
document.getElementById('copyResultBtn').addEventListener('click', ()=> copy(resultEl.textContent));
document.getElementById('quickCopyRes').addEventListener('click', ()=> copy(resultEl.textContent));

// === 儲存至 localStorage：將結果寫入 reportText，供 response.html 使用 ===
document.getElementById('saveLocalBtn').addEventListener('click', ()=>{
    const text = (resultEl.textContent || '').trim();
    if (!text || text === '尚未產生結果' || text === '生成中…'){
        toast('目前沒有可儲存的結果'); return;
    }
    localStorage.setItem('reportText', text);
    toast('已儲存至本機（reportText）');
    resultBadge.textContent = '已儲存';
});

// === 前往結果頁 ===
document.getElementById('toResponseBtn').addEventListener('click', ()=>{
    // 若未保存，先嘗試寫入一次
    const text = (resultEl.textContent || '').trim();
    if (text && text !== '尚未產生結果' && text !== '生成中…'){
        localStorage.setItem('reportText', text);
    }
    window.location.href = 'response.html';
});

// === 返回填表 ===
document.getElementById('backBtn').addEventListener('click', ()=>{
    window.location.href = 'index.html';
});

// === 清空輸入 ===
document.getElementById('clearBtn').addEventListener('click', ()=>{
    if (!obsEl.value) { toast('無需清空'); return; }
    if (confirm('確定要清空輸入內容？')){
        obsEl.value = '';
        localStorage.removeItem('lastObservation');
        charCountEl.textContent = '0 字';
        toast('已清空');
    }
});

// === 安全登出 ===
document.getElementById('logoutBtn').addEventListener('click', ()=>{
    if (confirm('確定要登出嗎？')){
        localStorage.removeItem('doctorAuth');
        window.location.href = 'login.html';
    }
});

// === 觀察：若 report.js 生成後有寫入 reportText，這裡監聽 storage 反映到頁面（同分頁安全保底） ===
window.addEventListener('storage', (e)=>{
    if (e.key === 'reportText') {
        const v = e.newValue || '';
        if (v.trim()) {
            resultEl.textContent = v;
            resultBadge.textContent = '已更新';
        }
    }
});

// === 若本地已有 reportText，載入為預設結果（方便回看） ===
const existing = localStorage.getItem('reportText');
if (existing && existing.trim()){
    resultEl.textContent = existing;
    resultBadge.textContent = 'Loaded';
}