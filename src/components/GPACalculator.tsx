
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveGPA } from '../services/database';
import { 
  BookOpen,
  ArrowRight,
  RefreshCcw,
  Trash2,
  TrendingUp,
  CheckCircle,
  CloudLightning,
  Check,
  GraduationCap,
  ChevronRight,
  X
} from 'lucide-react';
import { Grade, GRADE_POINTS, UserRecord, Subject, GPARecord } from '../types.ts';

interface GPACalculatorProps {
  user: UserRecord;
  setUser: (u: UserRecord) => void;
}

const GPACalculator: React.FC<GPACalculatorProps> = ({ user, setUser }) => {
  const navigate = useNavigate();
  
  const getDraft = () => {
    const draft = sessionStorage.getItem('educalc_gpa_draft');
    return draft ? JSON.parse(draft) : null;
  };

  const draft = getDraft();

  const [step, setStep] = useState(draft?.step || 1);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [departmentId, setDepartmentId] = useState(draft?.departmentId || user?.department || '');
  const [semester, setSemester] = useState(draft?.semester || 0);
  const [loadedSubjects, setLoadedSubjects] = useState<Subject[]>(draft?.loadedSubjects || []);
  const [grades, setGrades] = useState<Record<string, Grade>>(draft?.grades || {});
  const [result, setResult] = useState<number | null>(draft?.result || null);
  const [isSaved, setIsSaved] = useState(draft?.isSaved || false);
  const [isMyResult, setIsMyResult] = useState(false);
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);
  const [isDeptPickerOpen, setIsDeptPickerOpen] = useState(false);

  useEffect(() => {
    sessionStorage.setItem('educalc_gpa_draft', JSON.stringify({
      step,
      departmentId,
      semester,
      loadedSubjects,
      grades,
      result,
      isSaved
    }));
  }, [step, departmentId, semester, loadedSubjects, grades, result, isSaved]);

  const availableSemesters = useMemo(() => {
    if (!departmentId) return [];
    const maxSems = departmentId === 'MBA' ? 10 : 8;
    return Array.from({ length: maxSems }, (_, i) => i + 1);
  }, [departmentId]);

  const isAllGradesSelected = useMemo(() => {
    return loadedSubjects.length > 0 && loadedSubjects.every(sub => grades[sub.code] && grades[sub.code] !== '-');
  }, [loadedSubjects, grades]);

  useEffect(() => {
    fetch('/subjects.json')
      .then(res => res.json())
      .then(data => setDepartments(data.departments || []))
      .catch(() => setFetchError('Failed to load curriculum data.'));
  }, []);

  const handleLoadAcademicData = async () => {
    if (!departmentId || semester === 0) return;
    setIsLoading(true);
    setFetchError(null);
    const dept = departments.find(d => d.id === departmentId);
    const subjects = dept?.semesters[semester.toString()];
    
    if (!subjects || subjects.length === 0) {
      setFetchError('Curriculum under update. Please try another semester.');
      setIsLoading(false);
      return;
    }

    const filteredSubjects = subjects.filter((s: Subject) => s.credits > 0);
    setLoadedSubjects(filteredSubjects);
    const initial: Record<string, Grade> = {};
    filteredSubjects.forEach((s: Subject) => initial[s.code] = '-');
    setGrades(initial);
    setStep(2);
    setIsLoading(false);
    setResult(null);
    setIsSaved(false);
    setIsMyResult(false);
  };

  const calculateGPA = () => {
    if (!isAllGradesSelected) return;
    
    let totalPoints = 0;
    let totalCredits = 0;
    loadedSubjects.forEach(sub => {
      const grade = grades[sub.code];
      if (grade && grade !== '-') {
        totalPoints += GRADE_POINTS[grade] * sub.credits;
        totalCredits += sub.credits;
      }
    });
    setResult(totalCredits > 0 ? Number((totalPoints / totalCredits).toFixed(2)) : 0);
    setIsSaved(false);
  };

  const handleSaveResult = async () => {
  if (result === null || isSaved || !isMyResult) return;

  // save locally
  const filteredHistory = user.gpaHistory.filter(r => r.semester !== semester);

  const newRecord: GPARecord = {
    id: Math.random().toString(36).substr(2, 9),
    semester,
    gpa: result,
    department: departmentId,
    date: new Date().toISOString(),
    subjects: loadedSubjects.map(s => ({ ...s, grade: grades[s.code] || '-' }))
  };

  setUser({ ...user, gpaHistory: [newRecord, ...filteredHistory] });

  // 🔥 SAVE TO FIREBASE
  try {
    await saveGPA(user.registerNumber, result);
    setIsSaved(true);
  } catch (err) {
    console.error("Firebase save failed", err);
  }

  if (user.isGuest) {
    setShowRegisterPrompt(true);
  }
};

  function deleteGPAHistory(id: string) {
    setUser({ ...user, gpaHistory: user.gpaHistory.filter(r => r.id !== id) });
  }

  const reset = () => {
    setStep(1);
    setResult(null);
    setSemester(0);
    setIsSaved(false);
    setIsMyResult(false);
    setFetchError(null);
    sessionStorage.removeItem('educalc_gpa_draft');
  };

  const selectedDept = departments.find(d => d.id === departmentId);
  const selectedDeptName = selectedDept?.name || 'Select Department Stream';

  // Fix: Added 'key' to props type to resolve TypeScript error when using GradeButton in a loop in JSX
  const GradeButton = ({ subCode, grade }: { subCode: string, grade: Grade, key?: React.Key }) => {
    const isRA = grade === 'RA';
    const isSelected = grades[subCode] === grade;
    
    let baseStyles = "w-11 h-11 rounded-xl font-black text-xs transition-all active:scale-95 flex items-center justify-center";
    let activeStyles = "";
    let inactiveStyles = "";

    if (isRA) {
      activeStyles = "bg-rose-500 text-white scale-110 shadow-lg shadow-rose-500/30";
      inactiveStyles = "bg-rose-50 dark:bg-rose-950/20 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30";
    } else {
      activeStyles = "bg-indigo-600 text-white scale-110 shadow-lg shadow-indigo-600/30";
      inactiveStyles = "bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700";
    }

    return (
      <button 
        onClick={() => setGrades({...grades, [subCode]: grade})} 
        className={`${baseStyles} ${isSelected ? activeStyles : inactiveStyles}`}
      >
        {grade}
      </button>
    );
  };

  return (
    <div className="space-y-10 md:space-y-12 animate-in fade-in slide-in-from-bottom-4 relative pb-10">
      {/* Department Picker Popup */}
      <div className={`fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-6 transition-all duration-300 ${isDeptPickerOpen ? 'visible' : 'invisible'}`}>
        <div 
          className={`absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 ${isDeptPickerOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setIsDeptPickerOpen(false)}
        ></div>
        <div 
          className={`relative w-full max-w-lg bg-white dark:bg-[#1a2333] rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden transition-transform duration-300 transform ${isDeptPickerOpen ? 'translate-y-0 scale-100' : 'translate-y-full sm:translate-y-10 sm:scale-95'}`}
        >
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="text-lg font-black dark:text-white tracking-tight">Select Department</h3>
            <button onClick={() => setIsDeptPickerOpen(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
          
          <div className="max-h-[60vh] overflow-y-auto no-scrollbar">
            <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
              <button 
                onClick={() => { setDepartmentId(''); setSemester(0); setIsDeptPickerOpen(false); }}
                className={`w-full px-8 py-6 flex items-center justify-between transition-all duration-200 group ${!departmentId ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/40'}`}
              >
                <span className={`text-base font-bold transition-colors ${!departmentId ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-slate-400'}`}>
                  None Selected
                </span>
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${!departmentId ? 'border-indigo-600 shadow-sm' : 'border-slate-300 dark:border-slate-700'}`}>
                  {!departmentId && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full"></div>}
                </div>
              </button>

              {departments.map((dept) => {
                const isSelected = departmentId === dept.id;
                return (
                  <button
                    key={dept.id}
                    onClick={() => { setDepartmentId(dept.id); setSemester(0); setIsDeptPickerOpen(false); }}
                    className={`w-full px-8 py-6 flex items-center justify-between transition-all duration-200 group ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/40'}`}
                  >
                    <div className="flex flex-col text-left pr-6">
                      <span className={`font-bold text-base transition-colors leading-tight ${isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-400'}`}>
                        {dept.name}
                      </span>
                      <span className={`text-[10px] font-black uppercase tracking-widest mt-1 ${isSelected ? 'text-indigo-500' : 'text-slate-400'}`}>
                        {dept.id}
                      </span>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${isSelected ? 'border-indigo-600 scale-110 shadow-lg shadow-indigo-600/20' : 'border-slate-300 dark:border-slate-700 group-hover:border-slate-400'}`}>
                      {isSelected && <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full animate-in zoom-in"></div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="p-4 bg-slate-50 dark:bg-slate-900/50">
             <p className="text-[10px] text-center font-black text-slate-400 uppercase tracking-widest">Secure Institutional Registry</p>
          </div>
        </div>
      </div>

      {showRegisterPrompt && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-white dark:bg-[#1a2333] p-8 rounded-[3rem] shadow-2xl text-center space-y-6 stagger-card-1">
            <div className="w-20 h-20 bg-indigo-600/10 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
              <CloudLightning size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black dark:text-white">Saved Locally</h3>
              <p className="text-slate-500 text-sm">Account required for cloud sync.</p>
            </div>
            <button onClick={() => navigate('/login')} className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl uppercase text-[10px] tracking-widest">Login Now</button>
            <button onClick={() => setShowRegisterPrompt(false)} className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 font-black rounded-2xl uppercase text-[10px]">Later</button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center px-2">
        <div className="space-y-2">
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter dark:text-white">GPA <span className="text-indigo-600">Assistance</span></h2>
          <p className="text-slate-400 dark:text-slate-500 font-medium text-base md:text-lg">Analyze your semester performance instantly.</p>
        </div>
        {(step === 2 || result !== null) && (
          <button onClick={reset} className="p-4 bg-white dark:bg-slate-800 text-slate-500 rounded-2xl shadow-xl transition-all duration-300 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95"><RefreshCcw size={20} /></button>
        )}
      </div>

      {step === 1 ? (
        <div className="space-y-12 animate-in fade-in duration-500">
          <div className="space-y-6">
            <label className="text-[11px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-[0.2em] ml-2 flex items-center">
              <BookOpen size={14} className="mr-2" /> Academic Department
            </label>
            
            <button 
              onClick={() => setIsDeptPickerOpen(true)}
              className="w-full p-8 bg-white dark:bg-[#1a2333] rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl flex items-center justify-between group transition-all hover:border-indigo-500/30 hover:shadow-2xl active:scale-[0.98]"
            >
              <div className="flex flex-col text-left">
                <span className={`text-base font-bold transition-colors ${departmentId ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}`}>
                  {selectedDeptName}
                </span>
                {departmentId && (
                   <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 mt-1">{departmentId} Stream Active</span>
                )}
              </div>
              <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                <ChevronRight size={20} />
              </div>
            </button>
          </div>

          {departmentId && (
            <div className="bg-white dark:bg-[#1a2333] p-8 md:p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl space-y-8 animate-in slide-in-from-top-4 duration-500">
              <div className="text-center">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Select Semester Cycle</p>
                <div className="grid grid-cols-4 gap-4 max-w-[360px] mx-auto">
                  {availableSemesters.map(n => (
                    <button 
                      key={n} 
                      onClick={() => setSemester(n)} 
                      className={`aspect-square flex items-center justify-center rounded-2xl font-black transition-all active:scale-90 ${
                        semester === n ? 'bg-indigo-600 text-white shadow-xl scale-110' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {semester > 0 && (
                <button 
                  onClick={handleLoadAcademicData} 
                  className="w-full py-6 bg-indigo-600 text-white font-black rounded-full shadow-2xl flex items-center justify-center gap-4 uppercase tracking-widest text-[11px] hover:bg-indigo-700 active:scale-95 transition-all animate-in zoom-in"
                >
                  <ArrowRight size={18} /> <span>Load Semester {semester} Subjects</span>
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex justify-center">
             <div className="px-6 py-2 bg-indigo-600/5 dark:bg-indigo-500/10 rounded-full border border-indigo-600/20">
                <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">{selectedDeptName} • SEM {semester}</p>
             </div>
          </div>

          {loadedSubjects.map((sub, idx) => (
            <div key={sub.code} className={`p-8 bg-white dark:bg-[#1a2333] rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl stagger-card-${(idx % 4) + 1}`}>
               <div className="flex flex-col items-center gap-6">
                 <div className="text-center">
                   <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">{sub.code} • {sub.credits} Credits</p>
                   <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xl leading-tight">{sub.name}</h4>
                 </div>
                 
                 <div className="flex flex-col items-center gap-3">
                   <div className="flex flex-wrap justify-center gap-2">
                     {['O','A+','A','B+','B','C'].map(g => (
                       <GradeButton key={g} subCode={sub.code} grade={g as Grade} />
                     ))}
                   </div>
                   <div className="flex justify-center">
                      <GradeButton subCode={sub.code} grade="RA" />
                   </div>
                 </div>
               </div>
            </div>
          ))}

          <button 
            onClick={calculateGPA} 
            disabled={!isAllGradesSelected}
            className="w-full py-7 bg-indigo-600 text-white font-black rounded-full shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-4 uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <RefreshCcw size={20} /> <span>Generate GPA Result</span>
          </button>

          {result !== null && (
            <div className="flex flex-col items-center py-12 space-y-8 animate-in slide-in-from-top-6">
              <div className="w-56 aspect-square bg-white dark:bg-[#1a2333] rounded-[4rem] flex flex-col items-center justify-center border border-slate-100 dark:border-slate-800 shadow-[0_30px_60px_-15px_rgba(79,70,229,0.2)] stagger-card-1">
                <p className="text-slate-400 font-black uppercase text-[10px] tracking-widest mb-2">Semester GPA</p>
                <h2 className="text-7xl font-black text-indigo-600 dark:text-white tracking-tighter">{result.toFixed(2)}</h2>
              </div>
              
              <div onClick={() => setIsMyResult(!isMyResult)} className={`flex items-center gap-5 px-10 py-6 rounded-[2.5rem] border transition-all cursor-pointer stagger-card-2 ${isMyResult ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-slate-50 dark:bg-slate-900 border-transparent shadow-inner'}`}>
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${isMyResult ? 'bg-emerald-500 text-white shadow-lg' : 'bg-slate-200 dark:bg-slate-800 text-transparent'}`}><CheckCircle size={22}/></div>
                <div className="text-left">
                  <p className={`text-xs font-black uppercase tracking-widest ${isMyResult ? 'text-emerald-600' : 'text-slate-400'}`}>Official Verification</p>
                  <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Confirm this result as your own</p>
                </div>
              </div>

              <button 
                onClick={handleSaveResult} 
                disabled={isSaved || !isMyResult} 
                className={`w-full max-md:max-w-md py-7 rounded-full font-black uppercase tracking-widest stagger-card-3 shadow-2xl active:scale-95 transition-all text-sm ${isSaved ? 'bg-emerald-500 text-white' : isMyResult ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/30' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed'}`}
              >
                {isSaved ? 'Archived Successfuly' : 'Commit to History'}
              </button>
            </div>
          )}
        </div>
      )}

      {user.gpaHistory.length > 0 && (
        <div className="space-y-8 pt-12">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-2xl font-black flex items-center space-x-4 dark:text-white"><TrendingUp className="text-emerald-500" /> <span>Performance Ledger</span></h3>
            <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">{user.gpaHistory.length} ENTRIES</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {user.gpaHistory.map((record, i) => (
              <div key={record.id} className={`p-7 bg-white dark:bg-[#1a2333] rounded-[2.5rem] border border-slate-100 dark:border-slate-800 flex items-center justify-between shadow-md hover:shadow-xl transition-all hover:-translate-y-1 stagger-card-${(i % 4) + 1}`}>
                <div className="flex items-center space-x-6">
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-[1.5rem] text-center min-w-[75px]">
                     <span className="text-[9px] font-black text-slate-400 uppercase">SEM</span>
                     <p className="text-2xl font-black text-indigo-600 leading-none mt-1">{record.semester}</p>
                  </div>
                  <div>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{record.department}</p>
                     <p className="text-3xl font-black dark:text-white tracking-tight">{record.gpa.toFixed(2)}</p>
                  </div>
                </div>
                <button onClick={() => deleteGPAHistory(record.id)} className="p-3 text-slate-200 dark:text-slate-700 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-2xl transition-all"><Trash2 size={22} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default GPACalculator;
