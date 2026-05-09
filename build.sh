#!/bin/bash
set -e

# Install Python deps
cd backend
python3 -m venv venv
venv/bin/pip install -r requirements.txt

# Build frontend
cd ../frontend
npm install
npm run build
