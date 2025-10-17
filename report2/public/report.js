document.getElementById("reportForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    const obs = document.getElementById("observation").value;
    try {

        const response = await fetch("http://172.20.10.2:5678/webhook/send-observation", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ observation: obs })
        });

        const result = await response.json();
        console.log("Result from server:", result);

        document.getElementById("result").innerText = result.response || result.error;

        if (result.form_data) {
            const formDataToSave = {
                ...result.form_data,
                imp: {
                    T: result.form_data?.T_stage,
                    N: result.form_data?.N_stage,
                    M: result.form_data?.M_stage,
                }
            };
            console.log(result.form_data);
            localStorage.setItem("generatedReport", JSON.stringify(formDataToSave));
            localStorage.setItem("reportText", result.response);

            // ✅ 改為絕對路徑
            setTimeout(() => {
                if (result.form_data.benign_malignant?.toLowerCase() === "benign" ||
                    result.form_data.benign_malignant === "良性") {
                    console.log("aaa");
                    window.location.href = "/benign.html";
                } else {
                    window.location.href = "/response.html";
                }
            }, 2000);
        }

    } catch (err) {
        console.error("Fetch error:", err);
        alert("資料送出失敗！");
    }
});