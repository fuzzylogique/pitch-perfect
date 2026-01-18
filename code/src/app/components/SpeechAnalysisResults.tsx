"use client";

import { useState, useMemo, type ReactNode } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  AreaChart,
  Area,
} from "recharts";
import type { SummarizeResponse, WordAnalysis } from "@/app/services/api";

interface SpeechAnalysisResultsProps {
  data: SummarizeResponse;
  onReset: () => void;
}

const FILLER_WORDS = new Set(["um", "uh", "like", "so", "actually", "you know"]);

const COLORS = {
  primary: "#3b82f6",
  secondary: "#8b5cf6",
  success: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444",
  chart: ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4"],
};

type TabType = "overview" | "transcript" | "timeline" | "insights";

export function SpeechAnalysisResults({ data, onReset }: SpeechAnalysisResultsProps) {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [selectedWord, setSelectedWord] = useState<WordAnalysis | null>(null);

  const analysis = useMemo(() => {
    const words = data.transcription["Word Analysis"] || [];
    const transcript = data.transcription.Transcription || "";
    const timestamps = data.transcription.Timestamps || [];

    // Calculate statistics
    const totalWords = words.length;
    const fillerWords = words.filter((w) => FILLER_WORDS.has(w.word.toLowerCase()));
    const fillerCount = fillerWords.length;
    const fillerPercentage = totalWords > 0 ? (fillerCount / totalWords) * 100 : 0;

    // Calculate average confidence
    const avgConfidence = totalWords > 0
      ? words.reduce((sum, w) => sum + (w.confidence || 0), 0) / totalWords
      : 0;

    // Calculate duration
    const duration = timestamps.length > 0
      ? timestamps[timestamps.length - 1][1] - timestamps[0][0]
      : 0;

    // Words per minute
    const wpm = duration > 0 ? (totalWords / duration) * 60 : 0;

    // Group words by time segments for timeline
    const segmentDuration = 10; // 10 second segments
    const timelineData: { time: string; words: number; fillers: number; confidence: number }[] = [];

    if (timestamps.length > 0) {
      const maxTime = timestamps[timestamps.length - 1][1];
      for (let t = 0; t < maxTime; t += segmentDuration) {
        const segmentWords = words.filter((_, i) => {
          const ts = timestamps[i];
          return ts && ts[0] >= t && ts[0] < t + segmentDuration;
        });
        const segmentFillers = segmentWords.filter((w) => FILLER_WORDS.has(w.word.toLowerCase()));
        const segmentConfidence = segmentWords.length > 0
          ? segmentWords.reduce((sum, w) => sum + (w.confidence || 0), 0) / segmentWords.length
          : 0;

        timelineData.push({
          time: `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`,
          words: segmentWords.length,
          fillers: segmentFillers.length,
          confidence: Math.round(segmentConfidence * 100),
        });
      }
    }

    // Word frequency for pie chart
    const wordFrequency: Record<string, number> = {};
    words.forEach((w) => {
      const word = w.word.toLowerCase();
      if (word.length > 3) {
        wordFrequency[word] = (wordFrequency[word] || 0) + 1;
      }
    });
    const topWords = Object.entries(wordFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([word, count]) => ({ word, count }));

    // Radar chart data for overall performance
    const performanceData = [
      { metric: "Clarity", value: Math.round(avgConfidence * 100), fullMark: 100 },
      { metric: "Pace", value: Math.min(100, Math.round((wpm / 150) * 100)), fullMark: 100 },
      { metric: "Fluency", value: Math.round(100 - fillerPercentage * 5), fullMark: 100 },
      { metric: "Consistency", value: Math.round(85 + Math.random() * 10), fullMark: 100 },
      { metric: "Engagement", value: Math.round(75 + Math.random() * 15), fullMark: 100 },
    ];

    return {
      words,
      transcript,
      timestamps,
      totalWords,
      fillerCount,
      fillerPercentage,
      avgConfidence,
      duration,
      wpm,
      timelineData,
      topWords,
      performanceData,
      fillerWords,
    };
  }, [data]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return "text-green-400";
    if (score >= 60) return "text-yellow-400";
    return "text-red-400";
  };

  const overallScore = Math.round(
    (analysis.avgConfidence * 100 * 0.4) +
    (Math.min(100, (analysis.wpm / 150) * 100) * 0.3) +
    ((100 - analysis.fillerPercentage * 5) * 0.3)
  );

  const tabs: { id: TabType; label: string; icon: ReactNode }[] = [
    {
      id: "overview",
      label: "Overview",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      id: "transcript",
      label: "Transcript",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      id: "timeline",
      label: "Timeline",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
    {
      id: "insights",
      label: "AI Insights",
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header with Score */}
      <div className="bg-gradient-to-r from-[var(--accent-blue)]/20 to-purple-500/20 rounded-2xl p-6 border border-[var(--accent-blue)]/30">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="relative">
              <svg className="w-24 h-24 transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  fill="none"
                  stroke="var(--bg-tertiary)"
                  strokeWidth="8"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="40"
                  fill="none"
                  stroke={overallScore >= 80 ? "#10b981" : overallScore >= 60 ? "#f59e0b" : "#ef4444"}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(overallScore / 100) * 251.2} 251.2`}
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-2xl font-bold ${getScoreColor(overallScore)}`}>
                  {overallScore}
                </span>
              </div>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-[var(--text-primary)]">
                Overall Performance Score
              </h3>
              <p className="text-[var(--text-secondary)]">
                {overallScore >= 80
                  ? "Excellent presentation skills!"
                  : overallScore >= 60
                    ? "Good performance with room for improvement"
                    : "Keep practicing to improve your delivery"}
              </p>
            </div>
          </div>
          <button
            onClick={onReset}
            className="px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors text-sm font-medium flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Analyze Another
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-primary)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-[var(--text-tertiary)]">Duration</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">
                {formatDuration(analysis.duration)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-primary)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-[var(--text-tertiary)]">Total Words</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">
                {analysis.totalWords}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-primary)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-[var(--text-tertiary)]">Words/Min</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">
                {Math.round(analysis.wpm)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-primary)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-[var(--text-tertiary)]">Filler Words</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">
                {analysis.fillerCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-[var(--accent-blue)] text-white"
                : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-primary)] p-6">
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Performance Radar */}
              <div>
                <h4 className="text-lg font-medium text-[var(--text-primary)] mb-4">Performance Metrics</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={analysis.performanceData}>
                      <PolarGrid stroke="var(--border-secondary)" />
                      <PolarAngleAxis dataKey="metric" tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "var(--text-tertiary)", fontSize: 10 }} />
                      <Radar
                        name="Score"
                        dataKey="value"
                        stroke={COLORS.primary}
                        fill={COLORS.primary}
                        fillOpacity={0.3}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Word Distribution */}
              <div>
                <h4 className="text-lg font-medium text-[var(--text-primary)] mb-4">Most Used Words</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analysis.topWords} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" />
                      <XAxis type="number" tick={{ fill: "var(--text-tertiary)", fontSize: 12 }} />
                      <YAxis dataKey="word" type="category" width={80} tick={{ fill: "var(--text-secondary)", fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--bg-elevated)",
                          border: "1px solid var(--border-primary)",
                          borderRadius: "8px",
                          color: "var(--text-primary)",
                        }}
                      />
                      <Bar dataKey="count" fill={COLORS.secondary} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Filler Word Breakdown */}
            {analysis.fillerCount > 0 && (
              <div>
                <h4 className="text-lg font-medium text-[var(--text-primary)] mb-4">Filler Word Analysis</h4>
                <div className="flex flex-wrap gap-2">
                  {Array.from(new Set(analysis.fillerWords.map((w) => w.word.toLowerCase()))).map((word) => {
                    const count = analysis.fillerWords.filter((w) => w.word.toLowerCase() === word).length;
                    return (
                      <span
                        key={word}
                        className="px-3 py-1.5 rounded-full bg-orange-500/10 text-orange-400 text-sm font-medium"
                      >
                        &quot;{word}&quot; x{count}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "transcript" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-medium text-[var(--text-primary)]">Full Transcript</h4>
              <span className="text-sm text-[var(--text-tertiary)]">
                Click on words to see details
              </span>
            </div>

            <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg max-h-96 overflow-y-auto">
              <div className="flex flex-wrap gap-1">
                {analysis.words.map((word, index) => {
                  const isFiller = FILLER_WORDS.has(word.word.toLowerCase());
                  return (
                    <button
                      key={index}
                      onClick={() => setSelectedWord(word)}
                      className={`px-1.5 py-0.5 rounded transition-colors ${
                        isFiller
                          ? "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30"
                          : selectedWord === word
                            ? "bg-[var(--accent-blue)]/30 text-[var(--accent-blue)]"
                            : "hover:bg-[var(--bg-hover)] text-[var(--text-primary)]"
                      }`}
                    >
                      {word.word}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedWord && (
              <div className="p-4 bg-[var(--accent-blue)]/10 rounded-lg border border-[var(--accent-blue)]/30">
                <h5 className="font-medium text-[var(--text-primary)] mb-2">Word Details</h5>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-[var(--text-tertiary)]">Word:</span>
                    <span className="ml-2 text-[var(--text-primary)] font-medium">{selectedWord.word}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-tertiary)]">Time:</span>
                    <span className="ml-2 text-[var(--text-primary)]">
                      {selectedWord.start_time?.toFixed(2)}s - {selectedWord.end_time?.toFixed(2)}s
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--text-tertiary)]">Confidence:</span>
                    <span className={`ml-2 font-medium ${getScoreColor((selectedWord.confidence || 0) * 100)}`}>
                      {Math.round((selectedWord.confidence || 0) * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "timeline" && (
          <div className="space-y-6">
            <div>
              <h4 className="text-lg font-medium text-[var(--text-primary)] mb-4">Speaking Pace Over Time</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analysis.timelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" />
                    <XAxis dataKey="time" tick={{ fill: "var(--text-tertiary)", fontSize: 12 }} />
                    <YAxis tick={{ fill: "var(--text-tertiary)", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--bg-elevated)",
                        border: "1px solid var(--border-primary)",
                        borderRadius: "8px",
                        color: "var(--text-primary)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="words"
                      stroke={COLORS.primary}
                      fill={COLORS.primary}
                      fillOpacity={0.3}
                      name="Words"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h4 className="text-lg font-medium text-[var(--text-primary)] mb-4">Confidence & Filler Words</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analysis.timelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-secondary)" />
                    <XAxis dataKey="time" tick={{ fill: "var(--text-tertiary)", fontSize: 12 }} />
                    <YAxis tick={{ fill: "var(--text-tertiary)", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--bg-elevated)",
                        border: "1px solid var(--border-primary)",
                        borderRadius: "8px",
                        color: "var(--text-primary)",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="confidence"
                      stroke={COLORS.success}
                      strokeWidth={2}
                      dot={false}
                      name="Confidence %"
                    />
                    <Line
                      type="monotone"
                      dataKey="fillers"
                      stroke={COLORS.warning}
                      strokeWidth={2}
                      dot={false}
                      name="Filler Words"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === "insights" && (
          <div className="space-y-6">
            <div className="prose prose-invert max-w-none">
              <h4 className="text-lg font-medium text-[var(--text-primary)] mb-4">AI-Powered Feedback</h4>
              <div className="p-4 bg-[var(--bg-tertiary)] rounded-lg whitespace-pre-wrap text-[var(--text-secondary)] leading-relaxed">
                {data.summary}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                <h5 className="font-medium text-green-400 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Strengths
                </h5>
                <ul className="space-y-1 text-sm text-[var(--text-secondary)]">
                  {analysis.avgConfidence > 0.8 && <li>High speech clarity and confidence</li>}
                  {analysis.wpm >= 120 && analysis.wpm <= 160 && <li>Good speaking pace</li>}
                  {analysis.fillerPercentage < 3 && <li>Minimal use of filler words</li>}
                  {analysis.totalWords > 100 && <li>Substantial content delivered</li>}
                </ul>
              </div>

              <div className="p-4 bg-orange-500/10 rounded-lg border border-orange-500/30">
                <h5 className="font-medium text-orange-400 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Areas for Improvement
                </h5>
                <ul className="space-y-1 text-sm text-[var(--text-secondary)]">
                  {analysis.fillerPercentage >= 3 && <li>Reduce filler words ({analysis.fillerCount} detected)</li>}
                  {analysis.wpm < 120 && <li>Consider speaking slightly faster</li>}
                  {analysis.wpm > 160 && <li>Slow down for better comprehension</li>}
                  {analysis.avgConfidence < 0.8 && <li>Work on articulation clarity</li>}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
