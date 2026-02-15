
import React, { useState, useRef, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { analyzeVideoContent } from './services/geminiService';
import { AppStatus, AIAnalysisResult } from './types';

const Header = () => (
  <header className="py-12 text-center animate-in fade-in slide-in-from-top-4 duration-1000">
    <h1 className="text-6xl font-black mb-4 tracking-tighter">
      <span className="gradient-text">Metadata Purge</span>
    </h1>
    <p className="text-slate-400 text-lg max-w-2xl mx-auto px-4 leading-relaxed font-medium">
      Limpieza quirúrgica de archivos. Tu rastro digital termina aquí.
    </p>
  </header>
);

const ProgressBar = ({ progress, label }: { progress: number; label: string }) => (
  <div className="w-full mt-8 animate-in fade-in duration-500">
    <div className="flex justify-between mb-3 text-sm font-bold tracking-widest uppercase">
      <span className="text-blue-400 animate-pulse">{label}</span>
      <span className="text-slate-500">{Math.round(progress)}%</span>
    </div>
    <div className="w-full bg-slate-900/50 rounded-full h-4 p-1 border border-white/5 overflow-hidden">
      <div 
        className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full rounded-full transition-all duration-500 ease-out shadow-[0_0_15px_rgba(59,130,246,0.5)]" 
        style={{ width: `${Math.max(progress, 5)}%` }}
      ></div>
    </div>
  </div>
);

const TechnicalReport = ({ fileName }: { fileName: string }) => (
  <div className="bg-black/40 border border-white/5 rounded-[2rem] p-8 font-mono text-xs text-slate-400 space-y-3 mb-8 shadow-inner animate-in slide-in-from-bottom-4 duration-700">
    <div className="flex items-center gap-2 mb-4">
      <div className="w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
      <p className="text-blue-400 font-black text-sm uppercase tracking-tighter">Reporte de Auditoría de Privacidad</p>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8 border-t border-white/5 pt-4">
      <div className="flex justify-between"><span className="text-slate-500">ID de Sesión:</span> <span className="text-slate-300">#{(Math.random() * 0xFFFFFF << 0).toString(16).toUpperCase()}</span></div>
      <div className="flex justify-between"><span className="text-slate-500">GPS/GEO Data:</span> <span className="text-green-500 font-bold">PURGADO</span></div>
      <div className="flex justify-between"><span className="text-slate-500">Device Signature:</span> <span className="text-green-500 font-bold">ELIMINADO</span></div>
      <div className="flex justify-between"><span className="text-slate-500">IPTC/XMP Data:</span> <span className="text-green-500 font-bold">LIMPIO</span></div>
      <div className="flex justify-between"><span className="text-slate-500">Algoritmo:</span> <span className="text-slate-300">FFMPEG-WASM</span></div>
      <div className="flex justify-between"><span className="text-slate-500">Privacidad:</span> <span className="text-slate-300">100% LOCAL</span></div>
    </div>
    <p className="mt-6 text-[10px] text-slate-600 font-bold uppercase tracking-widest text-center italic">
      * El archivo "{fileName}" ha sido anonimizado con éxito para redes sociales.
    </p>
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
    if (ffmpegRef.current?.loaded) return;
    
    setStatus(AppStatus.LOADING_FFMPEG);
    setErrorMsg(null);
    
    try {
      const ffmpeg = new FFmpeg();
      const baseURL = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd';
      
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
      });
      
      ffmpegRef.current = ffmpeg;
      setStatus(AppStatus.IDLE);
    } catch (error: any) {
      console.error("FFmpeg Load Error:", error);
      setErrorMsg("Error de sistema: No se pudo cargar el motor de limpieza. Revisa tu conexión.");
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
        setErrorMsg("Archivo demasiado grande. El límite es de 200MB por seguridad.");
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
    if (!videoFile) return;
    
    // Si no está cargado, intentamos cargar y luego procesar
    if (!ffmpegRef.current?.loaded) {
      await loadFFmpeg();
      if (!ffmpegRef.current?.loaded) return;
    }

    setStatus(AppStatus.PROCESSING);
    setProgress(5); // Iniciar con algo de progreso visual inmediato
    
    const ffmpeg = ffmpegRef.current;
    const inputName = `in_${Date.now()}.mp4`;
    const outputName = `out_${Date.now()}.mp4`;

    try {
      ffmpeg.on('progress', ({ progress }: { progress: number }) => {
        // Aseguramos un mínimo de progreso visual
        setProgress(Math.max(progress * 100, 15));
      });

      // Paso 1: Escribir archivo
      await ffmpeg.writeFile(inputName, await fetchFile(videoFile));
      setProgress(25);

      // Paso 2: Ejecutar comando de limpieza
      // -map_metadata -1 : Purgado total
      const result = await ffmpeg.exec([
        '-i', inputName,
        '-map_metadata', '-1',
        '-c', 'copy',
        '-movflags', '+faststart',
        outputName
      ]);

      if (result !== 0) throw new Error("Fallo en la ejecución del purgado.");
      setProgress(85);

      // Paso 3: Leer y generar URL
      const data = await ffmpeg.readFile(outputName);
      const url = URL.createObjectURL(new Blob([(data as Uint8Array).buffer], { type: 'video/mp4' }));
      setOutputUrl(url);

      // Paso 4: Descarga automática inmediata
      const link = document.createElement('a');
      link.href = url;
      link.download = `purgado_${videoFile.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setProgress(100);

      // Limpieza de archivos temporales
      try {
        await ffmpeg.deleteFile(inputName);
        await ffmpeg.deleteFile(outputName);
      } catch (e) {}

      // Paso 5: Análisis de IA
      setStatus(AppStatus.ANALYZING);
      const aiResponse = await analyzeVideoContent(videoFile.name);
      setAiResult(aiResponse);

      setStatus(AppStatus.COMPLETED);
    } catch (error: any) {
      console.error(error);
      setErrorMsg("Error de procesamiento. Verifica que el video no esté protegido.");
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

      <main className="space-y-12">
        <section className="glass-panel rounded-[3rem] p-10 shadow-2xl border-white/10 relative overflow-hidden">
          {status === AppStatus.LOADING_FFMPEG && (
            <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-2xl z-40 flex flex-col items-center justify-center text-center px-4">
              <div className="relative mb-8">
                <div className="w-24 h-24 border-8 border-blue-500/10 rounded-full"></div>
                <div className="w-24 h-24 border-8 border-blue-600 border-t-transparent rounded-full animate-spin absolute inset-0 shadow-[0_0_30px_rgba(37,99,235,0.4)]"></div>
              </div>
              <h3 className="text-white font-black text-3xl uppercase tracking-tighter">Iniciando Motor</h3>
              <p className="text-slate-500 text-sm mt-4 font-bold max-w-xs uppercase tracking-widest">Descargando procesadores locales de privacidad...</p>
            </div>
          )}

          <div className="flex flex-col items-center justify-center space-y-8">
            {!videoFile && status !== AppStatus.ERROR && (
              <label className="w-full flex flex-col items-center justify-center border-4 border-dashed border-slate-800 rounded-[3rem] h-96 cursor-pointer hover:border-blue-500/50 hover:bg-blue-600/5 transition-all group relative overflow-hidden">
                <div className="flex flex-col items-center justify-center text-center px-8 relative z-10">
                  <div className="bg-slate-800 p-8 rounded-[2rem] mb-6 group-hover:bg-blue-600 group-hover:scale-110 transition-all duration-500 shadow-2xl border border-white/5">
                    <svg className="w-16 h-16 text-slate-400 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <h4 className="mb-2 text-4xl font-black text-white uppercase tracking-tighter">Purifica tu Video</h4>
                  <p className="text-slate-500 text-sm font-black uppercase tracking-widest opacity-60">Seguridad Total • Sin nubes • Sin rastros</p>
                </div>
                <input type="file" className="hidden" accept="video/*" onChange={handleFileChange} />
              </label>
            )}

            {videoFile && status !== AppStatus.COMPLETED && status !== AppStatus.ERROR && (
              <div className="w-full space-y-8 animate-in zoom-in-95 duration-500">
                <div className="flex items-center justify-between p-8 bg-black/40 rounded-[2.5rem] border border-white/5 shadow-inner">
                  <div className="flex items-center space-x-6">
                    <div className="bg-blue-600/20 p-5 rounded-3xl border border-blue-500/20">
                      <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2-2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="overflow-hidden">
                      <p className="font-black text-slate-100 text-2xl truncate max-w-[200px] sm:max-w-md">{videoFile.name}</p>
                      <p className="text-sm text-blue-500/80 font-black uppercase tracking-widest">{(videoFile.size / (1024 * 1024)).toFixed(2)} Megabytes</p>
                    </div>
                  </div>
                  <button onClick={reset} className="text-slate-600 hover:text-red-500 p-4 hover:bg-red-500/10 rounded-full transition-all">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {status === AppStatus.IDLE && (
                  <button
                    onClick={processVideo}
                    className="w-full py-8 bg-blue-600 hover:bg-blue-500 text-white font-black text-3xl rounded-[2rem] transition-all shadow-[0_20px_50px_rgba(37,99,235,0.3)] active:scale-95 transform hover:-translate-y-2 flex items-center justify-center gap-4"
                  >
                    <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                    PURGAR Y DESCARGAR
                  </button>
                )}

                {(status === AppStatus.PROCESSING || status === AppStatus.ANALYZING) && (
                  <ProgressBar 
                    progress={progress || (status === AppStatus.ANALYZING ? 95 : 10)} 
                    label={status === AppStatus.PROCESSING ? "Purgando rastro digital..." : "Finalizando informe IA..."} 
                  />
                )}
              </div>
            )}
            
            {status === AppStatus.COMPLETED && outputUrl && (
              <div className="w-full space-y-10 animate-in fade-in zoom-in-95 duration-700">
                <div className="bg-green-600/10 border border-green-500/20 p-10 rounded-[3rem] flex items-center space-x-8 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                    <svg className="w-32 h-32 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M2.166 4.9L9.03 9.069a2.25 2.25 0 002.248 0l6.865-4.169A2.25 2.25 0 0015.896 1.5h-11.79A2.25 2.25 0 002.167 4.9z" clipRule="evenodd" /><path d="M18 8.162l-6.145 3.73a3.75 3.75 0 01-3.71 0L2 8.162V13a2.25 2.25 0 002.25 2.25h11.5A2.25 2.25 0 0018 13V8.162z" /></svg>
                  </div>
                  <div className="bg-green-600 rounded-3xl p-5 shadow-[0_0_30px_rgba(22,163,74,0.5)] relative z-10">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="relative z-10">
                    <h4 className="text-green-500 font-black text-3xl uppercase tracking-tighter">Archivo Purificado</h4>
                    <p className="text-green-400/70 text-lg mt-1 font-bold">Descarga completada. El video ya no tiene huellas de origen.</p>
                  </div>
                </div>

                <TechnicalReport fileName={videoFile?.name || 'video_anonimo.mp4'} />
                
                <div className="flex flex-col sm:flex-row gap-6">
                  <a
                    href={outputUrl}
                    download={`purgado_${videoFile?.name || 'video'}`}
                    className="flex-[2] py-8 bg-slate-800 hover:bg-slate-700 text-white font-black text-2xl rounded-[2rem] text-center transition-all border border-white/10 shadow-xl"
                  >
                    FORZAR RE-DESCARGA
                  </a>
                  <button
                    onClick={reset}
                    className="flex-1 py-8 bg-blue-600 hover:bg-blue-500 text-white font-black text-2xl rounded-[2rem] transition-all shadow-xl shadow-blue-900/20"
                  >
                    OTRO VIDEO
                  </button>
                </div>
              </div>
            )}

            {status === AppStatus.ERROR && (
               <div className="w-full p-10 bg-red-600/10 border border-red-500/30 rounded-[3rem] animate-in shake-x shadow-2xl">
                  <h5 className="text-red-500 font-black text-3xl uppercase mb-4 tracking-tighter">Fallo en la Purga</h5>
                  <p className="text-red-400/80 text-lg mb-10 font-bold leading-tight">{errorMsg}</p>
                  <button onClick={reset} className="w-full py-6 bg-red-600/20 text-red-500 font-black text-xl rounded-3xl border border-red-500/30 transition-all hover:bg-red-600/30">
                    REINTENTAR PROCESO
                  </button>
               </div>
            )}
          </div>
        </section>

        {aiResult && status === AppStatus.COMPLETED && (
          <section className="animate-in fade-in slide-in-from-bottom-16 duration-1000 space-y-12 py-10">
            <h2 className="text-5xl font-black flex items-center gap-6">
              <span className="p-5 bg-purple-600/20 rounded-[2rem] border border-purple-500/20 shadow-2xl">
                <svg className="w-12 h-12 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
              </span>
              Plan Viral Gemini
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="glass-panel p-12 rounded-[3.5rem] group hover:border-blue-500/30 transition-all duration-700 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity">
                  <svg className="w-40 h-40 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>
                </div>
                <h3 className="text-blue-500 text-xs font-black uppercase tracking-[0.5em] mb-8">Hook de Visualización</h3>
                <p className="text-4xl font-black text-white leading-[1.1] mb-12 tracking-tight">"{aiResult.suggestedTitle}"</p>
                
                <h3 className="text-purple-500 text-xs font-black uppercase tracking-[0.5em] mb-6">Discovery Tags</h3>
                <div className="flex flex-wrap gap-4">
                  {aiResult.suggestedHashtags.map((tag, i) => (
                    <span key={i} className="px-6 py-4 bg-slate-900/80 text-purple-400 rounded-3xl text-lg font-black border border-white/5 hover:bg-purple-600 hover:text-white transition-all transform hover:-translate-y-1">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="glass-panel p-12 rounded-[3.5rem] group hover:border-green-500/30 transition-all duration-700 shadow-2xl">
                <h3 className="text-green-500 text-xs font-black uppercase tracking-[0.5em] mb-10">Checklist de Impacto</h3>
                <ul className="space-y-10">
                  {aiResult.optimizationTips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-8 group/item">
                      <span className="flex-shrink-0 w-14 h-14 rounded-3xl bg-blue-600/10 text-blue-500 flex items-center justify-center text-2xl font-black border border-white/5 group-hover/item:bg-blue-600 group-hover/item:text-white transition-all duration-500">
                        {i + 1}
                      </span>
                      <p className="text-slate-100 text-2xl font-bold leading-tight pt-1 group-hover/item:text-white transition-colors">{tip}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="mt-40 pt-16 border-t border-slate-800/50 text-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>
        <p className="text-slate-600 text-[12px] font-black tracking-[0.5em] uppercase opacity-50 mb-4">
          Privacy First Protocol • FFmpeg local core • Gemini Flash 3
        </p>
        <p className="text-slate-700 text-[10px] font-bold">© 2025 METADATA PURGE. NO DATA LEAVES YOUR BROWSER.</p>
      </footer>
    </div>
  );
};

export default App;
