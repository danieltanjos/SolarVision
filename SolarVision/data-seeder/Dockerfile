FROM python:3.9-slim
WORKDIR /usr/src/app
RUN pip install pandas psycopg2-binary
COPY . .
CMD ["python3", "inserirCSV.py"]