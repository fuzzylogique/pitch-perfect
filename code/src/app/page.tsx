"use client";
import { useEffect } from "react";
import Image from "next/image";
import { fancyFont, poppins } from "@/app/fonts";
import { Navbar } from "@/app/components/Navbar";

export default function Home() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.remove("opacity-0");
            entry.target.classList.add("opacity-100");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 },
    );

    document.querySelectorAll(".fade-in").forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div>
      <Navbar />

      {/* Demo content */}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
          {/* Left column */}
          <div className="w-full md:w-1/2">
            {/* H2 — fades in FIRST */}
            <h2
              className="text-4xl font-bold text-gray-900 mb-4 
                     opacity-0 transition-opacity duration-700 fade-in"
            >
              Welcome to{" "}
              <span
                className={`${fancyFont.className} text-blue-600 font-semibold hover:underline underline-offset-4 decoration-2 text-blue-500`}
              >
                Pitch Perfect
              </span>
            </h2>

            {/* Paragraph — fades in SECOND */}
            <p
              className={`${poppins.className} text-gray-600 text-lg 
                    opacity-0 transition-opacity duration-700 delay-200 fade-in`}
            >
              Your AI-powered personal presentation coach. Upload a presentation
              deck and record or upload a short pitch video. We'll give you
              feedback on how to improve your pitch.
            </p>
          </div>

          {/* Right column — fades in WITH paragraph */}
          <div
            className="w-full md:w-1/2 
                    opacity-0 transition-opacity duration-700 delay-200 fade-in"
          >
            <Image src="/shark.png" alt="Shark Logo" width={100} height={100} />
          </div>
        </div>
      </div>
    </div>
  );
}
