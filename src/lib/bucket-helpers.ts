// S3 storage bucket helpers

export function getObjectURL(key: string) {
  return `https://${process.env.AWS_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}
