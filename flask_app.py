from flask import Flask, request, jsonify
import faiss
import pickle
from sentence_transformers import SentenceTransformer
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig
import torch
from langchain.document_loaders import PyPDFLoader, UnstructuredWordDocumentLoader 
from langchain.text_splitter import CharacterTextSplitter
from langchain.vectorstores import FAISS
from langchain.embeddings import SentenceTransformerEmbeddings
from langchain.chains import ConversationalRetrievalChain
from langchain.memory import ConversationBufferMemory
from langchain.llms.huggingface_pipeline import HuggingFacePipeline
import torch
import re
import json
import logging
import glob

from flask import Flask, request, jsonify
from sentence_transformers import SentenceTransformer
from transformers import AutoTokenizer, AutoModelForCausalLM, BitsAndBytesConfig, pipeline

app = Flask(__name__)

# 模型路徑
model_path = "DeepSeek-R1-Distill-Qwen-14B"

bnb_config = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_use_double_quant=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.float16,
)

print("🚀 載入模型...")
tokenizer = AutoTokenizer.from_pretrained(model_path, trust_remote_code=True)
model = AutoModelForCausalLM.from_pretrained(
    model_path,
    quantization_config=bnb_config,
    device_map="auto",
    trust_remote_code=True
)

# 載入向量索引 + 文件段落
print("📚 載入知識庫...")
index = faiss.read_index("vector.index")
with open("docs.pkl", "rb") as f:
    docs = pickle.load(f)

retriever = SentenceTransformer("all-MiniLM-L6-v2")

def retrieve(query, k=3):
    q_embed = retriever.encode([query])
    D, I = index.search(q_embed, k)
    return [docs[i] for i in I[0]]

print("✅ 準備完成，開始問書📘！輸入 exit 可離開")

def generate_report(question: str) -> str:
    context_docs = retrieve(question, k=3)
    context = "\n".join(context_docs)


    '''full_prompt = f"""<|user|>
    根據以下資料回答問題：
    {context}
    問題：{question}
    <|assistant|> (繁體中文)(根據檔案的格式產出報告)(lung-rads-assessment-categories.pdf的資料優先)(400字以內)
    """
'''
    full_prompt = f"""
    請你扮演一位放射科醫師，根據你學習的資料（包含 mydoc.pdf 的教材內容）與 Lung-RADS 評估指引，根據以下觀察內容撰寫診斷報告並以患者的角度給予易懂的建議。

    請一定要依照以下格式產出：

    ---
    一定要按照以下生成每一個一模一樣的項目內容【結構化填表欄位（for form）】：
    請用 JSON 格式回傳以下欄位值（如無法確定，請填 null）：

    ```json
    {{
        "tumor_location": "",
        "tumor_size_cm": "",
        "T_stage": "",
        "N_stage": "" ,
        "M_stage": "" ,
        "lung_rads_category": "",
        "other_findings": "" ,
        "imp": {{
            "T": "",
            "N": "",
            "M": ""
        }}
    }}

    以下為觀察內容描述：
    "{question}"
    """

    # Step 2: 編碼 prompt
    inputs = tokenizer(full_prompt, return_tensors="pt").to(model.device)
    input_ids = inputs["input_ids"]
    input_len = input_ids.shape[1]  # 拿來後面切分用

    with torch.no_grad():
        output = model.generate(
            input_ids=input_ids,
            attention_mask=inputs["attention_mask"],
            max_new_tokens=500,
            do_sample=True,
            temperature=0.7,
            top_k=50,
            top_p=0.9,
            pad_token_id=tokenizer.eos_token_id,
        )

    # Step 4: 去掉 prompt，只取模型新生成的內容
    generated_ids = output[:, input_len:]
    answer = tokenizer.decode(generated_ids[0], skip_special_tokens=True)


    '''inputs = tokenizer(full_prompt, return_tensors="pt").to(model.device)
    with torch.no_grad():
        output = model.generate(
            **inputs,
            max_new_tokens=1000,
            temperature=0.7,
            top_k=50,
            top_p=0.9,
            do_sample=True
        )
    answer = tokenizer.decode(output[0], skip_special_tokens=True).split("</think>\n")[-1]'''

    # 擷取 JSON 區段
    json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", answer, re.DOTALL)
    if not json_match:
        json_match = re.search(r"(\{[\s\S]*?\})", answer)

    form_data = None
    if json_match:
        try:
            json_text = json_match.group(1).strip()
            form_data = json.loads(json_text)
        except json.JSONDecodeError as e:
            logging.warning(f"[JSONDecodeError] Failed to parse JSON: {e}")
            form_data = None

    return {
        "report_text": answer,
        "form_data": form_data
    }

@app.route("/generate", methods=["POST"])
def handle_generate():
    data = request.get_json()
    obs = data.get("observation", "")


    if not obs:
        return jsonify({"error": "缺少 observation 欄位"}), 400

    result = generate_report(obs)
    return jsonify({"report": result})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)