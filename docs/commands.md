# Commands / 命令 — HackTravel

## Bootstrap / 初始化

### 后端
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 前端
```bash
cd frontend
npm install
```

## Dev / 开发

### 后端（本地开发）
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 前端（Expo 开发）
```bash
cd frontend
npx expo start
```

### Docker Compose（全局启动）
```bash
docker-compose up --build
```

## Test / 测试

### 后端
```bash
cd backend && pytest -v --tb=short
```

### 前端
```bash
cd frontend && npx jest --runInBand
```

## Lint / 代码检查

### 后端
```bash
cd backend && ruff check .
```

### 前端
```bash
cd frontend && npx tsc --noEmit
```

## Format / 格式化

### 后端
```bash
cd backend && ruff format .
```

## Typecheck / 类型检查

### 后端
```bash
cd backend && mypy app tests
```

### 前端
```bash
cd frontend && npx tsc --noEmit
```

## Build / 构建

### 后端（Docker）
```bash
docker build -t hacktravel-backend ./backend
```

### 前端（Web 导出）
```bash
cd frontend && npx expo export:web
```

## Quality Gate / 质量门控

提交代码前的最低要求。

### 后端
```bash
cd backend && ruff check . && ruff format --check . && pytest -v --tb=short
```

### 前端
```bash
cd frontend && npx tsc --noEmit && npx jest --runInBand
```

## Production / 生产

### Docker Compose 生产
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Caddy 反向代理
Caddyfile 已配置自动 HTTPS，见项目根目录 `Caddyfile`。
