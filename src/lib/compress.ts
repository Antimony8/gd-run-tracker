/** Videos are scaled down so their shorter side is at most this many pixels (720p). */
const MAX_SHORT_SIDE = 720

export interface CompressResult {
  file: File
  /** False when compression was skipped (unsupported here, or it wouldn't have made the file smaller). */
  compressed: boolean
}

/**
 * Re-encodes a video as a smaller H.264/AAC MP4 (at most 720p) in the browser, using the device's
 * own video encoder. Falls back to the original file whenever that isn't possible.
 */
export async function compressVideo(file: File, onProgress?: (fraction: number) => void): Promise<CompressResult> {
  const original = { file, compressed: false }
  if (typeof VideoEncoder === 'undefined') return original

  // Loaded on demand so the app itself stays small.
  const mb = await import('mediabunny')
  if (!(await mb.canEncodeVideo('avc'))) return original

  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS })
  const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new mb.BufferTarget() })
  const canAac = await mb.canEncodeAudio('aac')

  try {
    const conversion = await mb.Conversion.init({
      input,
      output,
      tracks: 'primary',
      video: (track) => {
        const short = Math.min(track.displayWidth, track.displayHeight)
        const scale = short > MAX_SHORT_SIDE ? MAX_SHORT_SIDE / short : 1
        return {
          codec: 'avc',
          bitrate: mb.QUALITY_MEDIUM,
          // Even dimensions keep H.264 encoders happy.
          width: Math.round((track.displayWidth * scale) / 2) * 2,
          height: Math.round((track.displayHeight * scale) / 2) * 2,
          fit: 'fill',
        }
      },
      // Keep the sound when it can be re-encoded; otherwise drop it rather than fail.
      audio: canAac ? { codec: 'aac', bitrate: mb.QUALITY_MEDIUM } : { discard: true },
    })
    if (!conversion.isValid) return original
    conversion.onProgress = (p) => onProgress?.(p)
    await conversion.execute()

    const buffer = (output.target as InstanceType<typeof mb.BufferTarget>).buffer
    if (!buffer || buffer.byteLength >= file.size) return original
    const name = file.name.replace(/\.[^.]+$/, '') + '.mp4'
    return { file: new File([buffer], name, { type: 'video/mp4' }), compressed: true }
  } catch {
    return original
  } finally {
    input.dispose?.()
  }
}
