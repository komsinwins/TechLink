import React from 'react';
import { useFirebase } from './FirebaseProvider';
import { LogIn, LogOut, Terminal, Wifi, WifiOff } from 'lucide-react';

interface NavbarProps {
  currentTab: string;
  onTabChange?: (tab: string) => void;
  setCurrentTab?: (tab: string) => void;
  overdueCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  currentTab, 
  onTabChange, 
  setCurrentTab, 
  overdueCount = 0 
}) => {
  const { user, signInWithGoogle, logout, isOffline } = useFirebase();

  const tabs = [
    { id: 'dashboard', label: 'สรุปผล (Dashboard)' },
    { id: 'onsite', label: 'งาน Onsite Service' },
    { id: 'oncall', label: 'งาน Oncall Service' },
    { id: 'claim', label: 'เคลมสินค้า (Claims)' },
    { id: 'customer', label: 'ฐานข้อมูลลูกค้า (Customers)' },
  ];

  const handleTabClick = (tabId: string) => {
    if (onTabChange) {
      onTabChange(tabId);
    } else if (setCurrentTab) {
      setCurrentTab(tabId);
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Brand/Logo */}
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 text-white p-2 rounded-xl shadow-md shadow-blue-500/15">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
                WSS_TechLink
                <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-mono border border-blue-200">
                  V.1.0
                </span>
              </h1>
              <p className="text-[9px] text-slate-500 font-semibold tracking-wider uppercase">Technical Support Portal</p>
            </div>
          </div>

          {/* Navigation Tabs - Desktop */}
          {user && (
            <nav className="hidden md:flex space-x-1">
              {tabs.map((tab) => {
                const isActive = currentTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    id={`tab-btn-${tab.id}`}
                    onClick={() => handleTabClick(tab.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 relative ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/10'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                    {tab.id === 'dashboard' && overdueCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center animate-pulse border-2 border-white">
                        {overdueCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          )}

          {/* Right Area: Auth & Firebase status */}
          <div className="flex items-center space-x-3">
            {/* Status indicators */}
            <div className="flex items-center space-x-1.5 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600">
              {isOffline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-rose-500" />
                  <span className="text-rose-600 font-medium">Offline</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                  <span className="text-slate-700 font-medium">Firebase Connected</span>
                </>
              )}
            </div>

            {/* Auth Button */}
            {user && user.uid !== 'guest-user-wss' ? (
              <div className="flex items-center space-x-3 bg-slate-50 p-1 rounded-xl border border-slate-200">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-8 h-8 rounded-lg object-cover border border-slate-200"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-xs">
                    {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                  </div>
                )}
                <div className="hidden lg:block text-left pr-2">
                  <p className="text-xs font-semibold text-slate-800 leading-tight">
                    {user.displayName || 'Tech Member'}
                  </p>
                  <p className="text-[10px] text-slate-500 leading-none truncate max-w-[120px]">
                    {user.email}
                  </p>
                </div>
                <button
                  id="signout-button"
                  onClick={logout}
                  title="ออกจากระบบ"
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2 bg-slate-50 p-1.5 px-3 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold">
                <div className="w-5 h-5 rounded bg-slate-450 flex items-center justify-center text-white text-[10px] font-bold">G</div>
                <span>ผู้ใช้ทั่วไป (Guest)</span>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Navigation Row */}
        {user && (
          <div className="md:hidden flex overflow-x-auto py-2 -mx-4 px-4 space-x-2 border-t border-slate-100 scrollbar-none">
            {tabs.map((tab) => {
              const isActive = currentTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={`whitespace-nowrap px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
};
