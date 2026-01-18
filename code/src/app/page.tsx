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

type AnalysisType = "audio" | "pdf";

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
  const [analysisType, setAnalysisType] = useState<AnalysisType>("audio");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // navbar
  const [isDark, setIsDark] = useState(true);

  const audioTypes = ["audio/mpeg", "audio/mp3", "audio/wav", "video/mp4"];
  const pdfTypes = ["application/pdf"];
  const audioExtensions = [".mp3", ".mp4", ".wav"];
  const pdfExtensions = [".pdf"];

  const validateFile = (file: File): boolean => {
    if (analysisType === "audio") {
      const isValidType = audioTypes.includes(file.type);
      const isValidExtension = audioExtensions.some((ext) =>
        file.name.toLowerCase().endsWith(ext)
      );
      return isValidType || isValidExtension;
    } else {
      const isValidType = pdfTypes.includes(file.type);
      const isValidExtension = pdfExtensions.some((ext) =>
        file.name.toLowerCase().endsWith(ext)
      );
      return isValidType || isValidExtension;
    }
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

  const handleFiles = useCallback(
    (fileList: FileList) => {
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
        setAudioResult(null);
        setPdfResult(null);
      }
    },
    [analysisType]
  );

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
    setAnalysisError(null);
    setAnalysisProgress(0);

    try {
      const fileToAnalyze = files[0].file;
      const fileType = files[0].type;

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setAnalysisProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + Math.random() * 15;
        });
      }, 500);

      if (fileType === "pdf") {
        const result = await analyzePDF(fileToAnalyze);
        clearInterval(progressInterval);
        setAnalysisProgress(100);
        setPdfResult(result);
        setAudioResult(null);
      } else {
        const result = await analyzeAudio(fileToAnalyze);
        clearInterval(progressInterval);
        setAnalysisProgress(100);
        setAudioResult(result);
        setPdfResult(null);
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

  const handleAnalysisTypeChange = (type: AnalysisType) => {
    if (type !== analysisType) {
      setAnalysisType(type);
      setFiles([]);
      setAnalysisComplete(false);
      setAudioResult(null);
      setPdfResult(null);
      setAnalysisError(null);
    }
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

  const getAcceptedFiles = () => {
    if (analysisType === "audio") {
      return ".mp3,.mp4,.wav,audio/mpeg,audio/wav,video/mp4";
    }
    return ".pdf,application/pdf";
  };

  const getAcceptedFormats = () => {
    if (analysisType === "audio") {
      return "MP3, WAV, or MP4 files supported";
    }
    return "PDF files supported";
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
              Upload your audio, video, or slide deck to receive AI-powered
              feedback and improve your presentation skills.
            </p>
          </div>

          {/* Analysis Type Toggle */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex rounded-xl bg-[var(--bg-secondary)] p-1.5 border border-[var(--border-primary)]">
              <button
                onClick={() => handleAnalysisTypeChange("audio")}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                  analysisType === "audio"
                    ? "bg-[var(--accent-blue)] text-white shadow-lg"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
                Speech Analysis
              </button>
              <button
                onClick={() => handleAnalysisTypeChange("pdf")}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
                  analysisType === "pdf"
                    ? "bg-purple-500 text-white shadow-lg"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Slide Deck Analysis
              </button>
            </div>
          </div>

          {/* Form Container */}
          <div className="space-y-8">
            {/* Step 1: Upload Section */}
            <section className="animate-fade-in-delay-1">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white ${
                  analysisType === "audio" ? "bg-[var(--accent-blue)]" : "bg-purple-500"
                }`}>
                  1
                </div>
                <h3 className="text-lg font-medium text-[var(--text-primary)]">
                  Upload your {analysisType === "audio" ? "presentation recording" : "slide deck"}
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
                      ? analysisType === "audio"
                        ? "border-[var(--accent-blue)] bg-[var(--accent-blue-subtle)]"
                        : "border-purple-500 bg-purple-500/10"
                      : "border-[var(--border-secondary)] bg-[var(--bg-secondary)] hover:border-[var(--border-focus)] hover:bg-[var(--bg-tertiary)]"
                  }
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={getAcceptedFiles()}
                  multiple
                  onChange={handleFileInput}
                  className="hidden"
                />

                <div className="text-center">
                  <div
                    className={`
                    mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors
                    ${
                      isDragging
                        ? analysisType === "audio"
                          ? "bg-[var(--accent-blue)]"
                          : "bg-purple-500"
                        : "bg-[var(--bg-tertiary)]"
                    }
                  `}
                  >
                    {analysisType === "audio" ? (
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
                          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                        />
                      </svg>
                    ) : (
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
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    )}
                  </div>

                  <p className="text-[var(--text-primary)] font-medium mb-1">
                    {isDragging
                      ? "Drop your files here"
                      : "Click to upload or drag and drop"}
                  </p>
                  <p className="text-sm text-[var(--text-tertiary)]">
                    {getAcceptedFormats()}
                  </p>
                </div>
              </div>

              {/* File List */}
              {files.length > 0 && (
                <div className="mt-4 space-y-3">
                  {files.map((fileItem) => (
                    <div
                      key={fileItem.id}
                      className={`flex items-center gap-4 p-4 rounded-lg bg-[var(--bg-secondary)] border ${
                        fileItem.type === "pdf"
                          ? "border-purple-500/30"
                          : "border-[var(--border-primary)]"
                      }`}
                    >
                      {/* File Icon */}
                      <div
                        className={`
                        w-12 h-12 rounded-lg flex items-center justify-center
                        ${
                          fileItem.type === "pdf"
                            ? "bg-red-500/10"
                            : fileItem.type === "audio"
                              ? "bg-purple-500/10"
                              : "bg-blue-500/10"
                        }
                      `}
                      >
                        {getFileIcon(fileItem.type)}
                      </div>

                      {/* File Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-[var(--text-primary)] font-medium truncate">
                          {fileItem.file.name}
                        </p>
                        <p className="text-sm text-[var(--text-tertiary)]">
                          {formatFileSize(fileItem.file.size)} •{" "}
                          {fileItem.type === "pdf"
                            ? "PDF Document"
                            : fileItem.type === "audio"
                              ? "Audio"
                              : "Video"}
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
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white ${
                  analysisType === "audio" ? "bg-[var(--accent-blue)]" : "bg-purple-500"
                }`}>
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
                    {analysisType === "audio" ? "Presentation Title" : "Slide Deck Title"}
                  </label>
                  <input
                    id="title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                      analysisType === "audio"
                        ? "e.g., Q4 Sales Pitch, Product Demo"
                        : "e.g., Company Overview, Product Roadmap"
                    }
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
                    placeholder={
                      analysisType === "audio"
                        ? "e.g., I want to improve my pacing and make my key points more memorable..."
                        : "e.g., I want to ensure my slides are clear and well-structured..."
                    }
                    rows={4}
                    className="w-full px-4 py-3 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-blue)] focus:ring-1 focus:ring-[var(--accent-blue)] transition-colors resize-none"
                  />
                </div>
              </div>
            </section>

            {/* Step 3: Analyze Section */}
            <section className="animate-fade-in-delay-3">
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white ${
                  analysisType === "audio" ? "bg-[var(--accent-blue)]" : "bg-purple-500"
                }`}>
                  3
                </div>
                <h3 className="text-lg font-medium text-[var(--text-primary)]">
                  Get your analysis
                </h3>
              </div>

              {/* Info Box */}
              {!analysisComplete && !isAnalyzing && files.length > 0 && (
                <div className={`mb-4 p-4 rounded-lg border ${
                  analysisType === "audio"
                    ? "bg-[var(--accent-blue)]/10 border-[var(--accent-blue)]/30"
                    : "bg-purple-500/10 border-purple-500/30"
                }`}>
                  <div className="flex items-start gap-3">
                    <svg className={`w-5 h-5 mt-0.5 ${analysisType === "audio" ? "text-[var(--accent-blue)]" : "text-purple-400"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-[var(--text-secondary)]">
                      {analysisType === "audio" ? (
                        <p>Your audio will be analyzed for <strong>pace</strong>, <strong>filler words</strong>, <strong>volume consistency</strong>, and you&apos;ll receive <strong>AI-powered feedback</strong> to improve your delivery.</p>
                      ) : (
                        <p>Your slide deck will be analyzed for <strong>content structure</strong>, <strong>text density</strong>, <strong>clarity</strong>, and you&apos;ll receive <strong>AI-powered suggestions</strong> for improvement.</p>
                      )}
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
                          className={`animate-spin w-10 h-10 ${analysisType === "audio" ? "text-[var(--accent-blue)]" : "text-purple-500"}`}
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
                          {analysisType === "audio"
                            ? "Analyzing your presentation..."
                            : "Analyzing your slide deck..."}
                        </p>
                        <p className="text-sm text-[var(--text-tertiary)]">
                          {analysisType === "audio"
                            ? analysisProgress < 30
                              ? "Uploading and processing audio..."
                              : analysisProgress < 60
                                ? "Transcribing speech..."
                                : analysisProgress < 90
                                  ? "Generating AI insights..."
                                  : "Finalizing results..."
                            : analysisProgress < 30
                              ? "Uploading and extracting content..."
                              : analysisProgress < 60
                                ? "Analyzing slide structure..."
                                : analysisProgress < 90
                                  ? "Generating AI recommendations..."
                                  : "Finalizing results..."}
                        </p>
                      </div>
                    </div>
                    <div className="w-full bg-[var(--bg-tertiary)] rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ease-out ${
                          analysisType === "audio"
                            ? "bg-gradient-to-r from-[var(--accent-blue)] to-purple-500"
                            : "bg-gradient-to-r from-purple-500 to-pink-500"
                        }`}
                        style={{ width: `${Math.min(analysisProgress, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-[var(--text-muted)]">
                      <span>Processing {files[0]?.file.name}</span>
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
                          ? `Upload ${analysisType === "audio" ? "an audio/video file" : "a PDF slide deck"} to start analysis`
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
                            ? analysisType === "audio"
                              ? "bg-[var(--accent-blue)] text-white hover:bg-[var(--accent-blue-hover)] animate-pulse-glow"
                              : "bg-purple-500 text-white hover:bg-purple-600 shadow-[0_0_20px_rgba(168,85,247,0.4)]"
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
                      Analyze {analysisType === "audio" ? "Presentation" : "Slide Deck"}
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Analysis Results */}
            {analysisComplete && audioResult && (
              <section className="mt-8">
                <SpeechAnalysisResults data={audioResult} onReset={handleReset} />
              </section>
            )}

            {analysisComplete && pdfResult && (
              <section className="mt-8">
                <PDFAnalysisResults data={pdfResult} onReset={handleReset} />
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
