// Supabase Edge Function: transcode-video
// Downloads an uploaded video from Supabase Storage, transcodes it to a smaller
// H.264 MP4 using FFmpeg WASM, and uploads the optimized version alongside the original.
// The caller receives the optimized URL to update the database record.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BUCKET = 'lift-videos'
const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB - skip transcoding for larger files
const OPTIMIZED_SUFFIX = '-optimized'

serve(async (req: Request) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    const { filePath, mediaType } = await req.json()

    if (!filePath) {
      return new Response(JSON.stringify({ error: 'filePath is required' }), {
        status: 400,
        headers,
      })
    }

    // Only transcode video types
    const isVideo = mediaType?.startsWith('video/') || filePath.match(/\.(mp4|mov|webm)$/i)
    if (!isVideo) {
      return new Response(JSON.stringify({ skipped: true, reason: 'not a video' }), {
        status: 200,
        headers,
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Download original video
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(BUCKET)
      .download(filePath)

    if (downloadError || !fileData) {
      return new Response(
        JSON.stringify({ error: 'Failed to download original', details: downloadError?.message }),
        { status: 500, headers }
      )
    }

    const originalSize = fileData.size
    if (originalSize > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'file too large for transcoding', size: originalSize }),
        { status: 200, headers }
      )
    }

    // Use FFmpeg via subprocess (Deno supports running commands)
    // Write original to temp file, transcode, read output
    const tempDir = await Deno.makeTempDir()
    const inputPath = `${tempDir}/input`
    const outputPath = `${tempDir}/output.mp4`

    const inputBytes = new Uint8Array(await fileData.arrayBuffer())
    await Deno.writeFile(inputPath, inputBytes)

    // Transcode: H.264 CRF 28 (good quality, ~60-70% smaller), AAC audio, fast preset
    // Scale down to max 720p if larger, preserve aspect ratio
    const ffmpeg = new Deno.Command('ffmpeg', {
      args: [
        '-i', inputPath,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '28',
        '-vf', 'scale=min(iw\\,1280):min(ih\\,720):force_original_aspect_ratio=decrease',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart', // Enable progressive playback
        '-y',
        outputPath,
      ],
      stdout: 'piped',
      stderr: 'piped',
    })

    const process = ffmpeg.spawn()
    const { code, stderr } = await process.output()

    if (code !== 0) {
      const errText = new TextDecoder().decode(stderr)
      // Clean up temp files
      try { await Deno.remove(tempDir, { recursive: true }) } catch {}
      return new Response(
        JSON.stringify({ error: 'FFmpeg transcoding failed', details: errText.slice(-500) }),
        { status: 500, headers }
      )
    }

    // Read transcoded file
    const optimizedBytes = await Deno.readFile(outputPath)
    const optimizedSize = optimizedBytes.length

    // Only use optimized version if it's actually smaller
    if (optimizedSize >= originalSize) {
      try { await Deno.remove(tempDir, { recursive: true }) } catch {}
      return new Response(
        JSON.stringify({ skipped: true, reason: 'optimized not smaller', originalSize, optimizedSize }),
        { status: 200, headers }
      )
    }

    // Upload optimized version alongside original
    const ext = filePath.match(/\.[^.]+$/)?.[0] || '.mp4'
    const optimizedPath = filePath.replace(ext, `${OPTIMIZED_SUFFIX}.mp4`)

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(optimizedPath, optimizedBytes, {
        contentType: 'video/mp4',
        cacheControl: '604800',
        upsert: true,
      })

    // Clean up temp files
    try { await Deno.remove(tempDir, { recursive: true }) } catch {}

    if (uploadError) {
      return new Response(
        JSON.stringify({ error: 'Failed to upload optimized version', details: uploadError.message }),
        { status: 500, headers }
      )
    }

    // Get public URL for optimized version
    const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(optimizedPath)

    const savings = Math.round((1 - optimizedSize / originalSize) * 100)

    return new Response(
      JSON.stringify({
        success: true,
        optimizedUrl: publicUrlData.publicUrl,
        optimizedPath,
        originalSize,
        optimizedSize,
        savings: `${savings}%`,
      }),
      { status: 200, headers }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Unexpected error', details: (err as Error).message }),
      { status: 500, headers }
    )
  }
})
