from __future__ import annotations

import io
import zipfile

import boto3
from botocore.config import Config

from core.config import get_settings

settings = get_settings()

r2_client = boto3.client(
    "s3",
    endpoint_url=f"https://{settings.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
    aws_access_key_id=settings.CLOUDFLARE_R2_ACCESS_KEY,
    aws_secret_access_key=settings.CLOUDFLARE_R2_SECRET_KEY,
    config=Config(signature_version="s3v4"),
    region_name="auto",
)


async def upload_file(key: str, content: bytes, content_type: str) -> str:
    r2_client.put_object(
        Bucket=settings.CLOUDFLARE_R2_BUCKET,
        Key=key,
        Body=content,
        ContentType=content_type,
    )
    return f"{settings.CLOUDFLARE_R2_PUBLIC_URL}/{key}"


async def generate_presigned_url(key: str, expires_in: int = 3600) -> str:
    return r2_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.CLOUDFLARE_R2_BUCKET, "Key": key},
        ExpiresIn=expires_in,
    )


async def build_and_upload_delivery_zip(
    audit_id: str,
    fixed_files: list[dict[str, str]],
    screenshots: dict[str, bytes],
    report_pdf: bytes,
) -> str:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zipf:
        for file in fixed_files:
            zipf.writestr(file["filename"], file["content"])

        if screenshots.get("before"):
            zipf.writestr("screenshots/before.png", screenshots["before"])
        if screenshots.get("after"):
            zipf.writestr("screenshots/after.png", screenshots["after"])

        zipf.writestr("audit_report.pdf", report_pdf)
        zipf.writestr(
            "HOW_TO_UPLOAD.txt",
            "1. Download these files\n"
            "2. Upload them through cPanel or FTP\n"
            "3. Replace existing files with the same names\n"
            "4. Clear browser cache and re-check the website\n"
            "5. Reply to the audit email if you need implementation help.\n",
        )

    buffer.seek(0)
    key = f"deliveries/{audit_id}/package.zip"
    return await upload_file(key, buffer.read(), "application/zip")

