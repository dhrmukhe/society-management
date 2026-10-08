import os
from datetime import datetime,timedelta,date
from typing import Optional
from fastapi import FastAPI,Depends,HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer,OAuth2PasswordRequestForm
from jose import JWTError,jwt
from passlib.context import CryptContext
from pydantic import BaseModel,EmailStr
from sqlalchemy import create_engine,String,Integer,Numeric,Date,DateTime,Text,ForeignKey,func
from sqlalchemy.orm import DeclarativeBase,Mapped,mapped_column,relationship,sessionmaker,Session

DATABASE_URL=os.getenv("DATABASE_URL","sqlite:///./society.db")
JWT_SECRET=os.getenv("JWT_SECRET","dev-secret")
ALGORITHM="HS256"

engine=create_engine(DATABASE_URL,pool_pre_ping=True)
SessionLocal=sessionmaker(bind=engine,autoflush=False,autocommit=False)

class Base(DeclarativeBase): pass

class User(Base):
    __tablename__="users"
    id:Mapped[int]=mapped_column(primary_key=True)
    email:Mapped[str]=mapped_column(String(255),unique=True,index=True)
    password_hash:Mapped[str]=mapped_column(String(255))
    role:Mapped[str]=mapped_column(String(30),default="admin")

class Member(Base):
    __tablename__="members"
    id:Mapped[int]=mapped_column(primary_key=True)
    flat_no:Mapped[str]=mapped_column(String(30),unique=True,index=True)
    name:Mapped[str]=mapped_column(String(120))
    phone:Mapped[str]=mapped_column(String(30),default="")
    email:Mapped[str]=mapped_column(String(255),default="")
    resident_type:Mapped[str]=mapped_column(String(20),default="Owner")
    parking:Mapped[str]=mapped_column(String(50),default="")

class Maintenance(Base):
    __tablename__="maintenance"
    id:Mapped[int]=mapped_column(primary_key=True)
    member_id:Mapped[int]=mapped_column(ForeignKey("members.id"))
    month:Mapped[str]=mapped_column(String(7))
    amount:Mapped[float]=mapped_column(Numeric(12,2))
    status:Mapped[str]=mapped_column(String(20),default="PENDING")
    paid_at:Mapped[Optional[date]]=mapped_column(Date,nullable=True)
    member=relationship("Member")

class Expense(Base):
    __tablename__="expenses"
    id:Mapped[int]=mapped_column(primary_key=True)
    category:Mapped[str]=mapped_column(String(80))
    description:Mapped[str]=mapped_column(String(255))
    amount:Mapped[float]=mapped_column(Numeric(12,2))
    expense_date:Mapped[date]=mapped_column(Date,default=date.today)

class Complaint(Base):
    __tablename__="complaints"
    id:Mapped[int]=mapped_column(primary_key=True)
    member_id:Mapped[Optional[int]]=mapped_column(ForeignKey("members.id"),nullable=True)
    title:Mapped[str]=mapped_column(String(150))
    description:Mapped[str]=mapped_column(Text)
    status:Mapped[str]=mapped_column(String(30),default="OPEN")
    created_at:Mapped[datetime]=mapped_column(DateTime,default=datetime.utcnow)
    member=relationship("Member")

class Notice(Base):
    __tablename__="notices"
    id:Mapped[int]=mapped_column(primary_key=True)
    title:Mapped[str]=mapped_column(String(150))
    content:Mapped[str]=mapped_column(Text)
    created_at:Mapped[datetime]=mapped_column(DateTime,default=datetime.utcnow)

Base.metadata.create_all(engine)

pwd=CryptContext(schemes=["bcrypt"],deprecated="auto")
oauth2_scheme=OAuth2PasswordBearer(tokenUrl="/api/auth/login")
app=FastAPI(title="Small Society Management API",version="1.0.0")
app.add_middleware(CORSMiddleware,allow_origins=["*"],allow_credentials=True,allow_methods=["*"],allow_headers=["*"])

def db():
    s=SessionLocal()
    try: yield s
    finally: s.close()

def seed(s:Session):
    email=os.getenv("ADMIN_EMAIL","admin@society.local")
    if not s.query(User).filter_by(email=email).first():
        s.add(User(email=email,password_hash=pwd.hash(os.getenv("ADMIN_PASSWORD","admin123")),role="admin"))
    if s.query(Member).count()==0:
        members=[
            Member(flat_no="A-101",name="Rahul Sharma",phone="9876543210",email="rahul@example.com",parking="P-01"),
            Member(flat_no="A-102",name="Anita Das",phone="9876543211",email="anita@example.com",parking="P-02"),
            Member(flat_no="B-201",name="Sourav Roy",phone="9876543212",email="sourav@example.com",parking="P-03")
        ]
        s.add_all(members);s.flush()
        for m in members:
            s.add(Maintenance(member_id=m.id,month="2026-10",amount=2500,status="PENDING"))
        s.add(Expense(category="Security",description="Monthly security service",amount=12000,expense_date=date.today()))
        s.add(Notice(title="Monthly Meeting",content="Society meeting on the first Sunday at 11 AM."))
    s.commit()

with SessionLocal() as s: seed(s)

class Token(BaseModel):
    access_token:str
    token_type:str

class MemberIn(BaseModel):
    flat_no:str
    name:str
    phone:str=""
    email:str=""
    resident_type:str="Owner"
    parking:str=""

class MaintenanceIn(BaseModel):
    member_id:int
    month:str
    amount:float

class ExpenseIn(BaseModel):
    category:str
    description:str
    amount:float
    expense_date:date

class ComplaintIn(BaseModel):
    member_id:Optional[int]=None
    title:str
    description:str
    status:str="OPEN"

class ComplaintUpdate(BaseModel):
    member_id:Optional[int]=None
    title:Optional[str]=None
    description:Optional[str]=None
    status:Optional[str]=None

class NoticeIn(BaseModel):
    title:str
    content:str

def current_user(token:str=Depends(oauth2_scheme),s:Session=Depends(db)):
    try:
        data=jwt.decode(token,JWT_SECRET,algorithms=[ALGORITHM])
        email=data.get("sub")
    except JWTError:
        raise HTTPException(401,"Invalid token")
    u=s.query(User).filter_by(email=email).first()
    if not u: raise HTTPException(401,"User not found")
    return u

@app.get("/api/health")
def health(): return {"status":"ok"}

@app.post("/api/auth/login",response_model=Token)
def login(form:OAuth2PasswordRequestForm=Depends(),s:Session=Depends(db)):
    u=s.query(User).filter_by(email=form.username).first()
    if not u or not pwd.verify(form.password,u.password_hash):
        raise HTTPException(401,"Invalid email or password")
    token=jwt.encode({"sub":u.email,"exp":datetime.utcnow()+timedelta(hours=8)},JWT_SECRET,algorithm=ALGORITHM)
    return {"access_token":token,"token_type":"bearer"}

@app.get("/api/me")
def me(u=Depends(current_user)):
    return {"email":u.email,"role":u.role}

@app.get("/api/dashboard")
def dashboard(s:Session=Depends(db),u=Depends(current_user)):
    total=s.query(func.coalesce(func.sum(Maintenance.amount),0)).scalar() or 0
    collected=s.query(func.coalesce(func.sum(Maintenance.amount),0)).filter(Maintenance.status=="PAID").scalar() or 0
    pending=total-collected
    expenses=s.query(func.coalesce(func.sum(Expense.amount),0)).scalar() or 0
    return {"members":s.query(Member).count(),"maintenance_total":float(total),"collected":float(collected),"pending":float(pending),"expenses":float(expenses),"open_complaints":s.query(Complaint).filter(Complaint.status!="RESOLVED").count()}

# MEMBERS
@app.get("/api/members")
def members(s:Session=Depends(db),u=Depends(current_user)):
    return s.query(Member).order_by(Member.flat_no).all()

@app.post("/api/members")
def add_member(x:MemberIn,s:Session=Depends(db),u=Depends(current_user)):
    if s.query(Member).filter_by(flat_no=x.flat_no).first():
        raise HTTPException(400,"Flat already exists")
    m=Member(**x.model_dump())
    s.add(m);s.commit();s.refresh(m)
    return m

@app.put("/api/members/{id}")
def update_member(id:int,x:MemberIn,s:Session=Depends(db),u=Depends(current_user)):
    m=s.get(Member,id)
    if not m: raise HTTPException(404,"Member not found")
    duplicate=s.query(Member).filter(Member.flat_no==x.flat_no,Member.id!=id).first()
    if duplicate: raise HTTPException(400,"Flat already exists")
    for k,v in x.model_dump().items(): setattr(m,k,v)
    s.commit();s.refresh(m)
    return m

@app.delete("/api/members/{id}")
def delete_member(id:int,s:Session=Depends(db),u=Depends(current_user)):
    m=s.get(Member,id)
    if not m: raise HTTPException(404,"Member not found")
    if s.query(Maintenance).filter_by(member_id=id).first():
        raise HTTPException(400,"Cannot delete member because maintenance records exist")
    if s.query(Complaint).filter_by(member_id=id).first():
        raise HTTPException(400,"Cannot delete member because complaint records exist")
    s.delete(m);s.commit()
    return {"message":"deleted"}

# MAINTENANCE
@app.get("/api/maintenance")
def maintenance(s:Session=Depends(db),u=Depends(current_user)):
    return [{"id":m.id,"member_id":m.member_id,"flat_no":m.member.flat_no,"name":m.member.name,"month":m.month,"amount":float(m.amount),"status":m.status,"paid_at":m.paid_at} for m in s.query(Maintenance).order_by(Maintenance.month.desc()).all()]

@app.post("/api/maintenance")
def add_maintenance(x:MaintenanceIn,s:Session=Depends(db),u=Depends(current_user)):
    if not s.get(Member,x.member_id): raise HTTPException(404,"Member not found")
    m=Maintenance(**x.model_dump())
    s.add(m);s.commit();s.refresh(m)
    return m

@app.put("/api/maintenance/{id}")
def update_maintenance(id:int,x:MaintenanceIn,s:Session=Depends(db),u=Depends(current_user)):
    m=s.get(Maintenance,id)
    if not m: raise HTTPException(404,"Maintenance record not found")
    if not s.get(Member,x.member_id): raise HTTPException(404,"Member not found")
    m.member_id=x.member_id;m.month=x.month;m.amount=x.amount
    s.commit();s.refresh(m)
    return m

@app.delete("/api/maintenance/{id}")
def delete_maintenance(id:int,s:Session=Depends(db),u=Depends(current_user)):
    m=s.get(Maintenance,id)
    if not m: raise HTTPException(404,"Maintenance record not found")
    s.delete(m);s.commit()
    return {"message":"deleted"}

@app.post("/api/maintenance/{id}/pay")
def pay(id:int,s:Session=Depends(db),u=Depends(current_user)):
    m=s.get(Maintenance,id)
    if not m: raise HTTPException(404,"Maintenance record not found")
    m.status="PAID";m.paid_at=date.today()
    s.commit()
    return {"message":"marked paid"}

# EXPENSES
@app.get("/api/expenses")
def expenses(s:Session=Depends(db),u=Depends(current_user)):
    return s.query(Expense).order_by(Expense.expense_date.desc()).all()

@app.post("/api/expenses")
def add_expense(x:ExpenseIn,s:Session=Depends(db),u=Depends(current_user)):
    e=Expense(**x.model_dump())
    s.add(e);s.commit();s.refresh(e)
    return e

@app.put("/api/expenses/{id}")
def update_expense(id:int,x:ExpenseIn,s:Session=Depends(db),u=Depends(current_user)):
    e=s.get(Expense,id)
    if not e: raise HTTPException(404,"Expense not found")
    for k,v in x.model_dump().items(): setattr(e,k,v)
    s.commit();s.refresh(e)
    return e

@app.delete("/api/expenses/{id}")
def delete_expense(id:int,s:Session=Depends(db),u=Depends(current_user)):
    e=s.get(Expense,id)
    if not e: raise HTTPException(404,"Expense not found")
    s.delete(e);s.commit()
    return {"message":"deleted"}

# COMPLAINTS
@app.get("/api/complaints")
def complaints(s:Session=Depends(db),u=Depends(current_user)):
    return [{"id":c.id,"member_id":c.member_id,"flat_no":c.member.flat_no if c.member else "-","title":c.title,"description":c.description,"status":c.status,"created_at":c.created_at} for c in s.query(Complaint).order_by(Complaint.created_at.desc()).all()]

@app.post("/api/complaints")
def add_complaint(x:ComplaintIn,s:Session=Depends(db),u=Depends(current_user)):
    if x.member_id and not s.get(Member,x.member_id): raise HTTPException(404,"Member not found")
    c=Complaint(**x.model_dump())
    s.add(c);s.commit();s.refresh(c)
    return c

@app.patch("/api/complaints/{id}")
def update_complaint(id:int,x:ComplaintUpdate,s:Session=Depends(db),u=Depends(current_user)):
    c=s.get(Complaint,id)
    if not c: raise HTTPException(404,"Complaint not found")
    for k,v in x.model_dump(exclude_unset=True).items():
        if k=="member_id" and v and not s.get(Member,v): raise HTTPException(404,"Member not found")
        setattr(c,k,v)
    s.commit()
    return {"message":"updated"}

@app.delete("/api/complaints/{id}")
def delete_complaint(id:int,s:Session=Depends(db),u=Depends(current_user)):
    c=s.get(Complaint,id)
    if not c: raise HTTPException(404,"Complaint not found")
    s.delete(c);s.commit()
    return {"message":"deleted"}

# NOTICES
@app.get("/api/notices")
def notices(s:Session=Depends(db),u=Depends(current_user)):
    return s.query(Notice).order_by(Notice.created_at.desc()).all()

@app.post("/api/notices")
def add_notice(x:NoticeIn,s:Session=Depends(db),u=Depends(current_user)):
    n=Notice(**x.model_dump())
    s.add(n);s.commit();s.refresh(n)
    return n

@app.put("/api/notices/{id}")
def update_notice(id:int,x:NoticeIn,s:Session=Depends(db),u=Depends(current_user)):
    n=s.get(Notice,id)
    if not n: raise HTTPException(404,"Notice not found")
    n.title=x.title;n.content=x.content
    s.commit();s.refresh(n)
    return n

@app.delete("/api/notices/{id}")
def delete_notice(id:int,s:Session=Depends(db),u=Depends(current_user)):
    n=s.get(Notice,id)
    if not n: raise HTTPException(404,"Notice not found")
    s.delete(n);s.commit()
    return {"message":"deleted"}