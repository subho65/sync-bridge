import React, { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "firebase/auth";
import {
  getFirestore,
  doc,
  onSnapshot,
  setDoc,
  initializeFirestore
} from "firebase/firestore";
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from "firebase/storage";
import {
  Copy, Smartphone, Monitor, Zap, Download, Trash2,
  UploadCloud, CheckCircle, Wifi, WifiOff, ArrowRight, Loader2
} from "lucide-react";

// --- CONFIGURATION & UTILS ---

const robustCopy = async (text) => {
  if (!text) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    throw new Error("Clipboard API unavailable");
  } catch (err) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-9999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  }
};

const generateRoomCode = () => Math.floor(100000 + Math.random() * 900000).toString();

// --- FIREBASE INITIALIZATION ---

const initFirebase = () => {
  // -----------------------------------------------------------
  // PASTE YOUR FIREBASE CONFIG HERE AGAIN
  // Ensure 'storageBucket' is present in this object!
  // -----------------------------------------------------------
  const firebaseConfig = {
    apiKey: "AIzaSyBwdWRjzCwqzk3X56SBcAdpFExAq5o6clw",
    authDomain: "sync-bridge-59a19.firebaseapp.com",
    projectId: "sync-bridge-59a19",
    storageBucket: "sync-bridge-59a19.firebasestorage.app",
    messagingSenderId: "774785880034",
    appId: "1:774785880034:web:76fe312ff23cb1d51233bb",
    measurementId: "G-8Q6LVMSKK7"
  };

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  // Force Long Polling for preview/local compatibility
  const db = initializeFirestore(app, { experimentalForceLongPolling: true });
  const storage = getStorage(app);

  return { auth, db, storage };
};

const { auth, db, storage } = initFirebase();

// --- COMPONENTS ---

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("landing");
  const [roomCode, setRoomCode] = useState("");

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    return onAuthStateChanged(auth, setUser);
  }, []);

  const startSession = (code) => {
    setRoomCode(code);
    setView("session");
  };

  if (!user) return <LoadingScreen />;

  return view === "landing" ? (
    <LandingView onJoin={startSession} />
  ) : (
    <SessionView user={user} roomCode={roomCode} onExit={() => setView("landing")} />
  );
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4">
      <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      <p className="animate-pulse">Initializing Secure Bridge...</p>
    </div>
  );
}

// --- LANDING VIEW ---
function LandingView({ onJoin }) {
  const [inputCode, setInputCode] = useState("");

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex p-4 rounded-full bg-blue-500/10 ring-1 ring-blue-500/50 mb-2">
            <Zap className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">SyncBridge Pro</h1>
          <p className="text-slate-400">Share text & large files globally.</p>
        </div>

        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 backdrop-blur-sm space-y-6">
          <button onClick={() => onJoin(generateRoomCode())}
            className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-4 rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-900/20">
            <Monitor className="w-5 h-5" /> <span>Start New Session</span>
          </button>

          <div className="relative text-center">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-700"></div></div>
            <span className="relative px-2 bg-slate-800 text-slate-500 text-sm">OR JOIN</span>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); if (inputCode.length === 6) onJoin(inputCode); }} className="space-y-4">
            <input
              type="text" maxLength={6} placeholder="Enter 6-digit Code" value={inputCode}
              onChange={(e) => setInputCode(e.target.value.replace(/\D/g, ''))}
              className="w-full bg-slate-900/50 border border-slate-700 text-white text-center text-2xl tracking-widest py-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <button type="submit" disabled={inputCode.length !== 6}
              className="w-full flex items-center justify-center gap-2 bg-slate-700 disabled:opacity-50 hover:bg-slate-600 text-white font-medium py-3 rounded-xl transition-all">
              <Smartphone className="w-5 h-5" /> Join Existing
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// --- SESSION VIEW ---
function SessionView({ user, roomCode, onExit }) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState("idle");
  const [connected, setConnected] = useState(false);
  const [fileData, setFileData] = useState(null); // { name, type, url, fullPath }
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const debounceRef = useRef(null);
  const appId = "sync_v2"; // Unique bucket path
  const docRef = doc(db, `artifacts/${appId}/rooms/${roomCode}`);

  // Sync Logic
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

  // Text Handler
  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);
    setStatus("syncing");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDoc(docRef, { text: val, lastSender: user.uid }, { merge: true })
        .then(() => setStatus("idle"));
    }, 500);
  };

  // Large File Upload (Firebase Storage)
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 100 * 1024 * 1024) { // 100MB Limit
      alert("File too large. Max 100MB.");
      return;
    }

    setStatus("uploading");
    const storageRef = ref(storage, `uploads/${roomCode}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      },
      (error) => {
        console.error(error);
        setStatus("error");
        alert("Upload failed.");
      },
      async () => {
        // Upload complete
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        await setDoc(docRef, {
          file: {
            name: file.name,
            type: file.type,
            url: downloadURL,
            fullPath: storageRef.fullPath // Save path for deletion
          },
          lastSender: user.uid
        }, { merge: true });
        setFileData({ name: file.name, type: file.type, url: downloadURL, fullPath: storageRef.fullPath });
        setStatus("idle");
        setUploadProgress(0);
      }
    );
  };

  const handleClear = async () => {
    if (!window.confirm("Clear all data? This deletes the file permanently.")) return;
    setStatus("syncing");

    // 1. Delete file from Storage if exists
    if (fileData?.fullPath) {
      try {
        const fileRef = ref(storage, fileData.fullPath);
        await deleteObject(fileRef);
      } catch (err) {
        console.warn("File already deleted or permission denied", err);
      }
    }

    // 2. Clear Firestore
    await setDoc(docRef, { text: "", file: null, lastSender: user.uid });
    setText("");
    setFileData(null);
    setStatus("idle");
  };

  return (
    <div className="min-h-screen bg-gray-50 text-slate-800 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onExit} className="p-2 hover:bg-gray-100 rounded-lg text-slate-500"><ArrowRight className="w-5 h-5 rotate-180" /></button>
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Room Code</div>
            <div className="text-xl font-mono font-bold text-slate-800">{roomCode}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full">
          {connected ? <Wifi className="w-4 h-4 text-green-500" /> : <WifiOff className="w-4 h-4 text-red-500" />}
          <span className="text-xs font-medium text-slate-600">{status === "uploading" ? `Uploading ${Math.round(uploadProgress)}%` : status === "syncing" ? "Syncing..." : "Ready"}</span>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto p-4 space-y-4">
        {/* Text Area */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[40vh] overflow-hidden">
          <div className="flex justify-between px-4 py-2 bg-gray-50 border-b">
            <h2 className="text-sm font-semibold text-slate-500 flex items-center gap-2"><Monitor className="w-4 h-4" /> Text</h2>
            <button onClick={() => robustCopy(text).then(s => { if (s) { setCopyFeedback(true); setTimeout(() => setCopyFeedback(false), 2000); } })}
              className={`text-sm px-3 py-1 rounded-md transition-colors flex items-center gap-1 ${copyFeedback ? "bg-green-100 text-green-700" : "bg-white border hover:bg-gray-50 text-blue-600"}`}>
              {copyFeedback ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copyFeedback ? "Copied" : "Copy"}
            </button>
          </div>
          <textarea value={text} onChange={handleTextChange} placeholder="Type to sync..." className="flex-1 p-4 resize-none outline-none text-slate-700" spellCheck="false" />
        </div>

        {/* File Area */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex justify-between px-4 py-2 bg-gray-50 border-b">
            <h2 className="text-sm font-semibold text-slate-500 flex items-center gap-2"><UploadCloud className="w-4 h-4" /> File (Max 100MB)</h2>
          </div>
          <div className="p-6">
            {status === "uploading" ? (
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div className="bg-blue-500 h-4 transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
              </div>
            ) : !fileData ? (
              <label className="block border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:bg-gray-50 cursor-pointer transition-colors group">
                <input type="file" onChange={handleFileUpload} className="hidden" />
                <UploadCloud className="w-10 h-10 mx-auto mb-2 text-slate-300 group-hover:text-blue-500 transition-colors" />
                <span className="text-slate-500 group-hover:text-slate-700">Click to upload large file</span>
              </label>
            ) : (
              <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="bg-blue-200 p-2 rounded-lg"><Download className="w-5 h-5 text-blue-700" /></div>
                  <div className="truncate">
                    <div className="font-medium text-slate-700 truncate">{fileData.name}</div>
                    <div className="text-xs text-slate-500">{fileData.type}</div>
                  </div>
                </div>
                <a href={fileData.url} target="_blank" rel="noopener noreferrer" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg whitespace-nowrap">Download</a>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={handleClear} className="flex items-center gap-2 px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-medium"><Trash2 className="w-4 h-4" /> Clear Room</button>
        </div>
      </main>
    </div>
  );
}