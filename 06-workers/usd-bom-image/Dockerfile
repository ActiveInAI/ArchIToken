FROM python:3.12-slim

RUN pip install --no-cache-dir usd-core

COPY architoken_usd_to_bom.py /opt/

ENTRYPOINT ["python", "/opt/architoken_usd_to_bom.py"]
