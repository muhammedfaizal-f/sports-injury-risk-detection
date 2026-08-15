import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routers import auth, athletes, videos, risk, dashboard, reports, invites, users, organizations

os.makedirs("uploads/avatars", exist_ok=True)

app = FastAPI(title="Sports Injury Risk Detection API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(athletes.router)
app.include_router(videos.router)
app.include_router(risk.router)
app.include_router(dashboard.router)
app.include_router(reports.router)
app.include_router(invites.router)
app.include_router(organizations.router)


@app.get("/")
def read_root():
    return {"message": "Sports Injury Risk Detection API is running"}


@app.get("/health")
def health_check():
    return {"status": "ok"}