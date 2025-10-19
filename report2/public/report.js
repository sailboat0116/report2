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
        const response = await fetch("http://172.20.10.2:5678/webhook/send-observation", {
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
