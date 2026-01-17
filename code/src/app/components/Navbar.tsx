import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

export const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();

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
            <button
              onClick={() => router.push("/")}
              className="text-gray-700 hover:underline transition-colors font-medium"
            >
              Home
            </button>
            <button className="text-gray-700 hover:underline transition-colors font-medium">
              Features
            </button>
            <button className="text-gray-700 hover:underline transition-colors font-medium">
              About
            </button>
            <button
              onClick={() => router.push("/upload")}
              className="cursor-pointer px-6 py-2 rounded-full hover:shadow-lg transform hover:scale-105 transition-all duration-200 bg-black text-white"
            >
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
          <button
            onClick={() => router.push("/")}
            className="block px-3 py-2 rounded-md text-gray-900 hover:bg-gray-100 transition-colors font-medium"
          >
            Home
          </button>
          <button className="block px-3 py-2 rounded-md text-gray-900 hover:bg-gray-100 transition-colors font-medium">
            Features
          </button>
          <button className="block px-3 py-2 rounded-md text-gray-900 hover:bg-gray-100 transition-colors font-medium">
            About
          </button>
          <button
            onClick={() => router.push("/upload")}
            className="cursor-pointer w-full mt-2 bg-black text-white px-6 py-2 rounded-md hover:bg-gray-800 transition-colors"
          >
            Get Started
          </button>
        </div>
      </div>
    </nav>
  );
};
