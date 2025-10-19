// index.js（自動填寫 + 驗證 + 送出）
document.addEventListener("DOMContentLoaded", () => {
    // ==== 取得元素 ====
    const recordId    = document.getElementById("recordId");
    const patientName = document.getElementById("patientName");
    const patientInfo = document.getElementById("patientInfo");
    const imagingDate = document.getElementById("date");
    const saveBtn     = document.getElementById("saveBtn");

    // Tumor Location - Other 欄位
    const locationOtherInput = document.querySelector('input[placeholder="Other"]');

    // ==== 小工具 ====
    const isEmpty = (el) => !el || el.value.trim() === "";
    const focusAndScroll = (el) => {
        if (!el) return;
        el.focus();
        el.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    // ==== 驗證（所有規則匯總） ====
    function validateForm() {
        const missing = [];
        let firstInvalidEl = null;

        // 1) 基本欄位
        if (isEmpty(recordId)) {
            missing.push("病歷編號");
            if (!firstInvalidEl) firstInvalidEl = recordId;
        }
        if (isEmpty(patientName)) {
            missing.push("患者姓名");
            if (!firstInvalidEl) firstInvalidEl = patientName;
        }
        if (isEmpty(patientInfo)) {
            missing.push("患者資料");
            if (!firstInvalidEl) firstInvalidEl = patientInfo;
        }
        if (isEmpty(imagingDate)) {
            missing.push("檢查日期");
            if (!firstInvalidEl) firstInvalidEl = imagingDate;
        }

        // 2) Imaging Modality 至少一個
        const modalityChecked = document.querySelectorAll('input[name="modality"]:checked').length > 0;
        if (!modalityChecked) {
            missing.push("Imaging Modality（至少勾選一項）");
            if (!firstInvalidEl) firstInvalidEl = document.querySelector('input[name="modality"]');
        }

        // 3) Tumor Location：若都沒勾 => Other 必填
        const anyLocationChecked = document.querySelectorAll('input[name="location"]:checked').length > 0;
        const otherFilled = locationOtherInput && locationOtherInput.value.trim() !== "";
        if (!anyLocationChecked && !otherFilled) {
            missing.push("Tumor Location（請勾選至少一項或填寫 Other）");
            if (!firstInvalidEl) firstInvalidEl = locationOtherInput || document.querySelector('input[name="location"]');
        }

        // 4) Size：必選其一；Measurable 時輸入框必填
        const sizeRadios = document.querySelectorAll('input[name="size"]');
        const checkedSize = Array.from(sizeRadios).find(r => r.checked);
        const measurableInput = document.querySelector('input[placeholder*="cm"]');

        if (!checkedSize) {
            missing.push("Tumor Size（請擇一勾選 Non-measurable 或 Measurable）");
            if (!firstInvalidEl) firstInvalidEl = sizeRadios[0];
        } else {
            if (checkedSize.parentElement.textContent.includes("Measurable")) {
                // Measurable 被選中 → 輸入框必填
                if (!measurableInput || isEmpty(measurableInput)) {
                    missing.push("Tumor Size（Measurable 必須填寫數值）");
                    if (!firstInvalidEl) firstInvalidEl = measurableInput || sizeRadios[0];
                }
            } else if (checkedSize.parentElement.textContent.includes("Non-measurable")) {
                // Non-measurable 被選中 → Measurable 欄位不可填數字
                if (measurableInput && measurableInput.value.trim() !== "") {
                    missing.push("請勿在 Measurable 欄位輸入數值（已選擇 Non-measurable）");
                    if (!firstInvalidEl) firstInvalidEl = measurableInput;
                }
            }
        }


        // 5) T Classification 至少一個
        const tChecked = document.querySelectorAll('input[name="T"]:checked').length > 0;
        if (!tChecked) {
            missing.push("Tumor Invasion (T Classification)（至少勾選一項）");
            if (!firstInvalidEl) firstInvalidEl = document.querySelector('input[name="T"]');
        }

        // 6) N Classification 至少一個
        const nChecked = document.querySelectorAll('input[name="N"]:checked').length > 0;
        if (!nChecked) {
            missing.push("Regional Lymph Nodal involvement (N Classification)（至少勾選一項）");
            if (!firstInvalidEl) firstInvalidEl = document.querySelector('input[name="N"]');
        }

        // 7) M Classification 至少一個（含 M 與 M1 群）
        const mChecked = document.querySelectorAll('input[name="M"]:checked, input[name="M1"]:checked').length > 0;
        if (!mChecked) {
            missing.push("Distant Metastasis (M Classification)（至少勾選一項）");
            if (!firstInvalidEl) firstInvalidEl = document.querySelector('input[name="M"]');
        }

        // 8) IMP 三格必填
        const impInputs = document.querySelectorAll(".imp-text input");
        if (impInputs.length >= 3) {
            if (isEmpty(impInputs[0])) {
                missing.push("IMP 欄位 T（不可空白）");
                if (!firstInvalidEl) firstInvalidEl = impInputs[0];
            }
            if (isEmpty(impInputs[1])) {
                missing.push("IMP 欄位 N（不可空白）");
                if (!firstInvalidEl) firstInvalidEl = impInputs[1];
            }
            if (isEmpty(impInputs[2])) {
                missing.push("IMP 欄位 M（不可空白）");
                if (!firstInvalidEl) firstInvalidEl = impInputs[2];
            }
        }

        if (missing.length > 0) {
            alert(`請先完成以下必填欄位：\n• ${missing.join("\n• ")}`);
            focusAndScroll(firstInvalidEl);
            return false;
        }
        return true;
    }

    // ==== 自動填寫（localStorage.generatedReport） ====
    (function autofillFromLocalStorage() {
        const raw = localStorage.getItem("generatedReport");
        if (!raw) return;

        let report;
        try {
            report = JSON.parse(raw);
        } catch {
            alert("診斷報告解析失敗！");
            return;
        }

        localStorage.setItem('lungRadsCategory', report.lung_rads_category);

        // 1. Imaging Date
        const dateInput = document.querySelector('input[name="date"]');
        if (dateInput && report.imaging_date) {
            dateInput.value = report.imaging_date.trim();
        }

        // 2. Imaging Modality (checkbox)
        if (report["Imaging Modality"]) {
            const modalityMap = {
                "CT": "CT scan",
                "MRI": "MRI"
            };
            document.querySelectorAll('input[name="modality"]').forEach(cb => {
                const label = cb.parentElement.textContent.trim();
                cb.checked = label === modalityMap[report["Imaging Modality"]];
            });
        }

        // IMP
        const impInputs = document.querySelectorAll(".imp-text input");
        const imp_T = impInputs[0], imp_N = impInputs[1], imp_M = impInputs[2];
        if (report.imp?.T) imp_T.value = report.imp.T.replace(/[^0-9a-zA-Z]/g, "");
        if (report.imp?.N) imp_N.value = report.imp.N.replace(/[^0-9a-zA-Z]/g, "");
        if (report.imp?.M) imp_M.value = report.imp.M.replace(/[^0-9a-zA-Z]/g, "");

        // 自動勾選 T/N/M
        function autoCheckStage(group, val) {
            if (!val) return;
            // 兼容 name="T" 或 name="T1" 等命名規則
            const inputs = document.querySelectorAll(`input[name="${group}"], input[name="${group}1"]`);
            inputs.forEach(input => {
                const labelText = input.parentElement.textContent.trim();
                // 取冒號前的代號
                const code = labelText.split(":")[0].trim();
                if (code.toLowerCase() === val.toLowerCase()) {
                    input.checked = true;
                }
            });
        }

        // 使用示例
        autoCheckStage("T", report.T_stage); // 勾選 T 分期
        autoCheckStage("N", report.N_stage); // 勾選 N 分期
        autoCheckStage("M", report.M_stage); // 勾選 M 分期

        // Tumor Location
        if (report.tumor_location) {
            const locationMap = {
                RUL: "Right upper lobe",
                RML: "Right middle lobe",
                RLL: "Right lower lobe",
                LUL: "Left upper lobe",
                LLL: "Left lower lobe",
            };

            // 分割並清理輸入
            const tumorLocations = report.tumor_location
                .split(",")
                .map(s => s.trim().toUpperCase())
                .filter(Boolean)
                .map(s => {
                    // 從中文格式提取 RUL/LUL/LLL...
                    const matchBracket = s.match(/\((RUL|RML|RLL|LUL|LLL)\)/i);
                    if (matchBracket) return matchBracket[1].toUpperCase();

                    // 若是英文代碼開頭（例如 RUL 44mm），只取開頭代碼
                    const matchPrefix = s.match(/^(RUL|RML|RLL|LUL|LLL)\b/i);
                    if (matchPrefix) return matchPrefix[1].toUpperCase();

                    return null;
                })
                .filter(Boolean); // 去除無效項

            // 精準勾選對應肺葉
            document.querySelectorAll('input[name="location"]').forEach(input => {
                const label = input.parentElement.textContent.trim();
                input.checked = false; // 重置狀態

                tumorLocations.forEach(code => {
                    const expectedLabel = locationMap[code];
                    if (expectedLabel && label === expectedLabel) {
                        input.checked = true;
                    }
                });
            });
        }

        // Tumor size（只填文字框）
        const sizeRadios = document.querySelectorAll('input[name="size"]');
        if (report.tumor_size_cm) {
            const sizeVal = report.tumor_size_cm.toLowerCase();
            if (sizeVal.includes("non")) {
                sizeRadios.forEach(r => {
                    if (r.parentElement.textContent.includes("Non-measurable")) r.checked = true;
                });
            } else {
                sizeRadios.forEach(r => {
                    if (r.parentElement.textContent.includes("Measurable")) {
                        r.checked = true;
                        const input = r.parentElement.querySelector('input[type="text"]');
                        if (input) input.value = report.tumor_size_cm;
                    }
                });
            }
        }

        // Other findings
        const otherFindings = document.querySelector('textarea[placeholder="Enter other findings here..."]');
        if (otherFindings && report.other_findings) {
            otherFindings.value = report.other_findings;
        }

        saveReport();
    })();

    // ==== 儲存：先驗證，通過才送 ====
    saveBtn.addEventListener("click", () => {
        if (!validateForm()) return;

        // ---- 收集資料 ----
        // Location（勾選 + Other 併入）
        const tumorLocation = Array.from(
            document.querySelectorAll('input[name="location"]:checked')
        ).map(cb => cb.parentElement.textContent.trim());
        const otherLoc = locationOtherInput?.value.trim();
        if (otherLoc) tumorLocation.push(otherLoc);

        // Size
        let tumorSizeCm = "";
        document.querySelectorAll('input[name="size"]').forEach(radio => {
            if (radio.checked) {
                const nextInput = radio.parentElement.querySelector('input[type="text"]');
                tumorSizeCm = nextInput ? nextInput.value : radio.parentElement.textContent.trim();
            }
        });

        // T / N / M
        const tStage = Array.from(document.querySelectorAll('input[name="T"]:checked'))
            .map(cb => cb.parentElement.textContent.trim());
        const nStage = Array.from(document.querySelectorAll('input[name="N"]:checked'))
            .map(cb => cb.parentElement.textContent.trim());
        const mStage = Array.from(document.querySelectorAll('input[name="M"]:checked, input[name="M1"]:checked'))
            .map(cb => cb.parentElement.textContent.trim());

        // Other Findings
        const otherFindings = document.getElementById("otherFinding")?.value || "";

        // IMP
        const impInputs = document.querySelectorAll(".imp-text input");
        const imp = {
            T: impInputs[0]?.value || "",
            N: impInputs[1]?.value || "",
            M: impInputs[2]?.value || "",
        };

        const lungRadsCategory = localStorage.getItem('lungRadsCategory');

        const parsedReport_text = localStorage.getItem("lastObservation");

        const filename = `${recordId.value.trim()}_${imagingDate.value}.json`;

        const result = {
            record_id: recordId.value.trim(),
            patient_name: patientName.value.trim(),
            patient_info: patientInfo.value.trim(),
            imaging_date: imagingDate.value,
            tumor_location: tumorLocation.join(", "),
            tumor_size_cm: tumorSizeCm,
            T_stage: tStage.join(", "),
            N_stage: nStage.join(", "),
            M_stage: mStage.join(", "),
            lung_rads_category: lungRadsCategory,
            other_findings: otherFindings,
            imp,
            input: parsedReport_text,
            filename
        };

        console.log("Saved JSON:", result);

        // 顯示「儲存中」提示
        if (typeof toast === "function") {
            toast("🕒 正在儲存中…");
        } else {
            alert("🕒 正在儲存中…");
        }

        // ---- 傳到你的 Express 伺服器 ----
        fetch("http://172.20.10.2:3001/save-result", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(result),
        })
            .then(res => res.json())
            .then(data => console.log("存檔結果：", data))
            .catch(err => console.error("存檔失敗：", err));

        // ---- 傳到 n8n webhook ----
        fetch("http://172.20.10.2:5678/webhook/lung-report", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(result),
        })
            .then(response => {
                if (!response.ok) throw new Error("Network response was not ok");
                return response.json();
            })
            .then(data => console.log("成功傳送至 n8n:", data))
            .catch(error => console.error("傳送失敗:", error));

        // ✅ 儲存成功提示
        if (typeof toast === "function") {
            toast("✅ 已成功儲存報告！");
        } else {
            alert("✅ 已成功儲存報告！");
        }
    });

    function saveReport() {

        // ---- 收集資料 ----
        // Location（勾選 + Other 併入）
        const tumorLocation = Array.from(
            document.querySelectorAll('input[name="location"]:checked')
        ).map(cb => cb.parentElement.textContent.trim());
        const otherLoc = locationOtherInput?.value.trim();
        if (otherLoc) tumorLocation.push(otherLoc);

        // Size
        let tumorSizeCm = "";
        document.querySelectorAll('input[name="size"]').forEach(radio => {
            if (radio.checked) {
                const nextInput = radio.parentElement.querySelector('input[type="text"]');
                tumorSizeCm = nextInput ? nextInput.value : radio.parentElement.textContent.trim();
            }
        });

        // T / N / M
        const tStage = Array.from(document.querySelectorAll('input[name="T"]:checked'))
            .map(cb => cb.parentElement.textContent.trim());
        const nStage = Array.from(document.querySelectorAll('input[name="N"]:checked'))
            .map(cb => cb.parentElement.textContent.trim());
        const mStage = Array.from(document.querySelectorAll('input[name="M"]:checked, input[name="M1"]:checked'))
            .map(cb => cb.parentElement.textContent.trim());

        // Other Findings
        const otherFindings = document.getElementById("otherFinding")?.value || "";

        // IMP
        const impInputs = document.querySelectorAll(".imp-text input");
        const imp = {
            T: impInputs[0]?.value || "",
            N: impInputs[1]?.value || "",
            M: impInputs[2]?.value || "",
        };

        const lungRadsCategory = localStorage.getItem("lungRadsCategory");
        const parsedReport_text = localStorage.getItem("lastObservation");

        const filename = `${recordId.value.trim()}_${imagingDate.value}.json`;

        const result = {
            record_id: recordId.value.trim(),
            patient_name: patientName.value.trim(),
            patient_info: patientInfo.value.trim(),
            imaging_date: imagingDate.value,
            tumor_location: tumorLocation.join(", "),
            tumor_size_cm: tumorSizeCm,
            T_stage: tStage.join(", "),
            N_stage: nStage.join(", "),
            M_stage: mStage.join(", "),
            lung_rads_category: lungRadsCategory,
            other_findings: otherFindings,
            imp,
            input: parsedReport_text,
            filename
        };

        console.log("Saved JSON:", result);

        // ---- 傳到 Express 伺服器 ----
        fetch("http://172.20.10.2:3001/save-before-result", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(result),
        })
            .then(res => res.json())
            .then(data => console.log("存檔結果：", data))
            .catch(err => console.error("存檔失敗：", err));
    }
});