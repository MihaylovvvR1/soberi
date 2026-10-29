import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const ffmpeg = process.env.SOBERI_FFMPEG ?? resolve('.tools/ffmpeg/package/ffmpeg.exe')
const ffprobe = process.env.SOBERI_FFPROBE ?? resolve('.tools/ffprobe/package/ffprobe.exe')
const output = resolve('output/soberi-demo.mp4')
const recording = JSON.parse(await readFile('output/raw/recording.json', 'utf8'))
if (recording.inProgress || !recording.sourcePreserved || recording.errors?.length || recording.scenes?.length !== 6) throw Error('A complete successful recording is required before export')
const duration = recording.durationTarget
await mkdir('output/review', { recursive: true })
execFileSync(ffmpeg, ['-v', 'error', '-y', '-i', 'output/raw/soberi-demo.webm', '-an', '-t', String(duration), '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-movflags', '+faststart', output], { stdio: 'pipe' })
const metadata = JSON.parse(execFileSync(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', output], { encoding: 'utf8' }))
const video = metadata.streams.find(stream => stream.codec_type === 'video')
if (video.width !== 1920 || video.height !== 1080 || metadata.streams.some(stream => stream.codec_type === 'audio') || +metadata.format.duration < 35 || +metadata.format.duration > 45) throw Error('Video does not match delivery requirements')
execFileSync(ffmpeg, ['-v', 'error', '-i', output, '-map', '0:v:0', '-f', 'null', '-'], { stdio: 'pipe' })
const times = [0.5, 3, 6, 9, 12.5, 15.5, 19.5, 22, 26, 29.5, 33, 35.5, 38.8, 41.5, 44]
for (const second of times) execFileSync(ffmpeg, ['-v', 'error', '-y', '-ss', String(second), '-i', output, '-frames:v', '1', `output/review/${String(second).replace('.', '-')}.png`], { stdio: 'pipe' })
const report = { file: output, duration: +metadata.format.duration, width: video.width, height: video.height, codec: video.codec_name, pixelFormat: video.pix_fmt, fps: video.avg_frame_rate, frames: +video.nb_frames, audioTracks: metadata.streams.filter(stream => stream.codec_type === 'audio').length, bytes: +metadata.format.size, fullDecodePassed: true, sourcePreserved: recording.sourcePreserved, checkedFrames: times, scenes: recording.scenes }
await writeFile('output/verification.json', JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
