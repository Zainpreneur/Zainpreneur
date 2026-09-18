@echo off
set DATABASE_URL=postgresql://zainpreneur:zainpreneur_dev@localhost:5432/zainpreneur
set JWT_SECRET=dev-jwt-secret-at-least-32-chars-long!
set NODE_ENV=development
set PORT=3000
set HOST=0.0.0.0
set CORS_ORIGIN=http://localhost:5900
set LOG_LEVEL=info
set JWT_EXPIRES_IN=7d
cd /d "%~dp0"
pnpm --filter @zainpreneur/web dev
