import React, { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore, doc, onSnapshot, setDoc, initializeFirestore, enableNetwork, disableNetwork
} from "firebase/firestore";
import {
  getStorage, ref, uploadBytes, getDownloadURL, deleteObject // Changed to uploadBytes
} from "firebase/storage";
import {
  Copy, Smartphone, Monitor, Zap, Download, Trash2,
  UploadCloud, CheckCircle, Wifi, WifiOff, ArrowRight, Loader2, RefreshCw, AlertTriangle
} from "lucide-react";

// --- ERROR BOUNDARY ---
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
          <p className="text-gray-600 mb-4">Please disable Google Translate on this page.</p>
          <button onClick={() => window.location.reload()} className="bg-blue-600 text-white px-6 py-2 rounded-lg">Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  // --- YOUR CONFIGURATION ---
  const firebaseConfig = {
    apiKey: "AIzaSyBwdWRjzCwqzk3X56SBcAdpFExAq5o6clw",
    authDomain: "sync-bridge-59a19.firebaseapp.com",
    projectId: "sync-bridge-59a19",
    // NOTE: If uploads still fail with 404, try changing this to: "sync-bridge-59a19.appspot.com"
    storageBucket: "sync-bridge-59a19.appspot.com",
    messagingSenderId: "774785880034",
    appId: "1:774785880034:web:76fe312ff23cb1d51233bb",
    measurementId: "G-8Q6LVMSKK7"
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = initializeFirestore(app, { experimentalForceLongPolling: true });
  const storage = getStorage(app);
  return { auth, db, storage };
};

const { auth, db, storage } = initFirebase();

// --- MAIN COMPONENTS ---

export default function AppWrapper() {
  return <ErrorBoundary><App /></ErrorBoundary>;
}

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("landing");
  const [roomCode, setRoomCode] = useState("");
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    signInAnonymously(auth).catch((e) => console.warn("Auth failed/offline", e));

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

  const startSession = (code) => {
    setRoomCode(code);
    setView("session");
  };

  if (isOffline) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-6 text-center">
        <WifiOff className="w-12 h-12 text-red-400 mb-4" />
        <h2 className="text-xl font-bold"><span>No Internet Connection</span></h2>
        <button onClick={() => window.location.reload()} className="mt-6 flex items-center gap-2 bg-blue-600 px-4 py-2 rounded-lg">
          <RefreshCw className="w-4 h-4" /> <span>Retry</span>
        </button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        <p className="animate-pulse"><span>Initializing Secure Bridge...</span></p>
      </div>
    );
  }

  return view === "landing" ? (
    <LandingView onJoin={startSession} />
  ) : (
    <SessionView user={user} roomCode={roomCode} onExit={() => setView("landing")} />
  );
}

function LandingView({ onJoin }) {
  const [inputCode, setInputCode] = useState("");

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex p-4 rounded-full bg-blue-500/10 ring-1 ring-blue-500/50 mb-2">
            <Zap className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
            <span>SyncBridge Pro</span>
          </h1>
          <p className="text-slate-400"><span>Share text & files globally.</span></p>
        </div>

        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-sm space-y-6">
          <button onClick={() => onJoin(generateRoomCode())}
            className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-900/20">
            <Monitor className="w-5 h-5" /> <span>Start New Session</span>
          </button>

          <div className="relative text-center">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700"></div></div>
            <span className="relative px-2 bg-slate-800 text-slate-500 text-sm"><span>OR JOIN</span></span>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); if (inputCode.length === 6) onJoin(inputCode); }} className="space-y-4">
            <input
              type="text" maxLength={6} placeholder="Enter 6-digit Code" value={inputCode}
              onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-slate-900/50 border border-slate-700 text-white text-center text-2xl tracking-widest py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button type="submit" disabled={inputCode.length !== 6}
              className="w-full flex items-center justify-center gap-2 bg-slate-700 disabled:opacity-50 hover:bg-slate-600 text-white font-medium py-3 rounded-xl transition-all">
              <Smartphone className="w-5 h-5" /> <span>Join Existing</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function SessionView({ user, roomCode, onExit }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("idle");
  const [connected, setConnected] = useState(false);
  const [fileData, setFileData] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const debounceRef = useRef(null);
  const docRef = doc(db, "sync_rooms", roomCode);

  useEffect(() => {
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      setConnected(true);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.lastSender !== user.uid) {
          if (data.text !== undefined) setText(data.text);
          setFileData(data.file || null);
        }
      } else {
        setText("");
        setFileData(null);
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
      setDoc(docRef, { text: val, lastSender: user.uid }, { merge: true }).then(() => setStatus("idle"));
    }, 500);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) { alert("File too large. Max 100MB."); return; }

    setStatus("uploading");

    // Create a safe filename
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storageRef = ref(storage, `uploads/${roomCode}/${Date.now()}_${safeName}`);

    try {
      // 1. Upload
      const snapshot = await uploadBytes(storageRef, file);

      // 2. Get URL
      const downloadURL = await getDownloadURL(snapshot.ref);

      // 3. Save Metadata
      await setDoc(docRef, {
        file: { name: file.name, type: file.type, url: downloadURL, fullPath: storageRef.fullPath },
        lastSender: user.uid
      }, { merge: true });

      setFileData({ name: file.name, type: file.type, url: downloadURL, fullPath: storageRef.fullPath });
      setStatus("idle");
    } catch (error) {
      console.error("Upload Error:", error);
      setStatus("error");
      // Specific error messaging
      if (error.code === 'storage/unauthorized') {
        alert("Permission Denied. Check Firebase Storage Rules.");
      } else if (error.code === 'storage/object-not-found') {
        alert("Bucket mismatch. Check storageBucket in config.");
      } else {
        alert("Upload failed. See console.");
      }
    }
  };

  const handleClear = async () => {
    if (!window.confirm("Clear all data?")) return;
    setStatus("syncing");
    if (fileData?.fullPath) {
      try { await deleteObject(ref(storage, fileData.fullPath)); } catch (e) { console.warn(e); }
    }
    await setDoc(docRef, { text: "", file: null, lastSender: user.uid });
    setText("");
    setFileData(null);
    setStatus("idle");
  };

  return (
    <div className="min-h-screen bg-gray-50 text-slate-800 font-sans flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onExit} className="p-2 hover:bg-gray-100 rounded-lg text-slate-500"><ArrowRight className="w-5 h-5 rotate-180" /></button>
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider"><span>Room Code</span></div>
            <div className="text-xl font-mono font-bold text-slate-800"><span>{roomCode}</span></div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full">
          {connected ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
          <span className="text-xs font-medium text-slate-600">
            <span>{status === "uploading" ? "Uploading..." : status === "syncing" ? "Syncing..." : connected ? "Live" : "Offline"}</span>
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-4 space-y-4">
        {/* Text Area */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[40vh] overflow-hidden">
          <div className="flex justify-between px-4 py-2 bg-gray-50 border-b">
            <h2 className="text-sm font-semibold text-slate-500 flex items-center gap-2"><Monitor className="w-4 h-4" /> <span>Text</span></h2>
            <button onClick={() => robustCopy(text).then(s => { if (s) { setCopyFeedback(true); setTimeout(() => setCopyFeedback(false), 2000); } })}
              className={`text-sm px-3 py-1 rounded-md transition-colors flex items-center gap-1 ${copyFeedback ? "bg-green-100 text-green-700" : "bg-white border hover:bg-gray-50 text-blue-600"}`}>
              {copyFeedback ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />} <span>{copyFeedback ? "Copied" : "Copy"}</span>
            </button>
          </div>
          <textarea value={text} onChange={handleTextChange} placeholder="Type to sync..." className="flex-1 p-4 resize-none outline-none text-slate-700" spellCheck="false" />
        </div>

        {/* File Area */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex justify-between px-4 py-2 bg-gray-50 border-b">
            <h2 className="text-sm font-semibold text-slate-500 flex items-center gap-2"><UploadCloud className="w-4 h-4" /> <span>File (Max 100MB)</span></h2>
          </div>
          <div className="p-6">
            {status === "uploading" ? (
              <div className="flex flex-col items-center justify-center py-6 text-blue-600 animate-pulse">
                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                <span className="text-sm font-medium">Uploading to Cloud...</span>
              </div>
            ) : !fileData ? (
              <label className="block border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 cursor-pointer transition-colors group">
                <input type="file" onChange={handleFileUpload} className="hidden" />
                <UploadCloud className="w-10 h-10 mx-auto mb-2 text-slate-300 group-hover:text-blue-500 transition-colors" />
                <span className="text-slate-500 group-hover:text-slate-700"><span>Click to upload large file</span></span>
              </label>
            ) : (
              <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="bg-blue-200 p-2 rounded-lg"><Download className="w-5 h-5 text-blue-700" /></div>
                  <div className="truncate">
                    <div className="font-medium text-slate-700 truncate"><span>{fileData.name}</span></div>
                    <div className="text-xs text-slate-500"><span>{fileData.type}</span></div>
                  </div>
                </div>
                <a href={fileData.url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg whitespace-nowrap"><span>Download</span></a>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={handleClear} className="flex items-center gap-2 px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-medium"><Trash2 className="w-4 h-4" /> <span>Clear Room</span></button>
        </div>
      </main>
    </div>
  );
}