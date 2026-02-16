# F3 Fitness Logo as Base64 encoded PNG
# This is used for embedding in PDF invoices

F3_LOGO_BASE64 = """PYTHON_START
cat /tmp/logo_b64.txt >> /app/backend/logo_base64.py
echo '"""' >> /app/backend/logo_base64.py

# Verify the file
python3 -c "import sys; sys.path.insert(0, '/app/backend'); from logo_base64 import F3_LOGO_BASE64; print('Logo base64 length:', len(F3_LOGO_BASE64))"
