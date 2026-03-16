import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import prisma from '@/lib/prisma';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// POST /api/transcode — trigger background video transcoding
// After the optimized version is ready, updates the message's mediaUrl
export async function POST(req: Request) {
  try {
    const { filePath, mediaType, messageId } = await req.json();

    if (!filePath) {
      return NextResponse.json({ error: 'filePath is required' }, { status: 400 });
    }

    // Only transcode videos
    const isVideo = mediaType?.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(filePath);
    if (!isVideo) {
      return NextResponse.json({ skipped: true, reason: 'not a video' });
    }

    // Call Supabase Edge Function
    const edgeFnUrl = `${supabaseUrl}/functions/v1/transcode-video`;
    const response = await fetch(edgeFnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({ filePath, mediaType }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[transcode] Edge function error:', result);
      return NextResponse.json({ error: 'Transcoding failed', details: result }, { status: 500 });
    }

    // If transcoding succeeded and produced an optimized URL, update the message
    if (result.success && result.optimizedUrl && messageId) {
      await prisma.message.update({
        where: { id: messageId },
        data: { mediaUrl: result.optimizedUrl },
      });

      return NextResponse.json({
        success: true,
        optimizedUrl: result.optimizedUrl,
        savings: result.savings,
        updated: true,
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    console.error('[transcode] Error:', err);
    return NextResponse.json(
      { error: 'Internal error', details: (err as Error).message },
      { status: 500 }
    );
  }
}
