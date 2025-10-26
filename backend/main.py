from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import parse_router, ics_router

app = FastAPI(title="syllaCal API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev-friendly; tighten later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(parse_router.router, prefix="/api")
app.include_router(ics_router.router, prefix="/api")
