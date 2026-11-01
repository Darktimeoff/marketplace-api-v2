#!/bin/sh
set -eu

mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$(cat /run/secrets/minio_root_password)"

mc mb --ignore-existing "local/$STORAGE_BUCKET"
mc anonymous set none "local/$STORAGE_BUCKET"

cat > /tmp/media-policy.json <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:AbortMultipartUpload", "s3:ListMultipartUploadParts"],
      "Resource": ["arn:aws:s3:::$STORAGE_BUCKET/*"]
    },
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket", "s3:ListBucketMultipartUploads"],
      "Resource": ["arn:aws:s3:::$STORAGE_BUCKET"]
    }
  ]
}
POLICY

mc admin user add local "$STORAGE_ACCESS_KEY" "$(cat /run/secrets/storage_secret_key)"
mc admin policy create local media-app /tmp/media-policy.json
mc admin policy attach local media-app --user "$STORAGE_ACCESS_KEY" || true

mc admin config set local api stale_uploads_expiry=168h

touch /tmp/ready
exec sleep infinity
