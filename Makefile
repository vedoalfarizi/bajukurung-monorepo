.PHONY: install dev test test-frontend test-backend build deploy deploy-staging deploy-production synth diff lint

# ── Dependencies ──────────────────────────────────────────────────────────────

install:
	npm install

# ── Development ───────────────────────────────────────────────────────────────

dev:
	cd frontend && npm run dev

# ── Testing ───────────────────────────────────────────────────────────────────

test: test-frontend test-backend

test-frontend:
	cd frontend && npx vitest run

test-backend:
	cd backend && npx vitest run

# ── Linting ───────────────────────────────────────────────────────────────────

lint:
	cd frontend && npm run lint
	cd backend && npm run lint

# ── Build ─────────────────────────────────────────────────────────────────────

build:
	cd frontend && npm run build
	cd backend && npm run build

# ── Infrastructure ────────────────────────────────────────────────────────────

synth:
	cd infra && npx cdk synth

diff:
	cd infra && npx cdk diff

# ── Deployment ────────────────────────────────────────────────────────────────

deploy: deploy-staging

deploy-staging:
	cd infra && npx cdk deploy --all --context env=staging

deploy-production:
	cd infra && npx cdk deploy --all --context env=production
