import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const s3 = new S3Client({
  endpoint: `https://${process.env.B2_ENDPOINT}`,
  region: 'us-east-005',
  credentials: {
    accessKeyId: process.env.B2_ACCOUNT_ID!,
    secretAccessKey: process.env.B2_APP_KEY!,
  },
  forcePathStyle: true,
})

const BUCKET = process.env.B2_BUCKET_NAME!

// Upload file to B2
export async function uploadToB2(
  key: string,
  content: string,
  contentType = 'text/plain'
): Promise<string> {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: content,
    ContentType: contentType,
  }))
  return key
}

// Generate signed URL (24h expiry)
export async function getSignedDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key })
  return getSignedUrl(s3, command, { expiresIn: 86400 }) // 24h
}

// Delete file from B2
export async function deleteFromB2(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }))
}

// Delete multiple files
export async function deleteFilesFromB2(keys: string[]): Promise<void> {
  await Promise.all(keys.map(key => deleteFromB2(key)))
}
