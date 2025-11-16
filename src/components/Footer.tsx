import React from 'react';
import { useNavigate } from 'react-router-dom';

interface FooterProps {
  light?: boolean;
}

const Footer: React.FC<FooterProps> = ({ light = false }) => {
  const navigate = useNavigate();

  return (
    <footer className={`w-full py-4 ${light ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border-t border-gray-200'}`}>
      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
          {/* Copyright */}
          <div className={`text-sm ${light ? 'text-white' : 'text-gray-600'}`}>
            &copy; {new Date().getFullYear()} HGU · CoWorks
          </div>

          {/* Links */}
          <ul className="flex flex-wrap items-center justify-center gap-4 list-none m-0 p-0">
            <li>
              <a
                href="https://github.com/HGU-WALAB"
                target="_blank"
                rel="noopener noreferrer"
                className={`text-sm font-medium hover:underline transition-colors ${
                  light ? 'text-white hover:text-gray-300' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                팀소개
              </a>
            </li>
            <li>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/policy/service');
                }}
                className={`text-sm font-medium hover:underline transition-colors ${
                  light ? 'text-white hover:text-gray-300' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                이용약관
              </button>
            </li>
            <li>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/policy/privacy');
                }}
                className={`text-sm font-medium hover:underline transition-colors ${
                  light ? 'text-white hover:text-gray-300' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                개인정보처리방침
              </button>
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

