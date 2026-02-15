
import React, { useState, useRef, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { analyzeVideoContent } from './services/geminiService';
import { AppStatus, AIAnalysisResult } from './types';

const Header = () => (
  <header className="py-8 text-center animate-in fade-in duration-1000">
    <h1 className="text-5xl font-extrabold mb-4 tracking-tight">
      <span className="gradient-text">Limpiador de Metadatos Pro</span>
    </h1>
    <p className="text-gray-400 text-lg max-w-2xl mx-auto px-4 leading-relaxed">
      Convierte tus videos en archivos "vírgenes" para los algoritmos. Borra rastros de edición, ubicación y dispositivo.
    </p>
  </header>
);

const ProgressBar = ({ progress, label }: { progress: number; label: string }) => (
  <div className="w-full mt-6">
    <div className="flex justify-between mb-2 text-sm font-medium">
      <span className="text-blue-400 animate-pulse">{label}</span>
      <span className="text-slate-400">{Math.round(progress)}%</span>
    </div>
    <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
      <div 
        className="bg-blue-500 h-2.5 transition-all duration-300 ease-out shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
        style={{ width: `${progress}%` }}
      ></div>
    </div>
  </div>
);

const App: React.FC = () => {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const ffmpegRef = useRef<FFmpeg | null>(null);

  const loadFFmpeg = async () => {
    if (ffmpegRef.current && ffmpegRef.current.loaded) {
      setStatus(AppStatus.IDLE);
      return;
    }
    
    setStatus(AppStatus.LOADING_FFMPEG);
    setErrorMsg(null);
    
    try {
      const ffmpeg = new FFmpeg();
      
      ffmpeg.on('log', ({ message }: { message: string }) => {
        console.debug("FFmpeg Log:", message);
      });

      // Cambiamos a jsDelivr para mayor estabilidad de red y mejores cabeceras CORS
      const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
      
      console.log("Iniciando carga de FFmpeg desde jsDelivr...");
      
      // Cargamos cada recurso individualmente con toBlobURL para asegurar que el Worker 
      // se cree desde un origen local y no infrinja políticas de seguridad.
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
      });
      
      ffmpegRef.current = ffmpeg;
      console.log("Motor FFmpeg cargado exitosamente.");
      setStatus(AppStatus.IDLE);
    } catch (error: any) {
      console.error("Error al cargar FFmpeg:", error);
      
      let friendlyError = "No se pudo cargar el procesador de video.";
      
      // Error de fetch suele ser bloqueo de red, CORS o falta de headers COOP/COEP
      if (error.message?.toLowerCase().includes('fetch')) {
        friendlyError = "Fallo de conexión: El navegador no pudo descargar los archivos necesarios. Esto puede ocurrir por bloqueadores de anuncios (uBlock/AdBlock) o restricciones del servidor de hosting (headers COOP/COEP faltantes).";
      } else {
        friendlyError = `Fallo técnico: ${error.message || "Error interno del motor"}.`;
      }
      
      setErrorMsg(friendlyError);
      setStatus(AppStatus.ERROR);
    }
  };

  useEffect(() => {
    loadFFmpeg();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 200 * 1024 * 1024) {
        setErrorMsg("Archivo demasiado grande. El límite es de 200MB para evitar colapsar la memoria del navegador.");
        setStatus(AppStatus.ERROR);
        return;
      }
      setVideoFile(file);
      setOutputUrl(null);
      setAiResult(null);
      setProgress(0);
      setErrorMsg(null);
      setStatus(AppStatus.IDLE);
    }
  };

  const processVideo = async () => {
    if (!videoFile || !ffmpegRef.current) return;

    if (!ffmpegRef.current.loaded) {
      await loadFFmpeg();
      if (!ffmpegRef.current?.loaded) return;
    }

    setStatus(AppStatus.PROCESSING);
    const ffmpeg = ffmpegRef.current;

    const inputName = `input_${Date.now()}.mp4`;
    const outputName = `clean_${Date.now()}.mp4`;

    try {
      ffmpeg.on('progress', ({ progress }: { progress: number }) => {
        setProgress(progress * 100);
      });

      await ffmpeg.writeFile(inputName, await fetchFile(videoFile));

      // -map_metadata -1: Elimina absolutamente todos los metadatos globales y de flujo
      // -c copy: Copia los flujos de audio y video sin re-codificar (máxima calidad y velocidad)
      // -movflags +faststart: Coloca el índice al principio para carga rápida en web
      const result = await ffmpeg.exec([
        '-i', inputName,
        '-map_metadata', '-1',
        '-c', 'copy',
        '-movflags', '+faststart',
        outputName
      ]);

      if (result !== 0) throw new Error("El proceso de limpieza fue interrumpido inesperadamente.");

      const data = await ffmpeg.readFile(outputName);
      const url = URL.createObjectURL(new Blob([(data as Uint8Array).buffer], { type: 'video/mp4' }));
      setOutputUrl(url);

      // Limpieza proactiva de la memoria virtual WASM
      try {
        await ffmpeg.deleteFile(inputName);
        await ffmpeg.deleteFile(outputName);
      } catch (e) {}

      setStatus(AppStatus.ANALYZING);
      const aiResponse = await analyzeVideoContent(videoFile.name);
      setAiResult(aiResponse);

      setStatus(AppStatus.COMPLETED);
    } catch (error: any) {
      console.error("Error de procesamiento:", error);
      setErrorMsg("No se pudo procesar el video. Asegúrate de que no esté protegido por DRM o en un formato muy inusual.");
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
    <div className="min-h-screen pb-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      <Header />

      <main className="space-y-8">
        <section className="glass-panel rounded-3xl p-8 shadow-2xl border-white/5 relative overflow-hidden">
          {status === AppStatus.LOADING_FFMPEG && (
            <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-2xl z-30 flex flex-col items-center justify-center text-center px-4">
              <div className="relative mb-8">
                <div className="w-20 h-20 border-4 border-blue-500/10 rounded-full"></div>
                <div className="w-20 h-20 border-4 border-blue-500 border-t-transparent rounded-full animate-spin absolute inset-0 shadow-[0_0_20px_rgba(59,130,246,0.3)]"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="w-8 h-8 text-blue-500 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-white font-black text-2xl uppercase tracking-[0.2em]">Cargando Procesadores</h3>
              <p className="text-slate-400 text-sm mt-3 max-w-xs leading-relaxed font-medium">
                Descargando motor de limpieza local... <br/>
                <span className="text-blue-500/70">Asegurando entorno de privacidad.</span>
              </p>
            </div>
          )}

          <div className="flex flex-col items-center justify-center space-y-6">
            {!videoFile && status !== AppStatus.ERROR && (
              <label className="w-full flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-[2.5rem] h-80 cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-6 relative z-10">
                  <div className="bg-slate-800 p-6 rounded-3xl mb-5 group-hover:bg-blue-600 group-hover:scale-110 transition-all duration-500 shadow-2xl border border-white/5">
                    <svg className="w-12 h-12 text-slate-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <h4 className="mb-2 text-3xl font-black text-white uppercase tracking-tight">Sube tu Contenido</h4>
                  <p className="text-slate-500 text-sm font-bold tracking-wide">MP4 • MOV • AVI • HASTA 200MB</p>
                </div>
                <input type="file" className="hidden" accept="video/*" onChange={handleFileChange} />
              </label>
            )}

            {videoFile && status !== AppStatus.COMPLETED && status !== AppStatus.ERROR && (
              <div className="w-full space-y-6 animate-in slide-in-from-top-6 duration-500">
                <div className="flex items-center justify-between p-6 bg-slate-800/60 rounded-3xl border border-white/10 shadow-lg backdrop-blur-sm">
                  <div className="flex items-center space-x-5">
                    <div className="bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20">
                      <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2-2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="overflow-hidden">
                      <p className="font-black text-slate-100 text-xl truncate max-w-[180px] sm:max-w-md">{videoFile.name}</p>
                      <p className="text-sm text-blue-400 font-mono font-bold">{(videoFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button onClick={reset} className="text-slate-500 hover:text-red-500 p-3 hover:bg-red-500/10 rounded-2xl transition-all">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {status === AppStatus.IDLE && (
                  <button
                    onClick={processVideo}
                    className="w-full py-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-2xl rounded-3xl transition-all shadow-[0_15px_40px_rgba(37,99,235,0.4)] active:scale-[0.97] transform hover:-translate-y-1"
                  >
                    INICIAR LIMPIEZA PROFUNDA
                  </button>
                )}

                {(status === AppStatus.PROCESSING || status === AppStatus.ANALYZING) && (
                  <div className="bg-slate-800/30 p-8 rounded-[2rem] border border-white/5 shadow-inner">
                    <ProgressBar 
                      progress={progress || (status === AppStatus.ANALYZING ? 95 : 5)} 
                      label={
                        status === AppStatus.PROCESSING ? "Eliminando huellas del dispositivo y GPS..." : 
                        "Gemini AI analizando potencial viral..."
                      } 
                    />
                  </div>
                )}
              </div>
            )}
            
            {status === AppStatus.COMPLETED && outputUrl && (
              <div className="w-full space-y-8 animate-in zoom-in-95 duration-700">
                <div className="bg-green-500/10 border border-green-500/20 p-8 rounded-[2.5rem] flex items-center space-x-6 shadow-[0_0_50px_rgba(34,197,94,0.15)] relative overflow-hidden group">
                  <div className="absolute inset-0 bg-green-500/5 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out"></div>
                  <div className="bg-green-500 rounded-2xl p-3 shadow-[0_0_25px_rgba(34,197,94,0.5)] relative z-10">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="relative z-10">
                    <h4 className="text-green-400 font-black text-2xl uppercase tracking-tight">¡Video Purificado!</h4>
                    <p className="text-green-400/80 text-sm mt-1 font-bold">Todo rastro de edición y origen ha sido borrado.</p>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-5">
                  <a
                    href={outputUrl}
                    download={`limpio_${videoFile?.name || 'video'}`}
                    className="flex-[2] py-6 bg-gradient-to-r from-blue-600 to-blue-500 text-white font-black text-2xl rounded-3xl text-center transition-all shadow-2xl shadow-blue-900/40 hover:scale-[1.02] active:scale-95"
                  >
                    DESCARGAR VIDEO
                  </a>
                  <button
                    onClick={reset}
                    className="flex-1 py-6 bg-slate-800 hover:bg-slate-700 text-slate-300 font-black rounded-3xl transition-all border border-white/10"
                  >
                    PROCESAR OTRO
                  </button>
                </div>
              </div>
            )}

            {status === AppStatus.ERROR && (
               <div className="w-full p-8 bg-red-500/10 border border-red-500/30 rounded-[2.5rem] animate-in shake-x duration-500 shadow-2xl">
                  <div className="flex items-center gap-5 mb-6">
                    <div className="bg-red-500/20 p-4 rounded-2xl border border-red-500/30 shadow-lg">
                      <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    </div>
                    <h5 className="text-red-400 font-black text-2xl uppercase tracking-tighter">Fallo Crítico</h5>
                  </div>
                  <div className="bg-red-500/5 p-6 rounded-3xl border border-red-500/10 mb-8 shadow-inner">
                    <p className="text-red-400 text-base leading-relaxed font-bold">
                      {errorMsg}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button 
                      onClick={() => { reset(); loadFFmpeg(); }} 
                      className="py-5 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-black rounded-2xl transition-all border border-red-500/40 shadow-lg active:scale-95"
                    >
                      REINTENTAR CARGA
                    </button>
                    <button 
                      onClick={reset} 
                      className="py-5 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold rounded-2xl transition-all border border-white/5 active:scale-95"
                    >
                      VOLVER ATRÁS
                    </button>
                  </div>
               </div>
            )}
          </div>
        </section>

        {aiResult && status === AppStatus.COMPLETED && (
          <section className="animate-in fade-in slide-in-from-bottom-16 duration-1000 space-y-10">
            <h2 className="text-4xl font-black flex items-center gap-5">
              <span className="p-4 bg-purple-500/20 rounded-3xl border border-purple-500/20 shadow-[0_0_30px_rgba(168,85,247,0.2)]">
                <svg className="w-10 h-10 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
              </span>
              Estrategia Viral Gemini
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="glass-panel p-10 rounded-[3rem] border-white/10 group hover:border-blue-500/30 transition-all duration-500 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                  <svg className="w-24 h-24 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                </div>
                <h3 className="text-blue-500 text-sm font-black uppercase tracking-[0.4em] mb-6 flex items-center gap-3">
                  <span className="w-3 h-3 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(59,130,246,1)]"></span>
                  Título Magnético
                </h3>
                <p className="text-4xl font-black text-white leading-tight mb-12 tracking-tight group-hover:text-blue-100 transition-colors">"{aiResult.suggestedTitle}"</p>
                
                <h3 className="text-purple-500 text-sm font-black uppercase tracking-[0.4em] mb-6">Hashtags Estratégicos</h3>
                <div className="flex flex-wrap gap-4">
                  {aiResult.suggestedHashtags.map((tag, i) => (
                    <span key={i} className="px-6 py-3 bg-slate-800/80 text-purple-300 rounded-2xl text-base font-black border border-white/10 hover:bg-purple-600 hover:text-white transition-all cursor-default shadow-md transform hover:-translate-y-1">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="glass-panel p-10 rounded-[3rem] border-white/10 group hover:border-green-500/30 transition-all duration-500 shadow-2xl">
                <h3 className="text-green-500 text-sm font-black uppercase tracking-[0.4em] mb-10 flex items-center gap-3">
                  <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,1)]"></span>
                  Protocolo de Retención
                </h3>
                <ul className="space-y-8">
                  {aiResult.optimizationTips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-6 group/item transform transition-all hover:translate-x-2">
                      <span className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 text-blue-400 flex items-center justify-center text-xl font-black border border-white/10 group-hover/item:from-blue-600 group-hover/item:to-indigo-600 group-hover/item:text-white transition-all duration-300 shadow-lg">
                        {i + 1}
                      </span>
                      <p className="text-slate-200 text-xl font-bold leading-tight pt-1 group-hover/item:text-white transition-colors">{tip}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="mt-32 pt-12 border-t border-slate-800/50 text-center relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>
        <p className="text-slate-600 text-[11px] font-black tracking-[0.4em] uppercase">
          Engineered for Privacy • Gemini Flash 3 • jsDelivr CDN • Local WASM
        </p>
      </footer>
    </div>
  );
};

export default App;
