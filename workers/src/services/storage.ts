import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { env } from "../config.js";

const client = new S3Client({
  endpoint: `https://${env.r2AccountId}.r2.cloudflarestorage.com`,
  region: "auto",
  credentials: {
    accessKeyId: env.r2AccessKey,
    secretAccessKey: env.r2SecretKey,
  },
});

export async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<string> {
  await client.send(
    new PutObjectCommand({
      Bucket: env.r2Bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return `${env.r2PublicUrl}/${key}`;
}
