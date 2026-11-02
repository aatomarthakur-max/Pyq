from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File, Form
from fastapi.responses import Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from urllib.parse import quote
import os, uuid, logging, re, bcrypt, jwt, requests, asyncio

logger = logging.getLogger('server')
logging.basicConfig(level=logging.INFO)

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

app = FastAPI()
api = APIRouter(prefix='/api')

JWT_ALGORITHM = 'HS256'
MAX_PDF_BYTES = 30 * 1024 * 1024

STORAGE_BASE = (
    os.environ.get('INTEGRATION_PROXY_URL') or ''
).strip() or 'https://integrations.emergentagent.com'

STORAGE_URL = STORAGE_BASE.rstrip('/') + '/objstore/api/v1/storage'
APP_NAME = 'sarkari-pyq'
storage_key = None

DEFAULT_CATEGORIES = [
    ('teaching', 'Teaching Exams', 'शिक्षण परीक्षाएं', 'Graduation / B.Ed'),
    ('ssc', 'SSC Exams', 'एसएससी परीक्षाएं', '10+2 / Graduation'),
    ('upsc', 'UPSC & Civil Services', 'यूपीएससी और सिविल सेवा', 'Graduation'),
    ('state-civil', 'State Civil Services', 'राज्य सिविल सेवा', 'Graduation'),
    ('banking', 'Banking & Insurance', 'बैंकिंग और बीमा', 'Graduation'),
    ('railways', 'Railways (RRB)', 'रेलवे (आरआरबी)', '10th / 12th / Graduation'),
    ('defence', 'Defence & Police', 'रक्षा और पुलिस', '10th / 12th / Graduation'),
    ('school', 'Intermediate & Highschool', 'इंटरमीडिएट और हाईस्कूल', '10th / 12th'),
]

now_iso = lambda: datetime.now(timezone.utc).isoformat()


# ---------- STORAGE ----------

def init_storage(force: bool = False):
    global storage_key

    if storage_key and not force:
        return storage_key

    resp = requests.post(
        f'{STORAGE_URL}/init',
        json={'emergent_key': os.environ['EMERGENT_LLM_KEY']},
        timeout=30
    )

    resp.raise_for_status()
    storage_key = resp.json()['storage_key']

    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    resp = requests.put(
        f'{STORAGE_URL}/objects/{path}',
        headers={
            'X-Storage-Key': init_storage(),
            'Content-Type': content_type
        },
        data=data,
        timeout=180
    )

    if resp.status_code == 404:
        resp = requests.put(
            f'{STORAGE_URL}/objects/{path}',
            headers={
                'X-Storage-Key': init_storage(True),
                'Content-Type': content_type
            },
            data=data,
            timeout=180
        )

    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    resp = requests.get(
        f'{STORAGE_URL}/objects/{path}',
        headers={'X-Storage-Key': init_storage()},
        timeout=90
    )

    resp.raise_for_status()
    return resp.content


# ---------- AUTH ----------

def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def verify_password(p: str, h: str) -> bool:
    return bcrypt.checkpw(p.encode(), h.encode())


def create_token(user_id: str, email: str) -> str:
    payload = {
        'sub': user_id,
        'email': email,
        'type': 'access',
        'exp': datetime.now(timezone.utc) + timedelta(hours=12)
    }

    return jwt.encode(
        payload,
        os.environ['JWT_SECRET'],
        algorithm=JWT_ALGORITHM
    )


async def require_admin(request: Request) -> dict:
    header = request.headers.get('Authorization', '')
    token = header[7:] if header.startswith('Bearer ') else None

    if not token:
        raise HTTPException(401, 'Not authenticated')

    try:
        payload = jwt.decode(
            token,
            os.environ['JWT_SECRET'],
            algorithms=[JWT_ALGORITHM]
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, 'Session expired, please log in again')
    except jwt.InvalidTokenError:
        raise HTTPException(401, 'Invalid token')

    user = await db.users.find_one(
        {'id': payload.get('sub')},
        {'_id': 0, 'password_hash': 0}
    )

    if not user or user.get('role') != 'admin':
        raise HTTPException(403, 'Admin access required')

    return user


class LoginIn(BaseModel):
    email: str
    password: str


@api.post('/auth/login')
async def login(payload: LoginIn, request: Request):
    email = payload.email.strip().lower()

    ident = (
        f"{request.client.host if request.client else 'x'}:{email}"
    )

    attempt = await db.login_attempts.find_one(
        {'identifier': ident}
    )

    if (
        attempt
        and attempt.get('count', 0) >= 5
        and attempt.get('locked_until', '') > now_iso()
    ):
        raise HTTPException(
            429,
            'Too many failed attempts. Try again in 15 minutes.'
        )

    user = await db.users.find_one({'email': email})

    if not user or not verify_password(
        payload.password,
        user['password_hash']
    ):
        count = (attempt or {}).get('count', 0) + 1

        if (
            attempt
            and attempt.get('locked_until', '')
            and attempt['locked_until'] <= now_iso()
        ):
            count = 1

        await db.login_attempts.update_one(
            {'identifier': ident},
            {
                '$set': {
                    'count': count,
                    'locked_until': (
                        datetime.now(timezone.utc)
                        + timedelta(minutes=15)
                    ).isoformat()
                }
            },
            upsert=True
        )

        raise HTTPException(401, 'Invalid email or password')

    await db.login_attempts.delete_many(
        {'identifier': ident}
    )

    return {
        'token': create_token(user['id'], email),
        'user': {
            'id': user['id'],
            'email': email,
            'name': user.get('name'),
            'role': user['role']
        }
    }


@api.get('/auth/me')
async def me(user: dict = Depends(require_admin)):
    return user


# ---------- MODELS ----------

class Category(BaseModel):
    model_config = ConfigDict(extra='ignore')

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    slug: str
    name: str
    name_hi: str = ''
    eligibility: str = ''
    created_at: str = Field(default_factory=now_iso)


class CategoryIn(BaseModel):
    name: str
    name_hi: str = ''
    eligibility: str = ''


class Exam(BaseModel):
    model_config = ConfigDict(extra='ignore')

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    category_id: str
    name: str
    name_hi: str = ''
    description: str = ''
    about: str = ''
    about_hi: str = ''
    conducting_body: str = ''
    official_website: str = ''
    created_at: str = Field(default_factory=now_iso)


class ExamIn(BaseModel):
    category_id: str
    name: str
    name_hi: str = ''
    description: str = ''
    about: str = ''
    about_hi: str = ''
    conducting_body: str = ''
    official_website: str = ''


class Paper(BaseModel):
    model_config = ConfigDict(extra='ignore')

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    exam_id: str
    title: str
    year: int
    subject: str = 'General'
    language: str = 'English'
    about: str = ''
    file_path: str = ''
    file_name: str = ''
    file_size: int = 0
    official_url: str = ''
    created_at: str = Field(default_factory=now_iso)


class PaperUpdate(BaseModel):
    title: Optional[str] = None
    year: Optional[int] = None
    subject: Optional[str] = None
    language: Optional[str] = None
    about: Optional[str] = None


async def ensure_categories():
    if await db.categories.count_documents({}) == 0:
        await db.categories.insert_many([
            Category(
                slug=s,
                name=n,
                name_hi=h,
                eligibility=e
            ).model_dump()
            for s, n, h, e in DEFAULT_CATEGORIES
        ])


# ---------- HEALTH ----------

@api.get('/health')
async def health():
    return {'status': 'ok'}


# ---------- CATEGORIES ----------

@api.get('/categories', response_model=List[Category])
async def categories():
    await ensure_categories()

    return await db.categories.find(
        {},
        {'_id': 0}
    ).sort('name', 1).to_list(200)


@api.post('/categories', response_model=Category)
async def create_category(
    payload: CategoryIn,
    _=Depends(require_admin)
):
    obj = Category(
        slug=uuid.uuid4().hex[:8],
        **payload.model_dump()
    )

    await db.categories.insert_one(obj.model_dump())
    return obj


@api.put('/categories/{item_id}', response_model=Category)
async def update_category(
    item_id: str,
    payload: CategoryIn,
    _=Depends(require_admin)
):
    doc = await db.categories.find_one_and_update(
        {'id': item_id},
        {'$set': payload.model_dump()},
        projection={'_id': 0},
        return_document=True
    )

    if not doc:
        raise HTTPException(404, 'Category not found')

    return doc


@api.delete('/categories/{item_id}')
async def delete_category(
    item_id: str,
    _=Depends(require_admin)
):
    exam_ids = [
        e['id']
        async for e in db.exams.find(
            {'category_id': item_id},
            {'id': 1}
        )
    ]

    await db.papers.delete_many(
        {'exam_id': {'$in': exam_ids}}
    )

    await db.exams.delete_many(
        {'category_id': item_id}
    )

    await db.categories.delete_one({'id': item_id})

    return {'ok': True}


# ---------- EXAMS ----------

@api.get('/exams', response_model=List[Exam])
async def exams(category_id: Optional[str] = None):
    query = (
        {'category_id': category_id}
        if category_id else {}
    )

    return await db.exams.find(
        query,
        {'_id': 0}
    ).sort('name', 1).to_list(1000)


@api.get('/exams/{item_id}', response_model=Exam)
async def get_exam(item_id: str):
    doc = await db.exams.find_one(
        {'id': item_id},
        {'_id': 0}
    )

    if not doc:
        raise HTTPException(404, 'Exam not found')

    return doc


@api.post('/exams', response_model=Exam)
async def create_exam(
    payload: ExamIn,
    _=Depends(require_admin)
):
    obj = Exam(**payload.model_dump())

    await db.exams.insert_one(obj.model_dump())
    return obj


@api.put('/exams/{item_id}', response_model=Exam)
async def update_exam(
    item_id: str,
    payload: ExamIn,
    _=Depends(require_admin)
):
    doc = await db.exams.find_one_and_update(
        {'id': item_id},
        {'$set': payload.model_dump()},
        projection={'_id': 0},
        return_document=True
    )

    if not doc:
        raise HTTPException(404, 'Exam not found')

    return doc


@api.delete('/exams/{item_id}')
async def delete_exam(
    item_id: str,
    _=Depends(require_admin)
):
    await db.exams.delete_one({'id': item_id})
    await db.papers.delete_many({'exam_id': item_id})

    return {'ok': True}


# ---------- PAPERS ----------

@api.get('/papers', response_model=List[Paper])
async def papers(
    q: Optional[str] = None,
    exam_id: Optional[str] = None,
    year: Optional[int] = None
):
    query = {}

    if exam_id:
        query['exam_id'] = exam_id

    if year:
        query['year'] = year

    if q:
        rx = {
            '$regex': re.escape(q),
            '$options': 'i'
        }

        query['$or'] = [
            {'title': rx},
            {'subject': rx},
            {'about': rx}
        ]

    return await db.papers.find(
        query,
        {'_id': 0}
    ).sort('year', -1).to_list(2000)


@api.post('/papers', response_model=Paper)
async def create_paper(
    exam_id: str = Form(...),
    title: str = Form(...),
    year: int = Form(...),
    subject: str = Form('General'),
    language: str = Form('English'),
    about: str = Form(''),
    file: UploadFile = File(...),
    _=Depends(require_admin)
):
    if not await db.exams.find_one({'id': exam_id}):
        raise HTTPException(404, 'Exam not found')

    data = await file.read()

    if not data.startswith(b'%PDF'):
        raise HTTPException(400, 'Only PDF files are allowed')

    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(400, 'PDF must be under 30 MB')

    path = (
        f'{APP_NAME}/papers/{exam_id}/{uuid.uuid4()}.pdf'
    )

    try:
        result = await asyncio.to_thread(
            put_object,
            path,
            data,
            'application/pdf'
        )
    except Exception as e:
        logger.error(f'Upload failed: {e}')
        raise HTTPException(
            502,
            'File upload failed, please try again'
        )

    obj = Paper(
        exam_id=exam_id,
        title=title,
        year=year,
        subject=subject or 'General',
        language=language or 'English',
        about=about,
        file_path=result['path'],
        file_name=file.filename or 'paper.pdf',
        file_size=len(data)
    )

    await db.papers.insert_one(obj.model_dump())
    return obj


@api.put('/papers/{item_id}', response_model=Paper)
async def update_paper(
    item_id: str,
    payload: PaperUpdate,
    _=Depends(require_admin)
):
    changes = {
        k: v
        for k, v in payload.model_dump().items()
        if v is not None
    }

    doc = await db.papers.find_one_and_update(
        {'id': item_id},
        {'$set': changes},
        projection={'_id': 0},
        return_document=True
    )

    if not doc:
        raise HTTPException(404, 'Paper not found')

    return doc


@api.get('/papers/{item_id}/file')
async def paper_file(
    item_id: str,
    download: bool = False
):
    doc = await db.papers.find_one(
        {'id': item_id},
        {'_id': 0}
    )

    if not doc or not doc.get('file_path'):
        raise HTTPException(404, 'File not found')

    try:
        data = await asyncio.to_thread(
            get_object,
            doc['file_path']
        )
    except Exception as e:
        logger.error(f'Download failed: {e}')
        raise HTTPException(502, 'Could not fetch file')

    safe = re.sub(
        r'[^A-Za-z0-9._ -]+',
        '',
        f"{doc['title']} {doc['year']}"
    ).strip().replace(' ', '_') or 'paper'

    disp = 'attachment' if download else 'inline'

    return Response(
        content=data,
        media_type='application/pdf',
        headers={
            'Content-Disposition': (
                f"{disp}; filename=\"{safe}.pdf\"; "
                f"filename*=UTF-8''{quote(safe)}.pdf"
            )
        }
    )


@api.delete('/papers/{item_id}')
async def delete_paper(
    item_id: str,
    _=Depends(require_admin)
):
    await db.papers.delete_one({'id': item_id})
    return {'ok': True}


# ---------- APP CONFIGURATION ----------

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=os.environ.get(
        'CORS_ORIGINS',
        '*'
    ).split(','),
    allow_methods=['*'],
    allow_headers=['*']
)


# ---------- STARTUP ----------

@app.on_event('startup')
async def startup():
    await db.users.create_index('email', unique=True)
    await db.login_attempts.create_index('identifier')

    email = os.environ['ADMIN_EMAIL'].lower()

    if not await db.users.find_one({'email': email}):
        await db.users.insert_one({
            'id': str(uuid.uuid4()),
            'email': email,
            'password_hash': hash_password(
                os.environ['ADMIN_PASSWORD']
            ),
            'name': 'Admin',
            'role': 'admin',
            'created_at': now_iso()
        })

    try:
        await asyncio.to_thread(init_storage)
        logger.info('Storage initialized')
    except Exception as e:
        logger.error(f'Storage init failed: {e}')


@app.on_event('shutdown')
async def shutdown():
    client.close()
