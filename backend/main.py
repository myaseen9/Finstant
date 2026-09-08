from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
load_dotenv()
from api.auth_routes import router as auth_router
from api.admin_routes import router as admin_router
from api.chat_routes import router as chat_router
from api.user_routes import router as user_router
from query_engine.executor import get_app_engine
from sqlalchemy import text
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    model = os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-3-5-sonnet-20240620-v1:0")
    print("\n" + "="*50)
    print(" FINSTANT KNOWLEDGE ENGINE INITIALIZING... ")
    print(f" LLM MODEL ACTIVE: {model} via AWS Bedrock (IAM Role) ")
    print("="*50 + "\n")
    engine = get_app_engine()
    with engine.connect() as conn:
        try:
            schema_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "db_schemas", "app_schema.sql")
            with open(schema_path, "r", encoding="utf-8") as f:
                schema_sql = f.read()
            conn.execute(text(schema_sql))
        except Exception as e:
            print(f"Warning: Could not initialize app_schema.sql: {e}")
        conn.commit()

app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(chat_router)
app.include_router(user_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
