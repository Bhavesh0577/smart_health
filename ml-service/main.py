import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="PHC Resilience Grid - ML & Optimization Service",
    description="Federated learning, demand forecasting, anomaly detection, and OR-Tools supply redistribution",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str

@app.get("/health", response_model=HealthResponse)
def health_check():
    return {
        "status": "healthy",
        "service": "PHC Resilience Grid ML Engine",
        "version": "1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=True)
