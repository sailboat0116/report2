from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)

n8n_url = "http://localhost:5678/webhook-test/send-observation"  # 注意這裡需與你的 n8n 路徑對應

@app.route("/send-observation", methods=["POST"])
def send_observation():
    data = request.get_json()
    observation = data.get("observation")

    print("[Flask 收到觀察內容]：", observation)

    try:
        # 向 n8n 發送 POST
        res = requests.post(n8n_url, json={"observation": observation})
        res.raise_for_status()  # 加上錯誤拋出

        # ✅ 直接解析 n8n 的 JSON 結果並轉發給前端
        result_from_n8n = res.json()
        return jsonify(result_from_n8n)

    except Exception as e:
        print("發送到 n8n 發生錯誤：", str(e))
        return jsonify({"error": "Failed to contact n8n", "detail": str(e)}), 500

if __name__ == "__main__":
    app.run(port=8888)
