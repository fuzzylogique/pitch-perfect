"use client";

import { useState, useRef, useCallback } from "react";

type FileWithPreview = {
  file: File;
  id: string;
  type: "audio" | "video";
};

export default function Home() {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptedTypes = ["audio/mpeg", "audio/mp3", "video/mp4"];
  const acceptedExtensions = [".mp3", ".mp4"];

  const validateFile = (file: File): boolean => {
    const isValidType = acceptedTypes.includes(file.type);
    const isValidExtension = acceptedExtensions.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );
    return isValidType || isValidExtension;
  };

  const getFileType = (file: File): "audio" | "video" => {
    if (file.type.startsWith("audio/") || file.name.toLowerCase().endsWith(".mp3")) {
      return "audio";
    }
    return "video";
  };

  const handleFiles = useCallback((fileList: FileList) => {
    const newFiles: FileWithPreview[] = [];

    Array.from(fileList).forEach((file) => {
      if (validateFile(file)) {
        newFiles.push({
          file,
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          type: getFileType(file),
        });
      }
    });

    if (newFiles.length > 0) {
      setFiles((prev) => [...prev, ...newFiles]);
      setAnalysisComplete(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleAnalyze = async () => {
    if (files.length === 0) return;

    setIsAnalyzing(true);

    // Simulate analysis
    await new Promise((resolve) => setTimeout(resolve, 2500));

    setIsAnalyzing(false);
    setAnalysisComplete(true);
  };

  const handleReset = () => {
    setFiles([]);
    setTitle("");
    setDescription("");
    setAnalysisComplete(false);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
        <div className="max-w-4xl mx-auto px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--accent-blue)] flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[var(--text-primary)]">
                Pitch Perfect
              </h1>
              <p className="text-sm text-[var(--text-tertiary)]">
                AI-powered presentation coach
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="animate-fade-in">
          {/* Title Section */}
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-3">
              Analyze Your Pitch
            </h2>
            <p className="text-[var(--text-secondary)] max-w-xl mx-auto">
              Upload your audio or video presentation and receive AI-powered
              feedback to improve your delivery, clarity, and impact.
            </p>
          </div>

          {/* Form Container */}
          <div className="space-y-8">
            {/* Step 1: Upload Section */}
            <section className="animate-fade-in-delay-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-[var(--accent-blue)] flex items-center justify-center text-sm font-semibold text-white">
                  1
                </div>
                <h3 className="text-lg font-medium text-[var(--text-primary)]">
                  Upload your presentation
                </h3>
              </div>

              {/* Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                  relative cursor-pointer rounded-xl border-2 border-dashed
                  transition-all duration-200 p-10
                  ${
                    isDragging
                      ? "border-[var(--accent-blue)] bg-[var(--accent-blue-subtle)]"
                      : "border-[var(--border-secondary)] bg-[var(--bg-secondary)] hover:border-[var(--border-focus)] hover:bg-[var(--bg-tertiary)]"
                  }
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp3,.mp4,audio/mpeg,video/mp4"
                  multiple
                  onChange={handleFileInput}
                  className="hidden"
                />

                <div className="text-center">
                  <div
                    className={`
                    mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors
                    ${isDragging ? "bg-[var(--accent-blue)]" : "bg-[var(--bg-tertiary)]"}
                  `}
                  >
                    <svg
                      className={`w-8 h-8 ${isDragging ? "text-white" : "text-[var(--text-tertiary)]"}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>

                  <p className="text-[var(--text-primary)] font-medium mb-1">
                    {isDragging ? "Drop your files here" : "Click to upload or drag and drop"}
                  </p>
                  <p className="text-sm text-[var(--text-tertiary)]">
                    MP3 or MP4 files supported
                  </p>
                </div>
              </div>

              {/* File List */}
              {files.length > 0 && (
                <div className="mt-4 space-y-3">
                  {files.map((fileItem) => (
                    <div
                      key={fileItem.id}
                      className="flex items-center gap-4 p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-primary)]"
                    >
                      {/* File Icon */}
                      <div
                        className={`
                        w-12 h-12 rounded-lg flex items-center justify-center
                        ${fileItem.type === "audio" ? "bg-purple-500/10" : "bg-blue-500/10"}
                      `}
                      >
                        {fileItem.type === "audio" ? (
                          <svg
                            className="w-6 h-6 text-purple-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-6 h-6 text-blue-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                        )}
                      </div>

                      {/* File Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[var(--text-primary)] font-medium truncate">
                          {fileItem.file.name}
                        </p>
                        <p className="text-sm text-[var(--text-tertiary)]">
                          {formatFileSize(fileItem.file.size)} •{" "}
                          {fileItem.type === "audio" ? "Audio" : "Video"}
                        </p>
                      </div>

                      {/* Remove Button */}
                      <button
                        onClick={() => removeFile(fileItem.id)}
                        className="p-2 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--error)] hover:bg-[var(--error-subtle)] transition-colors"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Step 2: Details Section */}
            <section className="animate-fade-in-delay-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-[var(--accent-blue)] flex items-center justify-center text-sm font-semibold text-white">
                  2
                </div>
                <h3 className="text-lg font-medium text-[var(--text-primary)]">
                  Add context (optional)
                </h3>
              </div>

              <div className="space-y-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] p-6">
                {/* Title Input */}
                <div>
                  <label
                    htmlFor="title"
                    className="block text-sm font-medium text-[var(--text-secondary)] mb-2"
                  >
                    Presentation Title
                  </label>
                  <input
                    id="title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Q4 Sales Pitch, Product Demo"
                    className="w-full px-4 py-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] focus:ring-1 focus:ring-[var(--accent-blue)] transition-colors"
                  />
                </div>

                {/* Description Input */}
                <div>
                  <label
                    htmlFor="description"
                    className="block text-sm font-medium text-[var(--text-secondary)] mb-2"
                  >
                    What would you like feedback on?
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g., I want to improve my pacing and make my key points more memorable..."
                    rows={4}
                    className="w-full px-4 py-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] focus:ring-1 focus:ring-[var(--accent-blue)] transition-colors resize-none"
                  />
                </div>
              </div>
            </section>

            {/* Step 3: Analyze Section */}
            <section className="animate-fade-in-delay-3">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-[var(--accent-blue)] flex items-center justify-center text-sm font-semibold text-white">
                  3
                </div>
                <h3 className="text-lg font-medium text-[var(--text-primary)]">
                  Get your analysis
                </h3>
              </div>

              {/* Analysis Complete State */}
              {analysisComplete ? (
                <div className="bg-[var(--success-subtle)] border border-[var(--success)]/30 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-[var(--success)] flex items-center justify-center flex-shrink-0">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-lg font-semibold text-[var(--success)] mb-2">
                        Analysis Complete!
                      </h4>
                      <p className="text-[var(--text-secondary)] mb-4">
                        Your presentation has been analyzed. Check your results below
                        to see personalized feedback and suggestions for improvement.
                      </p>
                      <button
                        onClick={handleReset}
                        className="px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors text-sm font-medium"
                      >
                        Analyze Another
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] p-6">
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="flex-1 text-center sm:text-left">
                      <p className="text-[var(--text-secondary)]">
                        {files.length === 0
                          ? "Upload at least one file to start analysis"
                          : `${files.length} file${files.length > 1 ? "s" : ""} ready for analysis`}
                      </p>
                    </div>
                    <button
                      onClick={handleAnalyze}
                      disabled={files.length === 0 || isAnalyzing}
                      className={`
                        relative px-8 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2
                        ${
                          files.length > 0 && !isAnalyzing
                            ? "bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue-hover)] animate-pulse-glow"
                            : "bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed"
                        }
                      `}
                    >
                      {isAnalyzing ? (
                        <>
                          <svg
                            className="animate-spin w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13 10V3L4 14h7v7l9-11h-7z"
                            />
                          </svg>
                          Analyze Presentation
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border-primary)] mt-auto">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <p className="text-center text-sm text-[var(--text-muted)]">
            Pitch Perfect • AI-powered presentation coaching
          </p>
        </div>
      </footer>
    </div>
  );
}
