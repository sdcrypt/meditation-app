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

    def generate_public_url(self, bucket: str, key: str):
        return f"https://{bucket}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"
