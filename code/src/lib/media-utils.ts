import { promises as fs } from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { getUploadsDir } from "./job-store";
import { UploadedMedia } from "./evaluation-schema";

const execFileAsync = promisify(execFile);

type AudioPrepResult = {
  audioPath?: string;
  audioMeta?: string;
  mimeType?: string;
  warnings: string[];
};

async function probeDuration(filePath: string) {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);
    const value = Number.parseFloat(stdout.trim());
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

async function extractAudioFromVideo(videoPath: string, outputPath: string) {
  try {
    await execFileAsync("ffmpeg", [
      "-y",
      "-i",
      videoPath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      outputPath,
    ]);
    return true;
  } catch {
    return false;
  }
}

export async function prepareAudioForAgent(params: {
  jobId: string;
  media: UploadedMedia[];
}): Promise<AudioPrepResult> {
  const warnings: string[] = [];
  const audio = params.media.find((item) => item.kind === "audio");
  if (audio) {
    const duration = await probeDuration(audio.path);
    const durationText =
      duration !== null ? `durationSec=${duration.toFixed(1)}` : "durationSec=unknown";
    return {
      audioPath: audio.path,
      audioMeta: `source=audio file=${path.basename(audio.path)} sizeBytes=${audio.sizeBytes} ${durationText}`,
      mimeType: audio.mimeType || "audio/mpeg",
      warnings,
    };
  }

  const video = params.media.find((item) => item.kind === "video");
  if (!video) {
    warnings.push("No audio or video media provided.");
    return { warnings, audioMeta: "No audio provided." };
  }

  const uploadsDir = getUploadsDir();
  const outputPath = path.join(uploadsDir, `${params.jobId}-audio.wav`);
  const extracted = await extractAudioFromVideo(video.path, outputPath);
  if (!extracted) {
    warnings.push("Failed to extract audio from video. Ensure ffmpeg is installed.");
    return {
      warnings,
      audioMeta: `source=video file=${path.basename(video.path)} audioExtraction=failed`,
    };
  }

  const stats = await fs.stat(outputPath);
  const duration = await probeDuration(outputPath);
  const durationText =
    duration !== null ? `durationSec=${duration.toFixed(1)}` : "durationSec=unknown";
  return {
    audioPath: outputPath,
    audioMeta: `source=video file=${path.basename(video.path)} extractedAudio=wav sizeBytes=${stats.size} ${durationText}`,
    mimeType: "audio/wav",
    warnings,
  };
}
