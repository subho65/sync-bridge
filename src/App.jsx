import React, { useState, useEffect, useRef } from "react";
import { Scanner } from '@yudiel/react-qr-scanner'; // <--- NEW IMPORT
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore, doc, onSnapshot, setDoc, updateDoc, arrayUnion, arrayRemove, initializeFirestore, enableNetwork, disableNetwork
} from "firebase/firestore";
import {
  getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject
} from "firebase/storage";
import {
  Copy, Smartphone, Monitor, Zap, Download, Trash2, X, FileText,
  UploadCloud, CheckCircle, Wifi, WifiOff, ArrowRight, Loader2, RefreshCw, AlertTriangle, QrCode, Camera
} from "lucide-react";

// --- CONFIGURATION ---
const generateRoomCode = () => Math.floor(100000 + Math.random() * 900000).toString();

const robustCopy = async (text) => {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed"; textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus(); textArea.select();
    try { document.execCommand('copy'); document.body.removeChild(textArea); return true; }
    catch (e) { document.body.removeChild(textArea); return false; }
  }
};

const initFirebase = () => {
  const firebaseConfig = {
    apiKey: "AIzaSyCS7HPWqw_K7UXwLNM6-F5PYX6yicph7qs",
    authDomain: "sync-bridge-36fac.firebaseapp.com",
    projectId: "sync-bridge-36fac",
    storageBucket: "sync-bridge-36fac.firebasestorage.app",
    messagingSenderId: "781025230842",
    appId: "1:781025230842:web:122e30b3fbe781c5772e43",
    measurementId: "G-0J1HG9G9Q0"
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = initializeFirestore(app, { experimentalForceLongPolling: true });
  const storage = getStorage(app);
  return { auth, db, storage };
};

const { auth, db, storage } = initFirebase();

// --- COMPONENTS ---

const ToastContainer = ({ toasts }) => (
  <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
    {toasts.map((toast) => (
      <div key={toast.id} className={`pointer-events-auto px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium flex items-center gap-2 animate-in slide-in-from-bottom-5 fade-in duration-300 ${toast.type === 'error' ? 'bg-red-500' : 'bg-slate-800'}`}>
        {toast.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
        {toast.message}
      </div>
    ))}
  </div>
);

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error) { return { hasError: true }; }
  componentDidCatch(error, errorInfo) { console.error("Crash:", error, errorInfo); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
          <h2 className="text-xl font-bold">App Crashed</h2>
          <button onClick={() => window.location.reload()} className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg">Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function AppWrapper() {
  return <ErrorBoundary><App /></ErrorBoundary>;
}

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("landing");
  const [roomCode, setRoomCode] = useState("");
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [toasts, setToasts] = useState([]);

  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    signInAnonymously(auth).catch((e) => console.warn("Auth failed", e));

    // Deep Link Check
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get("room");
    if (roomParam && roomParam.length === 6) {
      setRoomCode(roomParam);
      setView("session");
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    const handleStatus = () => {
      const online = navigator.onLine;
      setIsOffline(!online);
      if (online) enableNetwork(db); else disableNetwork(db);
    };

    window.addEventListener('online', handleStatus);
    window.addEventListener('offline', handleStatus);
    return () => {
      unsubscribe();
      window.removeEventListener('online', handleStatus);
      window.removeEventListener('offline', handleStatus);
    };
  }, []);

  if (isOffline) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-6 text-center">
        <WifiOff className="w-12 h-12 text-red-400 mb-4" />
        <h2 className="text-xl font-bold">No Internet</h2>
        <button onClick={() => window.location.reload()} className="mt-6 flex items-center gap-2 bg-blue-600 px-4 py-2 rounded-lg"><RefreshCw className="w-4 h-4" /> Retry</button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        <p className="animate-pulse">Initializing...</p>
      </div>
    );
  }

  return (
    <>
      {view === "landing" ? (
        <LandingView onJoin={(code) => { setRoomCode(code); setView("session"); }} showToast={showToast} />
      ) : (
        <SessionView user={user} roomCode={roomCode} onExit={() => setView("landing")} showToast={showToast} />
      )}
      <ToastContainer toasts={toasts} />
    </>
  );
}

function LandingView({ onJoin, showToast }) {
  const [inputCode, setInputCode] = useState("");
  const [isScanning, setIsScanning] = useState(false);

  const handleScan = (results) => {
    if (results && results.length > 0) {
      const rawValue = results[0].rawValue;
      try {
        // 1. Try to extract 'room' param from a URL (e.g., https://...?room=123456)
        const url = new URL(rawValue);
        const room = url.searchParams.get("room");
        if (room && room.length === 6) {
          setIsScanning(false);
          onJoin(room);
          return;
        }
      } catch (e) {
        // 2. Not a URL? Maybe they scanned just the 6-digit text
        if (rawValue.length === 6 && !isNaN(rawValue)) {
          setIsScanning(false);
          onJoin(rawValue);
          return;
        }
      }
    }
  };

  const handleError = (error) => {
    console.error(error);
    // Suppress minor camera errors, but you could showToast if needed
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6 font-sans">

      {/* FULL SCREEN SCANNER OVERLAY */}
      {isScanning && (
        <div className="fixed inset-0 z-50 bg-black flex flex-col">
          <div className="relative flex-1 flex items-center justify-center bg-black">
            <Scanner
              onScan={handleScan}
              onError={handleError}
              components={{ audio: false, finder: true }}
              styles={{ container: { width: '100%', height: '100%' } }}
            />
            {/* Overlay Instructions */}
            <div className="absolute top-10 text-center px-4">
              <div className="bg-black/60 px-4 py-2 rounded-full text-sm font-medium backdrop-blur-md">
                Point camera at Room QR Code
              </div>
            </div>
          </div>
          <div className="p-6 bg-slate-900 pb-10">
            <button
              onClick={() => setIsScanning(false)}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-4 rounded-xl transition-colors border border-slate-700"
            >
              Cancel Scan
            </button>
          </div>
        </div>
      )}

      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex p-4 rounded-full bg-blue-500/10 ring-1 ring-blue-500/50 mb-2"><Zap className="w-8 h-8 text-blue-400" /></div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">SyncBridge Pro</h1>
          <p className="text-slate-400">Share text & multiple files globally.</p>
        </div>
        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-sm space-y-6">
          <button onClick={() => onJoin(generateRoomCode())} className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-900/20">
            <Monitor className="w-5 h-5" /> <span>Start New Session</span>
          </button>

          <div className="relative text-center"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700"></div></div><span className="relative px-2 bg-slate-800 text-slate-500 text-sm">OR JOIN</span></div>

          <form onSubmit={(e) => { e.preventDefault(); if (inputCode.length === 6) onJoin(inputCode); }} className="space-y-3">
            <input type="text" maxLength={6} placeholder="Enter 6-digit Code" value={inputCode} onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))} className="w-full bg-slate-900/50 border border-slate-700 text-white text-center text-2xl tracking-widest py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" />

            <div className="grid grid-cols-2 gap-3">
              <button type="submit" disabled={inputCode.length !== 6} className="flex items-center justify-center gap-2 bg-slate-700 disabled:opacity-50 hover:bg-slate-600 text-white font-medium py-3 rounded-xl transition-all">
                <Smartphone className="w-5 h-5" /> <span>Join</span>
              </button>
              {/* SCAN QR BUTTON */}
              <button type="button" onClick={() => setIsScanning(true)} className="flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 rounded-xl transition-all border border-slate-600">
                <Camera className="w-5 h-5" /> <span>Scan QR</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function SessionView({ user, roomCode, onExit, showToast }) {
  const [text, setText] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [status, setStatus] = useState("idle");
  const [connected, setConnected] = useState(false);
  const [files, setFiles] = useState([]);
  const [activeUploads, setActiveUploads] = useState({});
  const [showQR, setShowQR] = useState(false);

  const debounceRef = useRef(null);
  const docRef = doc(db, "sync_rooms", roomCode);

  useEffect(() => {
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      setConnected(true);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.lastSender !== user.uid && data.text !== undefined) {
          setText(data.text);
          setLastUpdated(new Date());
        }
        if (data.files) {
          setFiles(data.files);
        }
      } else {
        setText("");
        setFiles([]);
      }
    }, () => setConnected(false));
    return () => unsubscribe();
  }, [user.uid, roomCode]);

  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);
    setStatus("syncing");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDoc(docRef, { text: val, lastSender: user.uid, updatedAt: Date.now() }, { merge: true }).then(() => setStatus("idle"));
    }, 500);
  };

  const handleFileUpload = async (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (!selectedFiles.length) return;

    for (const file of selectedFiles) {
      if (file.size > 100 * 1024 * 1024) {
        showToast(`${file.name} is too large (Max 100MB)`, 'error');
        continue;
      }

      const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const storageRef = ref(storage, `uploads/${roomCode}/${safeName}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setActiveUploads(prev => ({ ...prev, [file.name]: progress }));
        },
        (error) => {
          console.error(error);
          showToast(`Failed to upload ${file.name}`, 'error');
          setActiveUploads(prev => { const n = { ...prev }; delete n[file.name]; return n; });
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          const newFile = {
            name: file.name, type: file.type, url: downloadURL,
            fullPath: storageRef.fullPath, size: file.size, uploadedAt: Date.now()
          };
          await updateDoc(docRef, {
            files: arrayUnion(newFile), lastSender: user.uid
          }).catch(async () => {
            await setDoc(docRef, { files: [newFile], lastSender: user.uid }, { merge: true });
          });
          setActiveUploads(prev => { const n = { ...prev }; delete n[file.name]; return n; });
          showToast(`${file.name} uploaded!`);
        }
      );
    }
  };

  const handleDownload = async (fileObj) => {
    showToast("Starting download...");
    try {
      const response = await fetch(fileObj.url);
      if (!response.ok) throw new Error("Network response was not ok");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileObj.name;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      link.remove();
    } catch (err) {
      window.open(fileObj.url, '_blank');
    }
  };

  const handleDeleteFile = async (fileObj) => {
    if (!window.confirm(`Delete ${fileObj.name}?`)) return;
    try {
      await updateDoc(docRef, { files: arrayRemove(fileObj), lastSender: user.uid });
      deleteObject(ref(storage, fileObj.fullPath)).catch(console.warn);
      showToast("File deleted");
    } catch (e) { showToast("Could not delete file", "error"); }
  };

  const handleClear = async () => {
    if (!window.confirm("Clear text and ALL files?")) return;
    await setDoc(docRef, { text: "", files: [], lastSender: user.uid });
    setText("");
    showToast("Room cleared");
  };

  const copyRoomCode = () => { robustCopy(roomCode); showToast("Room Code Copied!"); };

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.origin + "?room=" + roomCode)}`;

  return (
    <div className="min-h-screen bg-gray-50 text-slate-800 font-sans flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={onExit} className="p-2 hover:bg-gray-100 rounded-lg text-slate-500"><ArrowRight className="w-5 h-5 rotate-180" /></button>
          <div onClick={copyRoomCode} className="cursor-pointer group">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Room Code</div>
            <div className="text-xl font-mono font-bold text-slate-800 group-hover:text-blue-600 transition-colors flex items-center gap-2">
              {roomCode} <Copy className="w-3 h-3 opacity-0 group-hover:opacity-100" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowQR(!showQR)} className={`p-2 rounded-lg transition-colors ${showQR ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-slate-600'}`}>
            <QrCode className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full">
            {connected ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
            <span className="text-xs font-medium text-slate-600 hidden sm:inline">
              {status === "syncing" ? "Syncing..." : connected ? "Live" : "Offline"}
            </span>
          </div>
        </div>
      </header>

      {showQR && (
        <div className="bg-white border-b border-gray-200 p-6 flex flex-col items-center justify-center animate-in slide-in-from-top-5">
          <img src={qrUrl} alt="QR Code" className="rounded-lg border-4 border-white shadow-md mb-2 w-48 h-48" />
          <p className="text-sm text-slate-500 font-medium">Scan with App to join instantly</p>
        </div>
      )}

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[35vh] overflow-hidden group focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
          <div className="flex justify-between px-4 py-2 bg-gray-50 border-b">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-500 flex items-center gap-2"><Monitor className="w-4 h-4" /> <span>Text</span></h2>
              {lastUpdated && <span className="text-xs text-slate-400">Updated {lastUpdated.toLocaleTimeString()}</span>}
            </div>
            <button onClick={() => robustCopy(text).then(s => s && showToast("Text copied!"))}
              className="text-sm px-3 py-1 rounded-md bg-white border border-gray-200 hover:bg-blue-50 text-blue-600 transition-colors flex items-center gap-1">
              <Copy className="w-3 h-3" /> <span>Copy</span>
            </button>
          </div>
          <textarea value={text} onChange={handleTextChange} placeholder="Type to sync..." className="flex-1 p-4 resize-none outline-none text-slate-700 leading-relaxed" spellCheck="false" />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2"><UploadCloud className="w-5 h-5 text-blue-600" /> Shared Files ({files.length})</h2>
            {files.length > 0 && (
              <button onClick={handleClear} className="text-xs text-red-500 hover:underline">Clear All</button>
            )}
          </div>

          <label className="relative block border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-blue-50/50 hover:border-blue-400 cursor-pointer transition-all group">
            <input type="file" onChange={handleFileUpload} className="hidden" multiple />
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-blue-100 rounded-full group-hover:scale-110 transition-transform"><UploadCloud className="w-6 h-6 text-blue-600" /></div>
              <span className="font-medium text-slate-600">Click to upload files</span>
              <span className="text-xs text-slate-400">Max 100MB per file</span>
            </div>
            {Object.keys(activeUploads).length > 0 && (
              <div className="absolute inset-0 bg-white/95 flex flex-col items-center justify-center rounded-xl">
                {Object.entries(activeUploads).map(([name, progress]) => (
                  <div key={name} className="w-64 mb-2">
                    <div className="flex justify-between text-xs mb-1 text-slate-600"><span className="truncate max-w-[150px]">{name}</span> <span>{Math.round(progress)}%</span></div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5"><div className="bg-blue-600 h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }}></div></div>
                  </div>
                ))}
              </div>
            )}
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {files.map((file, idx) => (
              <div key={idx} className="bg-white p-3 rounded-lg border border-gray-200 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="bg-orange-100 p-2 rounded-lg text-orange-600"><FileText className="w-5 h-5" /></div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-slate-700 truncate max-w-[120px] sm:max-w-[150px]">{file.name}</div>
                    <div className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleDownload(file)} className="p-2 hover:bg-gray-100 rounded text-blue-600" title="Direct Download"><Download className="w-4 h-4" /></button>
                  <button onClick={() => handleDeleteFile(file)} className="p-2 hover:bg-gray-100 rounded text-red-500" title="Delete"><X className="w-4 h-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center pt-6">
          <button onClick={handleClear} className="flex items-center gap-2 px-5 py-2.5 text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-xl text-sm font-medium shadow-sm transition-all">
            <Trash2 className="w-4 h-4" /> <span>Wipe Room Data</span>
          </button>
        </div>
      </main>
    </div>
  );
}