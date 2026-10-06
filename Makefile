.DEFAULT_GOAL := help

MAKEFLAGS += --no-print-directory

.PHONY: help install check test e2e dev build

help: ## Show available targets
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make <target>\n\nTargets:\n"} /^[a-zA-Z0-9_\-]+:.*##/ {printf "  %-18s %s\n", $$1, $$2} END {printf "\n"}' $(MAKEFILE_LIST)

install: ## Install npm deps via vp and Git hooks
	@vp i
	@vp config

check: ## Run vp check (lint + fmt + typecheck)
	@vp check

test: ## Run the Vitest suite
	@vp test

e2e: ## Run the e2e suite (needs Docker; builds Strapi, throwaway Postgres on :5447, app on :1347)
	@vp run test:e2e:ci

dev: ## Start Strapi develop (never vp dev)
	@vp run dev

build: ## Build the Strapi admin and server
	@vp run build
