document.getElementById("reportForm").addEventListener("submit", async function (e) {
    e.preventDefault();
    const obs = document.getElementById("observation").value;

    try {
        const token = localStorage.getItem('token');

        const response = await fetch("http://localhost:3001/send-observations", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
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
            localStorage.setItem("generatedReport", JSON.stringify(formDataToSave));
            localStorage.setItem("reportText", result.response);



            setTimeout(() => {
                window.location.href = "/response.html";
            }, 2000);
        }

    } catch (err) {
        console.error("Fetch error:", err);
        alert("資料送出失敗！");
    }
});
