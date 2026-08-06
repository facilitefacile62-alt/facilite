import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, Integer, String, Table, MetaData
from sqlalchemy.orm import sessionmaker, declarative_base

# Load environment variables from .env, .env.local or local directory
root_path = Path(__file__).parent.parent
load_dotenv(dotenv_path=root_path / ".env")
load_dotenv(dotenv_path=root_path / ".env.local")
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

DATABASE_URL = os.getenv("SUPABASE_DATABASE_URL")
if not DATABASE_URL or "<username>" in DATABASE_URL:
    print("⚠️ WARNING: SUPABASE_DATABASE_URL non configuré ou incomplet. Renseignez votre chaîne de connexion Postgres pour synchroniser avec le cloud Supabase.")
    # Fallback SQLite temporaire pour éviter de faire crasher le serveur lors de tests locaux
    DATABASE_URL = "sqlite:///./local_test.db"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False}, echo=False, future=True)
else:
    engine = create_engine(DATABASE_URL, echo=False, future=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Example table mapping – you can extend as needed
class Establishment(Base):
    __tablename__ = "establishments"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, unique=True)
    address = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)

# Table des offres d'emploi classiques (créée côté Supabase)
class JobOffer(Base):
    __tablename__ = "job_offers"
    id = Column(String, primary_key=True, index=True) # UUID ou ID textuel
    title = Column(String, nullable=True)
    company = Column(String, nullable=True)
    location = Column(String, nullable=True)
    contract_type = Column(String, nullable=True)

def init_db():
    """Create tables if they don't exist"""
    Base.metadata.create_all(bind=engine)

def get_db():
    """Yield a DB session for FastAPI dependency injection"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
