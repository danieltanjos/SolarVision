FROM python:3.12-slim
WORKDIR /usr/src/app
RUN pip install --no-cache-dir psycopg2-binary
COPY . .
CMD ["python3", "inserirCSV.py"]
