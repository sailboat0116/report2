window.addEventListener("DOMContentLoaded", () => {
    const raw = localStorage.getItem("generatedReport");
    if (!raw) return;

    let report;
    try {
        report = JSON.parse(raw);
    } catch {
        alert("診斷報告解析失敗！");
        return;
    }

    // 自動填寫 IMP 區塊
    const imp_T = document.querySelectorAll('.imp-text input')[0];
    const imp_N = document.querySelectorAll('.imp-text input')[1];
    const imp_M = document.querySelectorAll('.imp-text input')[2];

    if (report.imp?.T) imp_T.value = report.imp.T.replace(/[^0-9a-zA-Z]/g, '');
    if (report.imp?.N) imp_N.value = report.imp.N.replace(/[^0-9a-zA-Z]/g, '');
    if (report.imp?.M) imp_M.value = report.imp.M.replace(/[^0-9a-zA-Z]/g, '');

    // 自動勾選 T/N/M 分類
    function autoCheckInputs(group, val) {
        if (!val) return;
        const inputs = document.querySelectorAll(`input[name="${group}"], input[name="${group}1"]`);
        inputs.forEach(input => {
            const labelText = input.parentElement.textContent.trim();
            if (labelText.includes(val)) {
                input.checked = true;
            }
        });
    }

    autoCheckInputs("T", report.T_stage);
    autoCheckInputs("N", report.N_stage);
    autoCheckInputs("M", report.M_stage);

    // 勾選 Tumor Location
    if (report.tumor_location) {
        const locationMap = {
            "RUL": "Right upper lobe",
            "RML": "Right middle lobe",
            "RLL": "Right lower lobe",
            "LUL": "Left upper lobe",
            "LLL": "Left lower lobe"
        };

        const tumorKeys = report.tumor_location.split(",").map(loc => loc.trim());

        tumorKeys.forEach(loc => {
            const label = locationMap[loc];
            if (!label) return;

            document.querySelectorAll('input[name="location"]').forEach(input => {
                if (input.parentElement.textContent.trim() === label) {
                    input.checked = true;
                }
            });
        });
    }

    // 顯示 tumor size（直接填）
    const sizeField = document.querySelector('input[placeholder*="cm"]');
    if (sizeField && report.tumor_size_cm) {
        const cm = parseFloat(report.tumor_size_cm).toFixed(1);
        sizeField.value = `${cm} cm`;
    }

    // Other findings
    const otherFindings = document.querySelector('textarea[placeholder="Enter other findings here..."]');
    if (otherFindings && report.other_findings) {
        otherFindings.value = report.other_findings;
    }
});

document.addEventListener("DOMContentLoaded", () => {
    document.querySelector("button").addEventListener("click", () => {
        // Tumor location
        const locationCheckboxes = document.querySelectorAll("input[name='location']:checked");
        const tumorLocation = Array.from(locationCheckboxes).map(cb => cb.parentElement.textContent.trim());

        // Tumor size
        let tumorSizeCm = "";
        const sizeRadios = document.querySelectorAll("input[name='size']");
        sizeRadios.forEach(radio => {
            if (radio.checked) {
                const nextInput = radio.parentElement.querySelector("input[type='text']");
                tumorSizeCm = nextInput ? nextInput.value : radio.parentElement.textContent.trim();
            }
        });

        // T stage
        const tStageCheckboxes = document.querySelectorAll("input[name='T']:checked");
        const tStage = Array.from(tStageCheckboxes).map(cb => cb.parentElement.textContent.trim());

        // N stage
        const nStageCheckboxes = document.querySelectorAll("input[name='N']:checked");
        const nStage = Array.from(nStageCheckboxes).map(cb => cb.parentElement.textContent.trim());

        // M stage
        const mStageCheckboxes = document.querySelectorAll("input[name='M']:checked, input[name='M1']:checked");
        const mStage = Array.from(mStageCheckboxes).map(cb => cb.parentElement.textContent.trim());

        // Other findings
        const otherFindings = document.querySelector("fieldset textarea")?.value || "";

        // IMP
        const impInputs = document.querySelectorAll(".imp-text input");
        const imp = {
            T: impInputs[0]?.value || "",
            N: impInputs[1]?.value || "",
            M: impInputs[2]?.value || ""
        };

        // Lung-RADS Category
        const lungRadsCategory = "";

        const result = {
            tumor_location: tumorLocation.join(", "),
            tumor_size_cm: tumorSizeCm,
            T_stage: tStage.join(", "),
            N_stage: nStage.join(", "),
            M_stage: mStage.join(", "),
            lung_rads_category: lungRadsCategory,
            other_findings: otherFindings,
            imp: imp
        };

        console.log("Saved JSON:", result);

        // 1. 送到你自己的 Express 伺服器（port 3001）
        const token = localStorage.getItem('token');
        fetch("http://localhost:3001/save-result", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify(result)
        })

            .then(res => res.json())
            .then(data => {
                console.log("存檔結果：", data);
            })
            .catch(err => {
                console.error("存檔失敗：", err);
            });

        // 2. 送到 n8n webhook（port 5678）
        fetch('http://localhost:5678/webhook-test/lung-report', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(result)
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                console.log('成功傳送至 n8n:', data);
            })
            .catch(error => {
                console.error('傳送失敗:', error);
            });
    });
});
