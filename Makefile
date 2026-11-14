# Run from the project root (Ubuntu/Linux).
VENV := .venv
PY := $(VENV)/bin/python

.PHONY: venv install init-db run test

venv:
	python3 -m venv $(VENV)

install: venv
	$(PY) -m pip install -r backend/requirements.txt

init-db:
	cd backend && ../$(PY) -m flask --app wsgi init-db

run:
	cd backend && ../$(PY) -m flask --app wsgi run --debug

test:
	cd backend && ../$(PY) -m unittest discover -s tests -t . -v
