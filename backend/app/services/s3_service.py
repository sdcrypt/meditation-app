import uuid
from pathlib import PurePath
from urllib.parse import quote

import boto3
from app.core.config import settings


class S3Service:
    def __init__(self):
        self.client = boto3.client(
            "s3",
            aws_access_key_id=settings.AWS_ACCESS_KEY,
            aws_secret_access_key=settings.AWS_SECRET_KEY,
            region_name=settings.AWS_REGION,
        )

    def upload_file(
        self,
        file_obj,
        filename: str,
        content_type: str,
        prefix: str = "",
    ):
        safe_filename = PurePath(filename.replace("\\", "/")).name
        unique_filename = f"{uuid.uuid4()}-{safe_filename}"
        key = f"{prefix.strip('/')}/{unique_filename}" if prefix else unique_filename

        self.client.upload_fileobj(
            file_obj,
            settings.AWS_S3_BUCKET,
            key,
            ExtraArgs={
                "ContentType": content_type,
                "ContentDisposition": "inline",
            },
        )

        return self.generate_public_url(key)

    def generate_public_url(self, key: str):
        encoded_key = quote(key, safe="/")
        return (
            f"https://{settings.AWS_S3_BUCKET}.s3."
            f"{settings.AWS_REGION}.amazonaws.com/{encoded_key}"
        )
