# TaskFlow

نظام إدارة مهام احترافي (SaaS) مبني بـ **HTML5 + CSS3 + Vanilla JavaScript** في الواجهة، و**Python Flask** في الخادم، و**PostgreSQL** كقاعدة بيانات. يدعم العربية والإنجليزية (RTL/LTR) والوضعين الفاتح والداكن.

## المزايا

- تسجيل حساب، تسجيل دخول وخروج (جلسات آمنة، كلمات المرور مُجزّأة بـ Werkzeug).
- لوحة تحكم بإحصائيات حقيقية: الإجمالي، الحالات، الأولويات، المتأخرة، نسبة الإنجاز، المواعيد القادمة.
- إضافة وتعديل وحذف المهام مع الأولوية وتاريخ الإنجاز والحالة.
- المشاريع وربط المهام بها (حذف المشروع يحذف مهامه).
- البحث والتصفية (نص، حالة، أولوية، مشروع) والفرز.
- Kanban Board بالسحب والإفلات، ومع قائمة "نقل إلى" للهاتف.
- الملف الشخصي: الاسم، البريد، اللغة، المظهر، تغيير كلمة المرور.

## هيكل المشروع

```
taskflow/
├── backend/
│   ├── app/
│   │   ├── __init__.py      # create_app() + الترويسات الأمنية + /api/health
│   │   ├── config.py        # الإعدادات من متغيرات البيئة
│   │   ├── db.py            # طبقة الوصول للبيانات + أمر init-db
│   │   ├── auth.py          # login_required و json_body
│   │   ├── errors.py        # أخطاء API برموز ثابتة
│   │   └── routes/          # auth, tasks (+stats), projects, profile
│   ├── db/postgres.sql      # مخطط قاعدة البيانات (الإنتاج)
│   ├── db/sqlite.sql        # للاختبارات فقط
│   ├── tests/test_api.py
│   ├── requirements.txt
│   └── wsgi.py              # نقطة الدخول لـ gunicorn
├── frontend/
│   ├── index.html
│   ├── css/style.css
│   └── js/{app,api,i18n}.js
├── .env.example  .gitignore  Makefile  README.md
```

الواجهة مفصولة عن الخادم؛ في التطوير يخدمها Flask، ويمكن لاحقاً تقديمها عبر Nginx دون تغيير الكود (المسارات `/api/*` فقط للخادم).

## التشغيل على Ubuntu

### 1) المتطلبات

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip postgresql
```

### 2) إنشاء قاعدة البيانات

```bash
sudo -u postgres psql <<'SQL'
CREATE USER taskflow_user WITH PASSWORD 'ضع_كلمة_مرور_قوية_هنا';
CREATE DATABASE taskflow OWNER taskflow_user;
SQL
```

### 3) الإعداد والتشغيل

```bash
cp .env.example .env
python3 -c "import secrets; print(secrets.token_hex(32))"   # انسخ الناتج إلى SECRET_KEY في .env
nano .env                                                     # عدّل DATABASE_URL بكلمة المرور نفسها

make install
make init-db
make run
```

افتح http://127.0.0.1:5000

### 4) الاختبارات

```bash
make test
```

الاختبارات (13 اختباراً) تغطي المصادقة، المهام، المشاريع، الملف الشخصي، عزل بيانات المستخدمين، والإحصائيات. تعمل على SQLite مؤقتة، فلا تحتاج خادم PostgreSQL، وهذا مناسب لـ CI.

## واجهة API (مختصر)

| المسار | الوصف |
|---|---|
| `POST /api/auth/register` · `login` · `logout` · `GET /api/auth/me` | الحساب والجلسة |
| `GET/POST /api/tasks` · `GET/PUT/PATCH/DELETE /api/tasks/<id>` | المهام. المعاملات: `q, status, priority, project_id, sort` |
| `GET /api/stats` | إحصائيات لوحة التحكم |
| `GET/POST /api/projects` · `PUT/DELETE /api/projects/<id>` | المشاريع |
| `GET/PUT /api/profile` · `POST /api/profile/password` | الملف الشخصي |
| `GET /api/health` | فحص الصحة (للـ Docker و Load Balancer لاحقاً) |

الأخطاء تعود بصيغة `{"error": "code"}` والواجهة تترجم الرمز للغة المستخدم.

## الأمان

- لا أسرار في الكود: كل شيء من `.env` (غير مرفوع) و`.env.example` يحتوي قيماً توضيحية فقط.
- التطبيق يرفض الإقلاع إذا كان `SECRET_KEY` غير مضبوط أو بقيمة المثال.
- كل الاستعلامات مُعلَّمة (parameterized) ضد SQL Injection، والواجهة تهرّب كل نص قبل عرضه ضد XSS.
- ملفات تعريف الارتباط `HttpOnly` و`SameSite=Lax`، وCSP صارم، وكل مورد يُفحص ملكيته للمستخدم.
- عند النشر خلف HTTPS اضبط `SESSION_COOKIE_SECURE=true`.

قبل أول `git push`:

```bash
git init
git check-ignore -v .env      # يجب أن يظهر أنه مُتجاهَل
git status                    # تأكد أن .env غير موجود في القائمة
```

## خارطة DevOps (الخطوات التالية)

المشروع مُجهّز لهذه الخطوات دون تعديل الكود:

1. **Docker**: `Dockerfile` للخادم (`gunicorn --chdir backend wsgi:app`)، وتمرير `SECRET_KEY` و`DATABASE_URL` كمتغيرات بيئة. أمر `flask init-db` آمن للتكرار فيصلح كخطوة تهيئة.
2. **Docker Compose**: خدمتان (`web` و`db` بصورة `postgres`) مع volume للبيانات؛ استخدم `/api/health` لـ healthcheck.
3. **GitHub Actions**: workflow يثبّت `backend/requirements.txt` ويشغّل `cd backend && python -m unittest discover -s tests -t .`، ثم يبني صورة Docker.
4. **CD**: نشر الصورة على خادم Ubuntu خلف Nginx مع HTTPS (Let's Encrypt)، وأسرار GitHub بدل `.env`.
5. تحسينات لاحقة: ترحيلات قاعدة البيانات (Alembic)، تحديد معدل محاولات الدخول، اختبارات على PostgreSQL داخل CI.
