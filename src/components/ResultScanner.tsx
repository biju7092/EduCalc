import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Scan, 
  Camera, 
  Image as ImageIcon, 
  XCircle, 
  History,
  CloudLightning,
  X,
  ShieldCheck,
  RefreshCw,
  Edit3,
  Eye,
  FileText,
  Activity,
  Check
} from 'lucide-react';
import { UserRecord, GPARecord, Grade, GRADE_POINTS } from '../types.ts';

interface ResultScannerProps {
  user: UserRecord;
  setUser: (u: UserRecord) => void;
}

const ResultScanner: React.FC<ResultScannerProps> = ({ user, setUser }) => {
  const navigate = useNavigate();
  const [image, setImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState<string>("Initializing Neural Node...");
  const [scanResult, setScanResult] = useState<any>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isMyResult, setIsMyResult] = useState(false);
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);
  
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (image && !isProcessing && !scanResult) {
      processImage();
    }
  }, [image]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setScanResult(null);
        setError(null);
        setIsSaved(false);
        setIsMyResult(false);
        setProcessingStage("Optimizing Visuals...");
      };
      reader.readAsDataURL(file);
    }
  };

  const compressImage = async (base64Str: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
      };
    });
  };

  const processImage = async () => {
    if (!image) return;
    setIsProcessing(true);
    setError(null);
    
    const timeoutId = setTimeout(() => {
      if (isProcessing) {
        setIsProcessing(false);
        setError("Neural connection timed out. Check your connectivity.");
      }
    }, 30000);

    try {
      setProcessingStage("Shrinking Data Packet...");
      const optimizedBase64 = await compressImage(image);
      
      setProcessingStage("AI Neural Extraction...");
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const subjectsRes = await fetch('subjects.json');
      const subjectsData = await subjectsRes.json();

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: optimizedBase64 } },
            { 
              text: `Extract results from this university marksheet. 
              Output JSON: {detectedDepartment, detectedSemester, results: [{code, grade}]}.`
            }
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              detectedDepartment: { type: Type.STRING },
              detectedSemester: { type: Type.NUMBER },
              results: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: { code: { type: Type.STRING }, grade: { type: Type.STRING } },
                  required: ["code", "grade"]
                }
              }
            },
            required: ["detectedDepartment", "detectedSemester", "results"]
          }
        }
      });

      setProcessingStage("Registry Verification...");
      const text = response.text;
      if (!text) throw new Error("Neural Node returned an empty vector.");
      
      const parsed = JSON.parse(text);
      
      let deptMatch = subjectsData.departments.find((d: any) => 
        parsed.detectedDepartment.toLowerCase().includes(d.id.toLowerCase()) ||
        d.name.toLowerCase().includes(parsed.detectedDepartment.toLowerCase())
      );
      
      const deptId = deptMatch?.id || 'CSE';
      const semesterKey = parsed.detectedSemester?.toString() || "1";
      const curriculum = (deptMatch || subjectsData.departments[0])?.semesters[semesterKey] || [];

      const validResults = parsed.results.map((r: any) => {
        const cleanCode = r.code.replace(/[^A-Z0-9]/g, '').toUpperCase();
        const subInfo = curriculum.find((s: any) => s.code.toUpperCase() === cleanCode);

        return { 
          code: subInfo?.code || cleanCode, 
          name: subInfo?.name || "Unverified Subject", 
          credits: subInfo?.credits || 3, 
          grade: (GRADE_POINTS[r.grade as Grade] !== undefined ? r.grade : 'RA') as Grade 
        };
      }).filter((r: any) => r.code.length >= 4);

      if (validResults.length === 0) throw new Error("Zero records detected. Is the image clear?");

      recalculateGPA(deptId, parsed.detectedSemester || 1, validResults);
      clearTimeout(timeoutId);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Extraction failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const recalculateGPA = (deptId: string, semester: number, results: any[]) => {
    let totalPoints = 0, totalCredits = 0;
    results.forEach((r: any) => {
      const points = GRADE_POINTS[r.grade as Grade] || 0;
      totalPoints += points * r.credits;
      totalCredits += r.credits;
    });

    setScanResult({ 
      departmentId: deptId, 
      semester, 
      gpa: totalCredits > 0 ? (totalPoints / totalCredits) : 0, 
      results 
    });
  };

  const handleUpdateGrade = (index: number, newGrade: Grade) => {
    const updated = [...scanResult.results];
    updated[index] = { ...updated[index], grade: newGrade };
    recalculateGPA(scanResult.departmentId, scanResult.semester, updated);
    setEditingIndex(null);
  };

  // Fix: Added 'key' to props type to resolve TypeScript error when using GradeOption in a loop in JSX
  const GradeOption = ({ grade, isCurrent, onSelect }: { grade: Grade, isCurrent: boolean, onSelect: () => void, key?: React.Key }) => {
    const isRA = grade === 'RA';
    return (
      <button 
        onClick={onSelect} 
        className={`flex-1 h-14 rounded-2xl font-black text-sm transition-all active:scale-90 flex items-center justify-center border-2 ${
          isCurrent 
            ? isRA 
              ? 'bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-500/30' 
              : 'bg-brand-600 border-brand-600 text-white shadow-lg shadow-brand-500/30'
            : isRA
              ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-100 dark:border-rose-900 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/40'
              : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
        }`}
      >
        {grade}
      </button>
    );
  };

  const saveToHistory = () => {
    if (!scanResult || isSaved || !isMyResult) return;
    const newRecord: GPARecord = {
      id: Math.random().toString(36).substr(2, 9),
      semester: scanResult.semester,
      gpa: scanResult.gpa,
      department: scanResult.departmentId,
      date: new Date().toISOString(),
      subjects: scanResult.results
    };
    const filteredHistory = user.gpaHistory.filter(r => r.semester !== scanResult.semester);
    setUser({ ...user, gpaHistory: [newRecord, ...filteredHistory] });
    setIsSaved(true);
    if (user.isGuest) setShowRegisterPrompt(true);
  };

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700 pb-20">
      {showRegisterPrompt && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-surface-950/60 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="w-full max-sm bg-white dark:bg-surface-900 p-10 rounded-[3rem] shadow-2xl text-center space-y-6">
            <div className="w-20 h-20 bg-brand-600/10 text-brand-600 rounded-full flex items-center justify-center mx-auto"><CloudLightning size={32} /></div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black dark:text-white">Profile Synchronized</h3>
              <p className="text-slate-500 text-sm font-medium">This record is currently stored locally.</p>
            </div>
            <button onClick={() => navigate('/login')} className="w-full py-4 bg-brand-600 text-white font-black rounded-2xl uppercase tracking-widest text-[10px] shadow-lg active:scale-95 transition-all">Secure Login</button>
            <button onClick={() => setShowRegisterPrompt(false)} className="w-full py-4 bg-slate-100 dark:bg-surface-800 text-slate-500 font-black rounded-2xl uppercase tracking-widest text-[10px]">Continue Locally</button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-end px-2">
        <div className="space-y-1">
          <h2 className="text-4xl font-black tracking-tighter dark:text-white flex items-center gap-3">
            Visual <span className="text-brand-600">Scan</span>
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Analyze results instantly with AI vision.</p>
        </div>
      </div>

      {!image ? (
        <div className="bg-white dark:bg-surface-900 p-12 rounded-[3.5rem] border-2 border-dashed border-slate-200 dark:border-slate-800/50 text-center space-y-10 flex flex-col items-center justify-center min-h-[480px] shadow-2xl relative overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 w-full max-w-4xl mx-auto">
            <div className="space-y-8 flex flex-col items-center justify-center">
              <div className="relative">
                <div className="w-32 h-32 bg-brand-600/10 text-brand-600 rounded-full flex items-center justify-center">
                  <FileText size={64} className="animate-float" />
                </div>
                <div className="absolute -inset-4 border border-brand-500/20 rounded-full animate-pulse"></div>
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black dark:text-white">Instant Capture</h3>
                <p className="text-slate-400 max-w-xs mx-auto text-sm font-medium">Flash-speed analysis of academic marksheets.</p>
              </div>
              <div className="flex flex-col gap-4 w-full relative z-10">
                <button onClick={() => cameraInputRef.current?.click()} className="w-full py-5 bg-brand-600 text-white font-black rounded-3xl shadow-xl shadow-brand-600/30 active:scale-95 transition-all uppercase tracking-widest text-[10px] flex items-center justify-center gap-3"><Camera size={18} /> Snap Photo</button>
                <button onClick={() => galleryInputRef.current?.click()} className="w-full py-5 bg-slate-100 dark:bg-surface-800 text-slate-600 dark:text-slate-300 font-black rounded-3xl active:scale-95 transition-all uppercase tracking-widest text-[10px] flex items-center justify-center gap-3"><ImageIcon size={18} /> Upload Results</button>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-surface-950 p-8 rounded-[2.5rem] text-left space-y-6 border border-slate-100 dark:border-slate-800">
               <h4 className="font-black text-xs uppercase text-brand-600 tracking-widest flex items-center gap-2"><Eye size={16}/> Extraction Tips</h4>
               <ul className="space-y-4">
                  {[
                    "Focus directly on the grade column.",
                    "Higher contrast speeds up AI processing.",
                    "Ensure your Register Number is visible."
                  ].map((tip, i) => (
                    <li key={i} className="flex gap-3 items-start">
                       <div className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-600 flex items-center justify-center text-[10px] font-black shrink-0">{i+1}</div>
                       <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{tip}</p>
                    </li>
                  ))}
               </ul>
            </div>
          </div>
          <input type="file" ref={cameraInputRef} onChange={handleFileChange} accept="image/*" capture="environment" className="hidden" />
          <input type="file" ref={galleryInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
        </div>
      ) : (
        <div className="space-y-8 animate-in slide-in-from-bottom-4">
          <div className="relative rounded-[3rem] overflow-hidden border-4 border-white dark:border-surface-800 shadow-2xl bg-slate-900 aspect-video max-h-[450px] flex items-center justify-center group">
            <img src={image} alt="Preview" className="w-full h-full object-contain" />
            {isProcessing && (
               <div className="absolute inset-0 bg-brand-950/80 backdrop-blur-md flex items-center justify-center z-20">
                  <div className="flex flex-col items-center gap-8">
                    <div className="relative w-24 h-24">
                      <div className="absolute inset-0 rounded-full border-4 border-white/20"></div>
                      <div className="absolute inset-0 rounded-full border-4 border-brand-500 border-t-transparent animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center"><Activity className="text-brand-400 animate-pulse" size={32} /></div>
                    </div>
                    <p className="text-white font-black uppercase tracking-[0.5em] text-[11px] animate-pulse">{processingStage}</p>
                  </div>
                  <div className="absolute inset-x-0 w-full h-[2px] bg-brand-400 shadow-[0_0_25px_rgba(129,140,248,1)] animate-scan-line"></div>
               </div>
            )}
          </div>

          {error && (
            <div className="p-8 bg-rose-500/10 border border-rose-500/20 rounded-[2.5rem] text-rose-500 font-bold flex items-center gap-5">
              <XCircle className="shrink-0" size={32} />
              <div className="flex-1">
                <p className="text-base font-black">Scan Failure</p>
                <p className="text-sm opacity-80 mt-1">{error}</p>
              </div>
            </div>
          )}

          {scanResult && (
            <div className="space-y-10 animate-in fade-in slide-in-from-top-6">
              <div className="bg-white dark:bg-surface-900 rounded-[3.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden">
                <div className="p-12 bg-gradient-to-br from-brand-600 to-brand-800 text-white flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden">
                  <div className="space-y-3 relative z-10 text-center md:text-left">
                    <div className="px-3 py-1 bg-white/20 rounded-lg text-[10px] font-black uppercase tracking-widest inline-flex items-center gap-2 mb-2">
                       <ShieldCheck size={12}/> Analysis Verified
                    </div>
                    <h3 className="text-4xl font-black leading-tight tracking-tight">{scanResult.departmentId} <span className="text-brand-300">Sem {scanResult.semester}</span></h3>
                  </div>
                  <div className="text-center md:text-right relative z-10 bg-white/10 backdrop-blur-xl p-8 rounded-[3rem] border border-white/20 min-w-[200px] shadow-2xl">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-80 mb-2">Calculated GPA</p>
                    <p className="text-7xl font-black tracking-tighter leading-none">{scanResult.gpa.toFixed(2)}</p>
                  </div>
                </div>
                
                <div className="p-6 md:p-10 space-y-4 no-scrollbar max-h-[700px] overflow-y-auto">
                  {scanResult.results.map((r: any, idx: number) => {
                    const isEditing = editingIndex === idx;
                    return (
                      <div key={idx} className={`relative transition-all duration-500 rounded-[2.5rem] overflow-hidden ${isEditing ? 'ring-4 ring-brand-500/20 shadow-2xl scale-[1.02] z-20' : 'bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 shadow-sm'}`}>
                        <div className={`p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 ${isEditing ? 'bg-white dark:bg-surface-900' : ''}`}>
                          <div className="text-center md:text-left flex-1">
                             <div className="flex items-center justify-center md:justify-start gap-3 mb-1">
                               <span className="px-3 py-1 bg-brand-600/10 text-brand-600 dark:text-brand-400 text-[10px] font-black rounded-lg uppercase tracking-widest">{r.code}</span>
                               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{r.credits} Credits</span>
                             </div>
                             <h4 className="font-bold text-slate-800 dark:text-slate-200 text-lg md:text-xl leading-tight">{r.name}</h4>
                          </div>
                          
                          <div className="shrink-0 flex items-center gap-4">
                            {!isEditing ? (
                              <button 
                                onClick={() => setEditingIndex(idx)}
                                className={`px-10 py-5 rounded-[2rem] font-black text-3xl transition-all hover:scale-105 active:scale-95 flex items-center gap-5 group ${
                                  r.grade === 'RA' 
                                    ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/30' 
                                    : 'bg-white dark:bg-slate-800 text-brand-600 dark:text-white border-2 border-slate-100 dark:border-slate-700 shadow-sm'
                                }`}
                              >
                                <span>{r.grade}</span>
                                <Edit3 size={18} className="opacity-30 group-hover:opacity-100 transition-opacity" />
                              </button>
                            ) : (
                              <button 
                                onClick={() => setEditingIndex(null)}
                                className="p-5 bg-slate-100 dark:bg-slate-800 text-slate-400 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                              >
                                <X size={24} />
                              </button>
                            )}
                          </div>
                        </div>

                        {isEditing && (
                          <div className="p-8 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 animate-in slide-in-from-top-4">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-6">Select Correct Grade</p>
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3">
                              {['O', 'A+', 'A', 'B+', 'B', 'C', 'RA'].map((g) => (
                                <GradeOption 
                                  key={g} 
                                  grade={g as Grade} 
                                  isCurrent={r.grade === g} 
                                  onSelect={() => handleUpdateGrade(idx, g as Grade)} 
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-8 max-w-4xl mx-auto w-full px-2">
                <div onClick={() => setIsMyResult(!isMyResult)} className={`group cursor-pointer flex items-center gap-6 px-10 py-8 rounded-[3rem] transition-all duration-300 border-2 w-full ${isMyResult ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-100 dark:bg-slate-800 border-transparent'}`}>
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isMyResult ? 'bg-emerald-500 text-white scale-110 shadow-xl' : 'bg-slate-300 dark:bg-slate-700 text-transparent'}`}>
                    <Check size={32} strokeWidth={3} />
                  </div>
                  <div className="flex flex-col text-left flex-1">
                    <span className={`text-[15px] font-black uppercase tracking-widest ${isMyResult ? 'text-emerald-600' : 'text-slate-500'}`}>Verify Accuracy</span>
                    <span className="text-[13px] font-bold text-slate-400">I have reviewed and corrected the grades.</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                  <button onClick={saveToHistory} disabled={isSaved || !isMyResult} className={`py-7 rounded-[2.5rem] font-black uppercase tracking-widest text-[12px] flex items-center justify-center gap-3 shadow-2xl transition-all ${isSaved ? 'bg-emerald-500 text-white' : isMyResult ? 'bg-brand-600 text-white hover:bg-brand-700 active:scale-95' : 'bg-slate-200 dark:bg-surface-800 text-slate-400 cursor-not-allowed'}`}>
                    {isSaved ? <><ShieldCheck size={20} /> Saved to Registry</> : <><History size={20} /> Commit to Ledger</>}
                  </button>
                  <button onClick={() => { setImage(null); setScanResult(null); setError(null); }} className="py-7 bg-white dark:bg-surface-800 text-slate-500 dark:text-slate-300 font-black rounded-[2.5rem] uppercase tracking-widest text-[12px] active:scale-95 transition-all flex items-center justify-center gap-3 border border-slate-200 dark:border-slate-700 shadow-md">
                    Scan New Marksheet <RefreshCw size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ResultScanner;