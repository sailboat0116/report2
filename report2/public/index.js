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
