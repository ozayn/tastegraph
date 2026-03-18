from fastapi import FastAPI

app = FastAPI(title="TasteGraph API")


@app.get("/")
def root():
    return {"message": "TasteGraph API", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
