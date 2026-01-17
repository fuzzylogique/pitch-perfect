import React from "react";

interface NavbarProps {
  logo?: string;
  brandName?: string;
  navItems?: Array<{
    label: string;
    href: string;
  }>;
  onThemeToggle?: () => void;
  isDarkMode?: boolean;
}

const Navbar: React.FC<NavbarProps> = ({
  logo,
  brandName = "Pitch Perfect",
  navItems = [
    { label: "Home", href: "#home" },
    { label: "About", href: "#about" },
    { label: "Demo", href: "#demo" },
    { label: "Login", href: "#login" },
  ],
  onThemeToggle,
  isDarkMode = true,
}) => {
  return (
    <nav className="navbar">
      {/* Brand Section */}
      <div className="navbar-brand">
        {logo && <img src={logo} alt={brandName} className="navbar-logo" />}
        <span className="navbar-title">
          <span className="brand-pitch">P</span>itch{" "}
          <span className="brand-perfect">P</span>erfect
        </span>
      </div>

      {/* Navigation Links */}
      <div className="navbar-links">
        {navItems.map((item, index) => (
          <a key={index} href={item.href} className="nav-link">
            {item.label}
          </a>
        ))}
      </div>

      {/* Theme Toggle Button */}
      <button
        className="theme-toggle"
        onClick={onThemeToggle}
        aria-label="Toggle theme"
      >
        {isDarkMode ? (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </button>

      <style jsx>{`
        .navbar {
          position: fixed;
          top: 1.5rem;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 1.25rem;
          background-color: rgba(26, 26, 26, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          width: calc(100% - 3rem);
          max-width: 1080px;
          transition:
            box-shadow 0.3s ease,
            border-color 0.3s ease;
          z-index: 50;
          backdrop-filter: blur(10px);
        }

        .navbar:hover {
          border-color: #38bdf8;
          box-shadow:
            0 0 20px rgba(14, 165, 233, 0.5),
            0 0 40px rgba(14, 165, 233, 0.3),
            inset 0 0 20px rgba(14, 165, 233, 0.1);
        }

        .navbar-brand {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .navbar-logo {
          height: 24px;
          width: auto;
        }

        .navbar-title {
          font-size: 1.25rem;
          font-weight: 400;
          color: #ffffff;
          letter-spacing: 0.5px;
        }

        .brand-pitch,
        .brand-perfect {
          font-size: 1.5rem;
          font-weight: 600;
        }

        .navbar-links {
          display: flex;
          gap: 2.5rem;
          align-items: center;
          flex: 1;
          justify-content: center;
        }

        .nav-link {
          color: #ffffff;
          text-decoration: none;
          font-size: 0.95rem;
          font-weight: 400;
          transition: color 0.2s ease;
        }

        .nav-link:hover {
          color: #0ea5e9;
        }

        .theme-toggle {
          background: transparent;
          border: none;
          color: #ffffff;
          cursor: pointer;
          padding: 0.4rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s ease;
          border-radius: 6px;
        }

        .theme-toggle:hover {
          color: #0ea5e9;
        }

        .theme-toggle svg {
          width: 20px;
          height: 20px;
        }

        @media (max-width: 768px) {
          .navbar {
            top: 1rem;
            width: calc(100% - 2rem);
            flex-wrap: wrap;
            padding: 0.75rem 1rem;
          }

          .navbar-links {
            order: 3;
            width: 100%;
            margin-top: 1rem;
            justify-content: space-around;
            gap: 1rem;
          }

          .nav-link {
            font-size: 0.85rem;
          }

          .navbar-title {
            font-size: 1.1rem;
          }

          .brand-pitch,
          .brand-perfect {
            font-size: 1.3rem;
          }
        }
      `}</style>
    </nav>
  );
};

export { Navbar };
