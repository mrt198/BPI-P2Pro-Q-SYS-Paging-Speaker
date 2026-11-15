import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, FileCode2 } from 'lucide-react';

interface FirmwareFile {
  id: string;
  filename: string;
  description: string;
  content: string;
}

export const DeploymentTab: React.FC = () => {
  const [files, setFiles] = useState<FirmwareFile[]>([]);
  const [selectedId, setSelectedId] = useState<string>('qplug');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch('/api/firmware/files')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.files)) {
          setFiles(data.files);
        }
      })
      .catch(() => {});
  }, []);

  const activeFile = files.find((f) => f.id === selectedId) ?? files[0];

  const handleCopy = async () => {
    if (!activeFile) return;
    await navigator.clipboard.writeText(activeFile.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">
              Armbian SBC Firmware & Q-SYS Plugin Source Bundle
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Deploy the Lua plugin to Q-SYS Designer Core and run the installer script on your BananaPi BPI-P2Pro Armbian image.
            </p>
          </div>
          {activeFile && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-md bg-white text-slate-800 hover:bg-slate-50 whitespace-nowrap"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Source'}</span>
              </button>
              <a
                href={`/api/firmware/download/${activeFile.id}`}
                download={activeFile.filename}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download {activeFile.filename}</span>
              </a>
            </div>
          )}
        </div>

        {/* File Selector Tabs */}
        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-100 rounded-md">
          {files.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelectedId(f.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                selectedId === f.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-mono">{f.filename}</span>
            </button>
          ))}
        </div>

        {activeFile && (
          <div className="space-y-2">
            <div className="text-xs text-slate-600">{activeFile.description}</div>
            <pre className="bg-slate-950 text-slate-100 rounded-md p-4 text-xs font-mono overflow-x-auto max-h-[540px] leading-relaxed border border-slate-800">
              <code>{activeFile.content}</code>
            </pre>
          </div>
        )}
      </section>
    </div>
  );
};
