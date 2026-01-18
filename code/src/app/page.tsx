"use client";

import { useState, useRef, useCallback } from "react";
import { Navbar } from "@/app/components/Navbar";
import { HeroSection } from "@/app/components/HeroSection";
import { SpeechAnalysisResults } from "@/app/components/SpeechAnalysisResults";
import { PDFAnalysisResults } from "@/app/components/PDFAnalysisResults";
import { useRouter } from "next/navigation";
import {
  analyzeAudio,
  analyzePDF,
  type AudioAnalysisResponse,
  type PDFAnalysisResponse,
} from "@/app/services/api";

type FileType = "audio" | "video" | "pdf";

type FileWithPreview = {
  file: File;
  id: string;
  type: FileType;
};

export default function Home() {
  const router = useRouter();

  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [audioResult, setAudioResult] = useState<AudioAnalysisResponse | null>(null);
  const [pdfResult, setPdfResult] = useState<PDFAnalysisResponse | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [currentAnalysisStep, setCurrentAnalysisStep] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // navbar
  const [isDark, setIsDark] = useState(true);

  const audioTypes = ["audio/mpeg", "audio/mp3", "audio/wav", "video/mp4"];
  const pdfTypes = ["application/pdf"];
  const audioExtensions = [".mp3", ".mp4", ".wav"];
  const pdfExtensions = [".pdf"];

  const validateFile = (file: File): boolean => {
    const isAudioType = audioTypes.includes(file.type);
    const isAudioExtension = audioExtensions.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );
    const isPdfType = pdfTypes.includes(file.type);
    const isPdfExtension = pdfExtensions.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );
    return isAudioType || isAudioExtension || isPdfType || isPdfExtension;
  };

  const getFileType = (file: File): FileType => {
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      return "pdf";
    }
    if (file.type.startsWith("audio/") || file.name.toLowerCase().endsWith(".mp3") || file.name.toLowerCase().endsWith(".wav")) {
      return "audio";
    }
    return "video";
  };

  const handleFiles = useCallback((fileList: FileList) => {
    const newFiles: FileWithPreview[] = [];

    Array.from(fileList).forEach((file) => {
      if (validateFile(file)) {
        const fileType = getFileType(file);
        // Check if we already have a file of this category (audio/video or pdf)
        const existingAudioVideo = files.find(f => f.type === "audio" || f.type === "video");
        const existingPdf = files.find(f => f.type === "pdf");

        // Only add if we don't already have a file of this category
        if ((fileType === "pdf" && !existingPdf) ||
            ((fileType === "audio" || fileType === "video") && !existingAudioVideo)) {
          newFiles.push({
            file,
            id: `${file.name}-${Date.now()}-${Math.random()}`,
            type: fileType,
          });
        }
      }
    });

    if (newFiles.length > 0) {
      setFiles((prev) => [...prev, ...newFiles]);
      setAnalysisComplete(false);
      setAudioResult(null);
      setPdfResult(null);
    }
  }, [files]);

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

  // Get files by category
  const audioVideoFile = files.find(f => f.type === "audio" || f.type === "video");
  const pdfFile = files.find(f => f.type === "pdf");

  const handleAnalyze = async () => {
    if (files.length === 0) return;

    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisProgress(0);
    setAudioResult(null);
    setPdfResult(null);

    try {
      const totalSteps = (audioVideoFile ? 1 : 0) + (pdfFile ? 1 : 0);
      let completedSteps = 0;

      // Analyze audio/video if present
      if (audioVideoFile) {
        setCurrentAnalysisStep("Analyzing speech...");

        // Simulate progress for audio
        const progressInterval = setInterval(() => {
          setAnalysisProgress((prev) => {
            const target = ((completedSteps + 0.9) / totalSteps) * 100;
            if (prev >= target) {
              clearInterval(progressInterval);
              return prev;
            }
            return prev + Math.random() * 10;
          });
        }, 300);

        const result = await analyzeAudio(audioVideoFile.file);
        clearInterval(progressInterval);
        setAudioResult(result);
        completedSteps++;
        setAnalysisProgress((completedSteps / totalSteps) * 100);
      }

      // Analyze PDF if present
      if (pdfFile) {
        setCurrentAnalysisStep("Analyzing slide deck...");

        // Simulate progress for PDF
        const progressInterval = setInterval(() => {
          setAnalysisProgress((prev) => {
            const target = ((completedSteps + 0.9) / totalSteps) * 100;
            if (prev >= target) {
              clearInterval(progressInterval);
              return prev;
            }
            return prev + Math.random() * 10;
          });
        }, 300);

        const result = await analyzePDF(pdfFile.file);
        clearInterval(progressInterval);
        setPdfResult(result);
        completedSteps++;
        setAnalysisProgress(100);
      }

      setAnalysisComplete(true);
    } catch (error) {
      console.error("Analysis failed:", error);
      setAnalysisError(
        error instanceof Error
          ? error.message
          : "Failed to analyze the file. Please try again."
      );
    } finally {
      setIsAnalyzing(false);
      setCurrentAnalysisStep("");
    }
  };

  const handleReset = () => {
    setFiles([]);
    setTitle("");
    setDescription("");
    setAnalysisComplete(false);
    setAudioResult(null);
    setPdfResult(null);
    setAnalysisError(null);
    setAnalysisProgress(0);
  };

  const getFileIcon = (type: FileType) => {
    if (type === "pdf") {
      return (
        <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    }
    if (type === "audio") {
      return (
        <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      );
    }
    return (
      <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    );
  };

  const getFileTypeLabel = (type: FileType) => {
    if (type === "pdf") return "Slide Deck";
    if (type === "audio") return "Audio";
    return "Video";
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pt-24">
      {/* Navbar */}
      <Navbar
        brandName="Pitch Perfect"
        navItems={[
          { label: "Home", onClick: () => router.push("/") },
          { label: "About", onClick: () => router.push("/") },
          { label: "Analyze", onClick: () => router.push("/") },
          { label: "Login", onClick: () => router.push("/") },
        ]}
        onThemeToggle={() => setIsDark(!isDark)}
        isDarkMode={isDark}
      />

      {/* Hero Section */}
      <HeroSection />

      {/* Main Content */}
      <main id="analyze" className="max-w-4xl mx-auto px-6 py-10">
        <div className="animate-fade-in">
          {/* Title Section */}
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-[var(--text-primary)] mb-3">
              Analyze Your Presentation
            </h2>
            <p className="text-[var(--text-secondary)] max-w-xl mx-auto">
              Upload your audio recording, slide deck, or both to receive comprehensive
              AI-powered feedback on your presentation.
            </p>
          </div>

          {/* Form Container */}
          <div className="space-y-8">
            {/* Step 1: Upload Section */}
            <section className="animate-fade-in-delay-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[var(--accent-blue)] to-purple-500 flex items-center justify-center text-sm font-semibold text-white">
                  1
                </div>
                <h3 className="text-lg font-medium text-[var(--text-primary)]">
                  Upload your files
                </h3>
              </div>

              {/* Upload Areas Container */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Audio/Video Dropzone */}
                <div
                  onClick={() => {
                    if (!audioVideoFile) {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '.mp3,.mp4,.wav,audio/mpeg,audio/wav,video/mp4';
                      input.onchange = (e) => {
                        const files = (e.target as HTMLInputElement).files;
                        if (files) handleFiles(files);
                      };
                      input.click();
                    }
                  }}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`
                    relative rounded-xl border-2 border-dashed transition-all duration-200 p-6
                    ${audioVideoFile
                      ? "border-green-500/50 bg-green-500/5 cursor-default"
                      : isDragging
                        ? "border-[var(--accent-blue)] bg-[var(--accent-blue-subtle)] cursor-pointer"
                        : "border-[var(--border-secondary)] bg-[var(--bg-secondary)] hover:border-[var(--border-focus)] hover:bg-[var(--bg-tertiary)] cursor-pointer"
                    }
                  `}
                >
                  {audioVideoFile ? (
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        audioVideoFile.type === "audio" ? "bg-purple-500/10" : "bg-blue-500/10"
                      }`}>
                        {getFileIcon(audioVideoFile.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[var(--text-primary)] font-medium truncate text-sm">
                          {audioVideoFile.file.name}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">
                          {formatFileSize(audioVideoFile.file.size)} • {getFileTypeLabel(audioVideoFile.type)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(audioVideoFile.id);
                        }}
                        className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--error)] hover:bg-[var(--error-subtle)] transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="mx-auto w-12 h-12 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mb-3">
                        <svg className="w-6 h-6 text-[var(--accent-blue)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                        </svg>
                      </div>
                      <p className="text-[var(--text-primary)] font-medium text-sm mb-1">
                        Speech Recording
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        MP3, WAV, or MP4
                      </p>
                      <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                        Optional
                      </span>
                    </div>
                  )}
                </div>

                {/* PDF Dropzone */}
                <div
                  onClick={() => {
                    if (!pdfFile) {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '.pdf,application/pdf';
                      input.onchange = (e) => {
                        const files = (e.target as HTMLInputElement).files;
                        if (files) handleFiles(files);
                      };
                      input.click();
                    }
                  }}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`
                    relative rounded-xl border-2 border-dashed transition-all duration-200 p-6
                    ${pdfFile
                      ? "border-green-500/50 bg-green-500/5 cursor-default"
                      : isDragging
                        ? "border-purple-500 bg-purple-500/10 cursor-pointer"
                        : "border-[var(--border-secondary)] bg-[var(--bg-secondary)] hover:border-[var(--border-focus)] hover:bg-[var(--bg-tertiary)] cursor-pointer"
                    }
                  `}
                >
                  {pdfFile ? (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                        {getFileIcon(pdfFile.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[var(--text-primary)] font-medium truncate text-sm">
                          {pdfFile.file.name}
                        </p>
                        <p className="text-xs text-[var(--text-tertiary)]">
                          {formatFileSize(pdfFile.file.size)} • Slide Deck
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(pdfFile.id);
                        }}
                        className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--error)] hover:bg-[var(--error-subtle)] transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="mx-auto w-12 h-12 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center mb-3">
                        <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-[var(--text-primary)] font-medium text-sm mb-1">
                        Slide Deck
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        PDF files
                      </p>
                      <span className="inline-block mt-2 text-xs px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
                        Optional
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Hidden file input for drag and drop */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,.mp4,.wav,.pdf,audio/mpeg,audio/wav,video/mp4,application/pdf"
                multiple
                onChange={handleFileInput}
                className="hidden"
              />

              {/* Upload Status */}
              {files.length > 0 && (
                <div className="mt-4 flex items-center gap-2 text-sm">
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-[var(--text-secondary)]">
                    {files.length === 1
                      ? `1 file ready`
                      : `${files.length} files ready`}
                    {audioVideoFile && pdfFile && (
                      <span className="text-[var(--text-muted)]"> (speech + slides)</span>
                    )}
                  </span>
                </div>
              )}
            </section>

            {/* Step 2: Details Section */}
            <section className="animate-fade-in-delay-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[var(--accent-blue)] to-purple-500 flex items-center justify-center text-sm font-semibold text-white">
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
                    placeholder="e.g., Q4 Sales Pitch, Product Demo, Company Overview"
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
                    placeholder="e.g., I want to improve my pacing, make slides clearer, and ensure my key points are memorable..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] focus:ring-1 focus:ring-[var(--accent-blue)] transition-colors resize-none"
                  />
                </div>
              </div>
            </section>

            {/* Step 3: Analyze Section */}
            <section className="animate-fade-in-delay-3">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[var(--accent-blue)] to-purple-500 flex items-center justify-center text-sm font-semibold text-white">
                  3
                </div>
                <h3 className="text-lg font-medium text-[var(--text-primary)]">
                  Get your analysis
                </h3>
              </div>

              {/* What will be analyzed info */}
              {!analysisComplete && !isAnalyzing && files.length > 0 && (
                <div className="mb-4 p-4 rounded-lg border bg-gradient-to-r from-[var(--accent-blue)]/10 to-purple-500/10 border-[var(--accent-blue)]/20">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 mt-0.5 text-[var(--accent-blue)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-[var(--text-secondary)] space-y-2">
                      <p className="font-medium text-[var(--text-primary)]">What you&apos;ll receive:</p>
                      <ul className="space-y-1">
                        {audioVideoFile && (
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-blue)]"></span>
                            <strong>Speech Analysis:</strong> Pace, filler words, volume consistency, and AI feedback
                          </li>
                        )}
                        {pdfFile && (
                          <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                            <strong>Slide Analysis:</strong> Content structure, text density, clarity, and AI suggestions
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* Error State */}
              {analysisError && (
                <div className="mb-4 bg-[var(--error-subtle)] border border-[var(--error)]/30 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <svg
                      className="w-5 h-5 text-[var(--error)]"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <p className="text-[var(--error)] text-sm flex-1">{analysisError}</p>
                    <button
                      onClick={() => setAnalysisError(null)}
                      className="p-1 rounded hover:bg-[var(--error)]/10 transition-colors"
                    >
                      <svg
                        className="w-4 h-4 text-[var(--error)]"
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
                </div>
              )}

              {/* Analysis In Progress */}
              {isAnalyzing && (
                <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] p-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <svg
                          className="animate-spin w-10 h-10 text-[var(--accent-blue)]"
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
                      </div>
                      <div className="flex-1">
                        <p className="text-[var(--text-primary)] font-medium">
                          {currentAnalysisStep || "Preparing analysis..."}
                        </p>
                        <p className="text-sm text-[var(--text-tertiary)]">
                          {audioVideoFile && pdfFile
                            ? "Analyzing speech and slides..."
                            : audioVideoFile
                              ? "Transcribing and analyzing speech patterns..."
                              : "Extracting and analyzing slide content..."}
                        </p>
                      </div>
                    </div>
                    <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[var(--accent-blue)] to-purple-500 transition-all duration-300 ease-out"
                        style={{ width: `${Math.min(analysisProgress, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-[var(--text-muted)]">
                      <span>
                        {audioVideoFile && pdfFile
                          ? `Processing ${files.length} files`
                          : `Processing ${files[0]?.file.name}`}
                      </span>
                      <span>{Math.round(analysisProgress)}%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Ready to Analyze State */}
              {!analysisComplete && !isAnalyzing && (
                <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] p-6">
                  <div className="flex flex-col sm:flex-row items-center gap-4">
                    <div className="flex-1 text-center sm:text-left">
                      <p className="text-[var(--text-secondary)]">
                        {files.length === 0
                          ? "Upload at least one file to start analysis"
                          : `Ready to analyze ${files.length === 1 ? "your file" : "your files"}`}
                      </p>
                    </div>
                    <button
                      onClick={handleAnalyze}
                      disabled={files.length === 0 || isAnalyzing}
                      className={`
                        relative px-8 py-3 rounded-lg font-semibold transition-all duration-200 flex items-center gap-2
                        ${
                          files.length > 0 && !isAnalyzing
                            ? "bg-gradient-to-r from-[var(--accent-blue)] to-purple-500 text-white hover:opacity-90 shadow-[0_0_20px_rgba(59,130,246,0.3)]"
                            : "bg-[var(--bg-tertiary)] text-[var(--text-muted)] cursor-not-allowed"
                        }
                      `}
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
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                      Analyze Presentation
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Analysis Results */}
            {analysisComplete && (audioResult || pdfResult) && (
              <section className="mt-8 space-y-8">
                {/* Results Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold text-[var(--text-primary)]">
                      Analysis Results
                    </h3>
                    <p className="text-sm text-[var(--text-tertiary)]">
                      {audioResult && pdfResult
                        ? "Speech and slide deck analysis complete"
                        : audioResult
                          ? "Speech analysis complete"
                          : "Slide deck analysis complete"}
                    </p>
                  </div>
                  <button
                    onClick={handleReset}
                    className="px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors text-sm font-medium flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    New Analysis
                  </button>
                </div>

                {/* Speech Results */}
                {audioResult && (
                  <div>
                    {pdfResult && (
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-6 h-6 rounded-full bg-[var(--accent-blue)]/20 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-[var(--accent-blue)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                          </svg>
                        </div>
                        <h4 className="text-lg font-medium text-[var(--text-primary)]">Speech Analysis</h4>
                      </div>
                    )}
                    <SpeechAnalysisResults data={audioResult} onReset={handleReset} />
                  </div>
                )}

                {/* PDF Results */}
                {pdfResult && (
                  <div>
                    {audioResult && (
                      <div className="flex items-center gap-2 mb-4 mt-8">
                        <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <h4 className="text-lg font-medium text-[var(--text-primary)]">Slide Deck Analysis</h4>
                      </div>
                    )}
                    <PDFAnalysisResults data={pdfResult} onReset={handleReset} />
                  </div>
                )}
              </section>
            )}
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
