import { FFmpeg } from '@ffmpeg/ffmpeg'
import { toBlobURL } from '@ffmpeg/util'

let ffmpeg: FFmpeg | null = null

export const loadFFmpeg = async () => {
  if (ffmpeg) return ffmpeg

  ffmpeg = new FFmpeg()

  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'

  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
  })

  return ffmpeg
}

export const limpiarMetadatos = async (file: File) => {
  const ffmpeg = await loadFFmpeg()

  const inputName = 'input.mp4'
  const outputName = 'output.mp4'

  await ffmpeg.writeFile(inputName, await file.arrayBuffer())

  await ffmpeg.exec([
    '-i', inputName,
    '-map_metadata', '-1',
    '-c', 'copy',
    outputName
  ])

  const data = await ffmpeg.readFile(outputName)

  return new Blob([data], { type: 'video/mp4' })
}
