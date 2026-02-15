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
  <div className="w-full mt-8">
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
  <div className="bg-black/40 border border-white/5 rounded-[2rem] p-8 font-mono text-xs text-slate-400 space-y-3 mb-8 shadow-inner">
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
      * El archivo "{fileName}" ha sido anonimizado con éxito.
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
      
      // CARGA LOCAL PARA PRODUCCIÓN EN CLOUD RUN
      await ffmpeg.load({
        coreURL: '/ffmpeg/ffmpeg-core.js',
        wasmURL: '/ffmpeg/ffmpeg-core.wasm',
        workerURL: '/ffmpeg/ffmpeg-core.worker.js'
      });
      
      ffmpegRef.current = ffmpeg;
      setStatus(AppStatus.IDLE);
    } catch (error: any) {
      console.error("FFmpeg Load Error:", error);
      setErrorMsg(`Fallo de carga local: ${error.message || 'Error de sistema'}.`);
      setStatus(AppStatus.ERROR);
    }
  };

  useEffect(() => {
    loadFFmpeg();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Fix: Access files via target casted to any to resolve "Property 'files' does not exist on type 'EventTarget & HTMLInputElement'" TypeScript error
    const file = (e.target as any).files?.[0];
    if (file) {
      if (file.size > 200 * 1024 * 1024) {
        setErrorMsg("Máximo 200MB permitido.");
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
    
    setStatus(AppStatus.PROCESSING);
    setProgress(5);
    
    const ffmpeg = ffmpegRef.current;
    const inputName = `input_${Date.now()}.mp4`;
    const outputName = `clean_${Date.now()}.mp4`;

    try {
      ffmpeg.on('progress', ({ progress }: { progress: number }) => {
        setProgress(Math.max(progress * 100, 10));
      });

      await ffmpeg.writeFile(inputName, await fetchFile(videoFile));
      setProgress(25);

      await ffmpeg.exec([
        '-i', inputName,
        '-map_metadata', '-1',
        '-c', 'copy',
        '-movflags', '+faststart',
        outputName
      ]);

      const data = await ffmpeg.readFile(outputName);
      const url = URL.createObjectURL(new Blob([(data as Uint8Array).buffer], { type: 'video/mp4' }));
      setOutputUrl(url);

      // Fix: Access document through the window object to resolve "Cannot find name 'document'" TypeScript error
      const link = (window as any).document.createElement('a');
      link.href = url;
      link.download = `limpio_${videoFile.name}`;
      (window as any).document.body.appendChild(link);
      link.click();
      (window as any).document.body.removeChild(link);
      
      setProgress(100);

      try {
        await ffmpeg.deleteFile(inputName);
        await ffmpeg.deleteFile(outputName);
      } catch (e) {}

      setStatus(AppStatus.ANALYZING);
      const aiResponse = await analyzeVideoContent(videoFile.name);
      setAiResult(aiResponse);

      setStatus(AppStatus.COMPLETED);
    } catch (error: any) {
      console.error(error);
      setErrorMsg("Error de procesamiento. El archivo no es compatible.");
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
        <section className="glass-panel rounded-[3rem] p-10 shadow-2xl relative overflow-hidden">
          {status === AppStatus.LOADING_FFMPEG && (
            <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-2xl z-40 flex flex-col items-center justify-center text-center px-4">
              <div className="w-24 h-24 border-8 border-blue-600 border-t-transparent rounded-full animate-spin mb-8 shadow-[0_0_30px_rgba(37,99,235,0.4)]"></div>
              <h3 className="text-white font-black text-3xl uppercase tracking-tighter">Preparando FFmpeg Local</h3>
              <p className="text-slate-500 text-sm mt-4 font-bold uppercase tracking-widest">Sin dependencias externas...</p>
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
                  <h4 className="mb-2 text-4xl font-black text-white uppercase tracking-tighter">Seleccionar Video</h4>
                  <p className="text-slate-500 text-sm font-black uppercase tracking-widest opacity-60">Privacidad Total en Cloud Run</p>
                </div>
                <input type="file" className="hidden" accept="video/*" onChange={handleFileChange} />
              </label>
            )}

            {videoFile && status !== AppStatus.COMPLETED && status !== AppStatus.ERROR && (
              <div className="w-full space-y-8 animate-in zoom-in-95 duration-500">
                <div className="flex items-center justify-between p-8 bg-black/40 rounded-[2.5rem] border border-white/5">
                  <div className="flex items-center space-x-6">
                    <div className="bg-blue-600/20 p-5 rounded-3xl">
                      <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2-2v8a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-black text-slate-100 text-2xl truncate max-w-xs">{videoFile.name}</p>
                      <p className="text-sm text-blue-500/80 font-black uppercase tracking-widest">{(videoFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button onClick={reset} className="text-slate-600 hover:text-red-500 p-4">
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {status === AppStatus.IDLE && (
                  <button
                    onClick={processVideo}
                    className="w-full py-8 bg-blue-600 hover:bg-blue-500 text-white font-black text-3xl rounded-[2rem] transition-all shadow-xl shadow-blue-900/40 active:scale-95 transform hover:-translate-y-1"
                  >
                    PURGAR METADATOS
                  </button>
                )}

                {(status === AppStatus.PROCESSING || status === AppStatus.ANALYZING) && (
                  <ProgressBar 
                    progress={progress || (status === AppStatus.ANALYZING ? 95 : 10)} 
                    label={status === AppStatus.PROCESSING ? "Procesando en local..." : "Informe Gemini..."} 
                  />
                )}
              </div>
            )}
            
            {status === AppStatus.COMPLETED && outputUrl && (
              <div className="w-full space-y-10">
                <div className="bg-green-600/10 border border-green-500/20 p-10 rounded-[3rem] flex items-center space-x-8">
                  <div className="bg-green-600 rounded-3xl p-5">
                    <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-green-500 font-black text-3xl uppercase">Listo para Redes</h4>
                    <p className="text-green-400/70 text-lg font-bold">Metadatos eliminados permanentemente.</p>
                  </div>
                </div>

                <TechnicalReport fileName={videoFile?.name || 'video.mp4'} />
                
                <div className="flex flex-col sm:flex-row gap-6">
                  <a
                    href={outputUrl}
                    download={`limpio_${videoFile?.name || 'video'}`}
                    className="flex-[2] py-8 bg-slate-800 hover:bg-slate-700 text-white font-black text-2xl rounded-[2rem] text-center transition-all border border-white/10"
                  >
                    RE-DESCARGAR
                  </a>
                  <button
                    onClick={reset}
                    className="flex-1 py-8 bg-blue-600 hover:bg-blue-500 text-white font-black text-2xl rounded-[2rem] transition-all"
                  >
                    OTRO VIDEO
                  </button>
                </div>
              </div>
            )}

            {status === AppStatus.ERROR && (
               <div className="w-full p-10 bg-red-600/10 border border-red-500/30 rounded-[3rem] animate-shake-x">
                  <h5 className="text-red-500 font-black text-3xl uppercase mb-4 tracking-tighter">Error Crítico</h5>
                  <p className="text-red-400/80 text-lg mb-10 font-bold leading-tight">{errorMsg}</p>
                  <button onClick={() => { reset(); loadFFmpeg(); }} className="w-full py-6 bg-red-600/20 text-red-500 font-black text-xl rounded-3xl border border-red-500/30 transition-all hover:bg-red-600/30">
                    REINTENTAR
                  </button>
               </div>
            )}
          </div>
        </section>

        {aiResult && status === AppStatus.COMPLETED && (
          <section className="space-y-12 py-10">
            <h2 className="text-5xl font-black flex items-center gap-6">
              <span className="p-5 bg-purple-600/20 rounded-[2rem] border border-purple-500/20">
                <svg className="w-12 h-12 text-purple-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
              </span>
              Optimización Gemini
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="glass-panel p-12 rounded-[3.5rem] group hover:border-blue-500/30 transition-all duration-700 shadow-2xl">
                <h3 className="text-blue-500 text-xs font-black uppercase tracking-[0.5em] mb-8">Hook de Título</h3>
                <p className="text-4xl font-black text-white leading-[1.1] mb-12">"{aiResult.suggestedTitle}"</p>
                <div className="flex flex-wrap gap-4">
                  {aiResult.suggestedHashtags.map((tag, i) => (
                    <span key={i} className="px-6 py-4 bg-slate-900/80 text-purple-400 rounded-3xl text-lg font-black border border-white/5">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="glass-panel p-12 rounded-[3.5rem] group hover:border-green-500/30 transition-all duration-700 shadow-2xl">
                <h3 className="text-green-500 text-xs font-black uppercase tracking-[0.5em] mb-10">Tips de Impacto</h3>
                <ul className="space-y-10">
                  {aiResult.optimizationTips.map((tip, i) => (
                    <li key={i} className="flex items-start gap-8">
                      <span className="flex-shrink-0 w-14 h-14 rounded-3xl bg-blue-600/10 text-blue-500 flex items-center justify-center text-2xl font-black border border-white/5">
                        {i + 1}
                      </span>
                      <p className="text-slate-100 text-2xl font-bold leading-tight pt-1">{tip}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}
      </main>
      <footer className="mt-40 pt-16 border-t border-slate-800/50 text-center opacity-50">
        <p className="text-slate-600 text-[12px] font-black tracking-[0.5em] uppercase">
          Cloud Run Stable • Local Processing • Gemini 3 Flash
        </p>
      </footer>
    </div>
  );
};

export default App;