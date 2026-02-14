import uuid
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

    def upload_file(self, file_obj, filename: str, content_type: str):
        unique_filename = f"{uuid.uuid4()}-{filename}"

        self.client.upload_fileobj(
            file_obj,
            settings.AWS_S3_BUCKET,
            unique_filename,
            ExtraArgs={"ContentType": content_type},
        )

        return self.generate_public_url(unique_filename)

    def generate_public_url(self, key: str):
        return f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"
