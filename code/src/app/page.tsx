"use client";
import { useState, useEffect } from "react";
import Image from "next/image";

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

  const Navbar = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
      <nav className="shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            {/* <div className="flex-shrink-0">
              <Image src="/shark.png" alt="Shark Logo" width={50} height={50} />
              <h1 className="text-2xl font-bold bg-clip-text">Pitch Perfect</h1>
            </div> */}
            <div className="flex items-center gap-3">
              <Image src="/shark.png" alt="Shark Logo" width={50} height={50} />
              <h1 className="text-2xl font-bold bg-clip-text">Pitch Perfect</h1>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              <a
                href="#"
                className="text-gray-700 hover:underline transition-colors font-medium"
              >
                Home
              </a>
              <a
                href="#"
                className="text-gray-700 hover:underline transition-colors font-medium"
              >
                Features
              </a>
              <a
                href="#"
                className="text-gray-700 hover:underline transition-colors font-medium"
              >
                About
              </a>
              <button className="cursor-pointer px-6 py-2 rounded-full hover:shadow-lg transform hover:scale-105 transition-all duration-200 bg-black text-white">
                Get Started
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="cursor-pointer text-gray-700 hover:underline focus:outline-none"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {isMenuOpen ? (
                    <path d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <div
          className={`md:hidden border-t border-gray-200 overflow-hidden transition-all duration-300 ease-in-out ${
            isMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="px-2 pt-2 pb-3 space-y-1">
            <a
              href="#"
              className="block px-3 py-2 rounded-md text-gray-900 hover:bg-gray-100 transition-colors font-medium"
            >
              Home
            </a>
            <a
              href="#"
              className="block px-3 py-2 rounded-md text-gray-900 hover:bg-gray-100 transition-colors font-medium"
            >
              Features
            </a>
            <a
              href="#"
              className="block px-3 py-2 rounded-md text-gray-900 hover:bg-gray-100 transition-colors font-medium"
            >
              About
            </a>
            <button className="cursor-pointer w-full mt-2 bg-black text-white px-6 py-2 rounded-md hover:bg-gray-800 transition-colors">
              Get Started
            </button>
          </div>
        </div>
      </nav>
    );
  };

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
              Welcome to Pitch Perfect
            </h2>

            {/* Paragraph — fades in SECOND */}
            <p
              className="text-gray-600 text-lg 
                    opacity-0 transition-opacity duration-700 delay-200 fade-in"
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
