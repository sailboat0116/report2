from langchain.document_loaders import PyPDFLoader, UnstructuredWordDocumentLoader 
from langchain.text_splitter import CharacterTextSplitter
from langchain.vectorstores import FAISS
from langchain.embeddings import SentenceTransformerEmbeddings
from langchain.chains import ConversationalRetrievalChain
from langchain.memory import ConversationBufferMemory
from langchain.llms import Ollama
import glob
import json
import re
import logging

# 教科書 PDF
textbook_docs = PyPDFLoader("docs/mydoc.pdf").load()

# 就診建議 PDF（Lung-RADS）
lung_rads_docs = PyPDFLoader("docs/lung-rads-assessment-categories.pdf").load()

# 臨床觀察資料（.docx Word）
clinical_docs = [UnstructuredWordDocumentLoader(path).load() for path in glob.glob("data/*.docx")]

# 2. 分段處理
all_docs = sum([textbook_docs, lung_rads_docs] + clinical_docs, [])
splitter = CharacterTextSplitter(chunk_size=500, chunk_overlap=50)
split_docs = splitter.split_documents(all_docs)

# 3. 建立向量資料庫
embedding_model = SentenceTransformerEmbeddings(model_name="all-MiniLM-L6-v2")
db = FAISS.from_documents(split_docs, embedding_model)

# 4. 對話記憶
memory = ConversationBufferMemory(
    memory_key="chat_history",
    return_messages=True,
    output_key="answer"
)

llm = Ollama(model="deepseek-r1:7b")

qa_chain = ConversationalRetrievalChain.from_llm(
    llm=llm,
    retriever=db.as_retriever(search_kwargs={"k": 4}),
    memory=memory,
    return_source_documents=True,
    output_key="answer"
)
# 7. 問答介面
def generate_report_from_obs(obs: str) -> str:
    prompt = f"""
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
    "{obs}"
    """
    full_response = qa_chain.invoke({"question": prompt})["answer"]

    # 抽出 JSON 區塊
    json_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", full_response, re.DOTALL)

    if not json_match:
        json_match = re.search(r"(\{[\s\S]*?\})", full_response)

    form_data = None

    if json_match:
        json_text = json_match.group(1).strip()
        try:
            form_data = json.loads(json_text)
        except json.JSONDecodeError as e:
            logging.warning(f"[JSONDecodeError] Failed to parse JSON: {e}")
            form_data = None
    return {
        "report_text": full_response,
        "form_data": form_data
    }


from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route("/generate", methods=["POST"])
def generate():
    obs = request.json.get("observation", "")
    if not obs:
        return jsonify({"error": "未提供觀察內容"}), 400

    result = generate_report_from_obs(obs)
    return jsonify({
        "report": result["report_text"],
        "form_data": result["form_data"]
    })

if __name__ == "__main__":
     app.run(host="0.0.0.0", port=8000)

