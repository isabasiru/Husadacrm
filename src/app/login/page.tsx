'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Activity, Loader2, Lock, Mail, Shield, HeartPulse, Clock } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        router.push('/dashboard');
        router.refresh();
      } else {
        setError(data.error || 'Email atau password salah');
      }
    } catch (err) {
      console.error(err);
      setError('Terjadi kesalahan pada sistem. Coba lagi.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel — Medical gradient branding */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-gradient-to-br from-teal-700 via-teal-600 to-teal-800">
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <span className="font-extrabold text-lg">Husada CRM</span>
              <span className="block text-xs text-teal-200 font-medium">Patient Relationship Management</span>
            </div>
          </div>

          {/* Hero text */}
          <div className="space-y-8">
            <div>
              <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
                Kelola pasien<br />
                lebih efisien<br />
                <span className="text-teal-200">lewat WhatsApp.</span>
              </h1>
              <p className="mt-4 text-teal-100 text-base max-w-md leading-relaxed">
                Platform CRM terintegrasi untuk klinik kesehatan. Inbox terpusat, auto follow-up, dan monitoring performa tim.
              </p>
            </div>

            {/* Feature highlights */}
            <div className="grid grid-cols-1 gap-4 max-w-sm">
              <div className="flex items-center gap-3 bg-white/8 backdrop-blur-sm rounded-xl p-3.5">
                <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                  <HeartPulse className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Inbox Terpusat</p>
                  <p className="text-xs text-teal-200">Semua percakapan dalam satu dashboard</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white/8 backdrop-blur-sm rounded-xl p-3.5">
                <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Auto Follow-Up</p>
                  <p className="text-xs text-teal-200">Otomatis follow-up pasien yang idle</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white/8 backdrop-blur-sm rounded-xl p-3.5">
                <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">SLA Monitoring</p>
                  <p className="text-xs text-teal-200">Alert otomatis jika respon lambat</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <p className="text-xs text-teal-300/60">
            &copy; {new Date().getFullYear()} WebHaus — Healthcare CRM
          </p>
        </div>
      </div>

      {/* Right Panel — Login form */}
      <div className="flex-1 flex flex-col justify-center px-8 sm:px-12 lg:px-16 bg-background">
        <div className="w-full max-w-md mx-auto">
          {/* Mobile logo (hidden on lg) */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <span className="font-extrabold text-lg text-foreground">Husada CRM</span>
          </div>

          <div>
            <h2 className="text-2xl font-extrabold text-foreground tracking-tight">
              Selamat datang kembali
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Masuk ke dashboard untuk mengelola pasien Anda
            </p>
          </div>

          <form className="mt-8 space-y-5" onSubmit={handleLogin}>
            {error && (
              <div className="p-3.5 bg-destructive/5 text-destructive rounded-lg text-sm text-center border border-destructive/10 font-medium">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 block w-full text-sm input-field py-2.5 px-3.5"
                  placeholder="admin@husada.id"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 block w-full text-sm input-field py-2.5 px-3.5"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Masuk Dashboard'}
            </button>
          </form>
          
          <div className="mt-8 text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} WebHaus CRM System
          </div>
        </div>
      </div>
    </div>
  );
}
