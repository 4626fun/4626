import { getSupabaseAdmin } from './supabaseAdmin.js'

declare const process: { env: Record<string, string | undefined> }

const DEFAULT_IMAGE_STORAGE_BUCKET = 'image-generation'

export function getImageStorageBucket(): string {
  const bucket = (process.env.SUPABASE_IMAGE_BUCKET ?? DEFAULT_IMAGE_STORAGE_BUCKET).trim()
  if (!bucket) throw new Error('SUPABASE_IMAGE_BUCKET is not configured')
  return bucket
}

export async function uploadImageStorageObject(params: {
  pathname: string
  bytes: Uint8Array
  contentType: string
  cacheControlMaxAgeSeconds?: number
}): Promise<{ url: string }> {
  const supabase = getSupabaseAdmin()
  const bucket = getImageStorageBucket()

  const { error } = await supabase.storage.from(bucket).upload(params.pathname, params.bytes, {
    upsert: true,
    contentType: params.contentType,
    cacheControl: String(params.cacheControlMaxAgeSeconds ?? 60 * 60 * 24 * 365),
  })
  if (error) {
    throw new Error(`supabase_storage_upload_failed(${error.message})`)
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(params.pathname)
  const url = typeof data?.publicUrl === 'string' ? data.publicUrl : ''
  if (!url) throw new Error('supabase_storage_public_url_missing')
  return { url }
}

export async function downloadImageStorageObject(pathname: string): Promise<{ bytes: Uint8Array; contentType: string | null }> {
  const supabase = getSupabaseAdmin()
  const bucket = getImageStorageBucket()
  const { data, error } = await supabase.storage.from(bucket).download(pathname)
  if (error || !data) {
    throw new Error(`supabase_storage_download_failed(${error?.message ?? 'missing_blob'})`)
  }

  const bytes = new Uint8Array(await data.arrayBuffer())
  const contentType = typeof data.type === 'string' && data.type.trim().length > 0 ? data.type.trim() : null
  return { bytes, contentType }
}
