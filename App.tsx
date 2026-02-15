import React, { useState, useRef, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { analyzeVideoContent } from './services/geminiService';
import { AppStatus, AIAnalysisResult } from './types';

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const ffmpegRef = useRef<FFmpeg | null>(null);
  const ffmpegLoaded = useRef(false);

  const loadFFmpeg = async () => {
    if (ffmpegLoaded.current) return;

    try {
      setStatus(AppStatus.LOADING_FFMPEG);
      setErrorMsg(null);

      const ffmpeg = new FFmpeg();
      const baseURL =
        'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';

      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        workerURL: await toBlobURL(
          `${baseURL}/ffmpeg-core.worker.js`,
          'text/javascript'
        ),
      });

      ffmpegRef.current = ffmpeg;
      ffmpegLoaded.current = true;
      setStatus(AppStatus.IDLE);
    } catch (error: any) {
      console.error('FFmpeg Load Error:', error);
      setErrorMsg(
        `Fallo de carga: ${error.message || 'No se pudo cargar FFmpeg.'}`
      );
      setStatus(AppStatus.ERROR);
    }
  };

  useEffect(() => {
    loadFFmpeg();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 200 * 1024 * 1024) {
      setErrorMsg('Archivo demasiado grande. Límite 200MB.');
      setStatus(AppStatus.ERROR);
      return;
    }

    setVideoFile(file);
    setOutputUrl(null);
    setAiResult(null);
    setProgress(0);
    setErrorMsg(null);
    setStatus(AppStatus.IDLE);
  };

  const processVideo = async () => {
    if (!videoFile || !ffmpegRef.current) return;

    setStatus(AppStatus.PROCESSING);
    setProgress(5);

    const ffmpeg = ffmpegRef.current;
    const inputName = `input_${Date.now()}.mp4`;
    const outputName = `clean_${Date.now()}.mp4`;

    try {
      ffmpeg.on('progress', ({ progress }) => {
        setProgress(Math.min(progress * 100, 95));
      });

      await ffmpeg.writeFile(inputName, await fetchFile(videoFile));

      await ffmpeg.exec([
        '-i',
        inputName,
        '-map_metadata',
        '-1',
        '-c',
        'copy',
        '-movflags',
        '+faststart',
        outputName,
      ]);

      const data = await ffmpeg.readFile(outputName);

      const blob = new Blob([data as Uint8Array], {
        type: 'video/mp4',
      });

      const url = URL.createObjectURL(blob);
      setOutputUrl(url);
      setProgress(100);

      // Descarga automática segura
      const link = document.createElement('a');
      link.href = url;
      link.download = `limpio_${videoFile.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);

      setStatus(AppStatus.ANALYZING);
      const aiResponse = await analyzeVideoContent(videoFile.name);
      setAiResult(aiResponse);

      setStatus(AppStatus.COMPLETED);
    } catch (error) {
      console.error(error);
      setErrorMsg(
        'Error durante el procesamiento. El archivo podría estar dañado.'
      );
      setStatus(AppStatus.ERROR);
    }
  };

  const reset = () => {
    setVideoFile(null);
    setOutputUrl(null);
    setAiResult(null);
    setProgress(0);
    setStatus(AppStatus.IDLE);
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-10">
      <div className="max-w-xl w-full space-y-6 text-center">
        <h1 className="text-4xl font-bold">Metadata Purge</h1>

        {!videoFile && (
          <input type="file" accept="video/*" onChange={handleFileChange} />
        )}

        {videoFile && status === AppStatus.IDLE && (
          <button
            onClick={processVideo}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg"
          >
            PURGAR Y DESCARGAR
          </button>
        )}

        {(status === AppStatus.PROCESSING ||
          status === AppStatus.ANALYZING) && (
          <div>
            <p>Procesando...</p>
            <div className="w-full bg-gray-300 h-4 rounded-full">
              <div
                className="bg-blue-600 h-4 rounded-full"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}

        {status === AppStatus.COMPLETED && outputUrl && (
          <div>
            <p className="text-green-600 font-bold">
              ✔ Video limpiado correctamente
            </p>
            <button
              onClick={reset}
              className="mt-4 bg-gray-800 text-white px-4 py-2 rounded"
            >
              Otro video
            </button>
          </div>
        )}

        {status === AppStatus.ERROR && (
          <div className="text-red-600 font-bold">
            {errorMsg}
            <button
              onClick={() => {
                reset();
                loadFFmpeg();
              }}
              className="block mt-4 underline"
            >
              Reintentar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
