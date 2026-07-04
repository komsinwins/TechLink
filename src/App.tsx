import React, { useState } from 'react';
import { FirebaseProvider, useFirebase } from './components/FirebaseProvider';
import { Navbar } from './components/Navbar';
import { OverdueAlerts } from './components/OverdueAlerts';
import { Dashboard } from './components/Dashboard';
import { OnsitePanel } from './components/OnsitePanel';
import { OncallPanel } from './components/OncallPanel';
import { ClaimPanel } from './components/ClaimPanel';
import { CustomerPanel } from './components/CustomerPanel';
import { Terminal, Shield, AlertTriangle } from 'lucide-react';

type Tab = 'dashboard' | 'onsite' | 'oncall' | 'claim' | 'customer';

const MainAppContent: React.FC = () => {
  const { user, loading, connectionStatus, signInWithEmail, signUpWithEmail, signInWithGoogle } = useFirebase();
  const [currentTab, setCurrentTab] = useState<Tab>('dashboard');
  
  // Custom local auth UI states
  const [isRegister, setIsRegister] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authDisplayName, setAuthDisplayName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      if (isRegister) {
        if (!authDisplayName.trim()) {
          throw new Error('กรุณากรอกชื่อผู้ใช้งาน');
        }
        await signUpWithEmail(authEmail, authPassword, authDisplayName);
      } else {
        await signInWithEmail(authEmail, authPassword);
      }
    } catch (err: any) {
      console.error(err);
      let errMsg = 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        errMsg = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
      } else if (err.code === 'auth/email-already-in-use') {
        errMsg = 'อีเมลนี้ถูกใช้งานแล้วในระบบ';
      } else if (err.code === 'auth/weak-password') {
        errMsg = 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร';
      } else if (err.code === 'auth/operation-not-allowed') {
        errMsg = 'ยังไม่ได้เปิดใช้งานการเข้าสู่ระบบด้วยอีเมล/รหัสผ่านใน Firebase Console สำหรับโปรเจกต์นี้ กรุณาเข้าไปเปิดใช้งานที่ Firebase Console > Authentication > Sign-in method หรือคลิกเลือก "เข้าสู่ระบบด้วย Google" ด้านล่างแทน';
      } else if (err.message) {
        errMsg = err.message;
      }
      setAuthError(errMsg);
    } finally {
      setAuthLoading(false);
    }
  };

  // Cross-navigation search state
  const [onsiteSearch, setOnsiteSearch] = useState('');
  const [oncallSearch, setOncallSearch] = useState('');
  const [claimSearch, setClaimSearch] = useState('');

  const handleSearchAcrossTabs = (searchQuery: string, tab: 'onsite' | 'oncall' | 'claim') => {
    if (tab === 'onsite') {
      setOnsiteSearch(searchQuery);
      setCurrentTab('onsite');
    } else if (tab === 'oncall') {
      setOncallSearch(searchQuery);
      setCurrentTab('oncall');
    } else if (tab === 'claim') {
      setClaimSearch(searchQuery);
      setCurrentTab('claim');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center font-sans p-4">
        <div className="bg-white border border-slate-200 p-8 rounded-3xl text-center space-y-4 shadow-lg max-w-sm w-full">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <h2 className="text-lg font-bold text-slate-800">กำลังโหลดระบบ WSS_TechLink...</h2>
          <p className="text-xs text-slate-500">โปรดรอสักครู่ ขณะนี้ระบบกำลังเชื่อมต่อฐานข้อมูลความปลอดภัย</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans print:bg-white print:text-slate-900">
      
      {/* Top Warning/Notification Banner about unresolved items */}
      {user && (
        <div className="print:hidden">
          <OverdueAlerts />
        </div>
      )}

      {/* Navigation bar with auth & lookup control */}
      <div className="print:hidden">
        <Navbar currentTab={currentTab} onTabChange={(tab) => {
          // Reset quick search query upon manual navigation clicks
          if (tab !== 'onsite') setOnsiteSearch('');
          if (tab !== 'oncall') setOncallSearch('');
          if (tab !== 'claim') setClaimSearch('');
          setCurrentTab(tab as Tab);
        }} />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 print:p-0">
        
        {/* Connection status notification */}
        <div className="print:hidden flex justify-end mb-4">
          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 shadow-sm px-3 py-1.5 rounded-full text-[10px] font-bold text-slate-600">
            <span className={`w-2 h-2 rounded-full ${connectionStatus === 'online' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span>โหมดการเชื่อมต่อ: {connectionStatus === 'online' ? 'ออนไลน์ (คลาวด์ซิงก์)' : 'ออฟไลน์ (เซฟในหน่วยความจำ)'}</span>
          </div>
        </div>

        {/* Auth protection info screen */}
        {!user && !loading ? (
          <div className="max-w-md mx-auto my-12 bg-white border border-slate-200 p-8 rounded-3xl text-center space-y-6 shadow-lg print:hidden">
            <div className="bg-blue-50 text-blue-600 p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center border border-blue-100">
              <Shield className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">
                {isRegister ? 'ลงทะเบียนผู้ใช้งานใหม่' : 'ลงชื่อเข้าใช้งานระบบ'}
              </h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                กรุณาเข้าสู่ระบบด้วยบัญชีเพื่อเข้าใช้งานระบบ Technical Support WSS_TechLink V.1.0 อย่างปลอดภัย
              </p>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4 text-left">
              {isRegister && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-600">ชื่อ-นามสกุลผู้ใช้งาน *</label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น สมชาย ใจดี"
                    value={authDisplayName}
                    onChange={(e) => setAuthDisplayName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">อีเมลสำหรับเข้าใช้งาน *</label>
                <input
                  type="email"
                  required
                  placeholder="เช่น technician@wss.com"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-600">รหัสผ่านสำหรับเข้าใช้งาน *</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              {authError && (
                <div className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 text-white font-bold py-2.5 rounded-xl text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
              >
                {authLoading ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : null}
                <span>{isRegister ? 'ลงทะเบียนเข้าใช้งาน' : 'ลงชื่อเข้าใช้งาน'}</span>
              </button>
            </form>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">{isRegister ? 'มีบัญชีอยู่แล้ว?' : 'ยังไม่มีบัญชีเข้าใช้งาน?'}</span>
              <button
                type="button"
                onClick={() => {
                  setIsRegister(!isRegister);
                  setAuthError('');
                }}
                className="text-blue-600 hover:text-blue-700 font-bold transition-colors"
              >
                {isRegister ? 'เข้าสู่ระบบที่นี่' : 'ลงทะเบียนผู้ใช้งานใหม่'}
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 text-[11px] text-left text-slate-500 leading-relaxed">
              <p className="font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Terminal className="w-3.5 h-3.5 text-blue-600" />
                หมายเหตุเกี่ยวกับสิทธิ์การใช้งาน:
              </p>
              ระบุให้เฉพาะบุคลากรทีม Technical Support, วิศวกร, พนักงานขาย (Sales) และฝ่ายบริการเคลมที่ได้รับการอนุญาตเท่านั้นในระบบ
            </div>
          </div>
        ) : (
          <div className="animate-fade-in">
            {currentTab === 'dashboard' && (
              <Dashboard 
                onNavigate={(tab) => {
                  if (tab !== 'onsite') setOnsiteSearch('');
                  if (tab !== 'oncall') setOncallSearch('');
                  if (tab !== 'claim') setClaimSearch('');
                  setCurrentTab(tab);
                }} 
                onSearchAcrossTabs={handleSearchAcrossTabs} 
              />
            )}
            
            {currentTab === 'onsite' && (
              <OnsitePanel initialSearch={onsiteSearch} />
            )}
            
            {currentTab === 'oncall' && (
              <OncallPanel initialSearch={oncallSearch} />
            )}
            
            {currentTab === 'claim' && (
              <ClaimPanel initialSearch={claimSearch} />
            )}
            
            {currentTab === 'customer' && (
              <CustomerPanel />
            )}
          </div>
        )}
      </main>

      {/* Footer copyright */}
      <footer className="bg-white border-t border-slate-200/80 py-6 mt-12 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>&copy; 2026 WSS Technical Support Co., Ltd. สงวนลิขสิทธิ์</p>
          <div className="flex space-x-4">
            <span className="font-semibold text-slate-700">WSS_TechLink V.1.0</span>
            <span className="text-slate-300">&bull;</span>
            <span>ระบบบันทึกประวัติ Onsite, Oncall, Claims ครบวงจร</span>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default function App() {
  return (
    <FirebaseProvider>
      <MainAppContent />
    </FirebaseProvider>
  );
}
