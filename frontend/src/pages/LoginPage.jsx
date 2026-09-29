import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { login } from "../api/auth";
import { useDispatch } from "react-redux";
import { setUser } from "../store/slices/userSlice";

export function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await login(form);
      dispatch(setUser({ profile: data.user, token: data.token }));
      navigate(`/${data.user.role}`);
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex text-white bg-[#0a0c10]">
      {/* Left Pane - Branding & Visuals */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gray-900">
        <div className="absolute inset-0 z-10 bg-gradient-to-r from-[#0a0c10]/90 to-transparent"></div>
        <img 
          src="/login-bg.png" 
          alt="Premium abstract neon background" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="relative z-20 flex flex-col justify-end p-16 h-full">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center text-3xl mb-8 shadow-lg shadow-teal-500/20">
            🚖
          </div>
          <h1 className="text-5xl font-bold tracking-tight mb-4">
            Manage the future<br />of transit.
          </h1>
          <p className="text-lg text-gray-300 max-w-md font-light">
            Access your secure dashboard to monitor active rides, manage drivers, and oversee platform performance in real-time.
          </p>
        </div>
      </div>

      {/* Right Pane - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 lg:p-24 relative">
        <div className="w-full max-w-md">
          <div className="mb-10 text-center lg:text-left">
            <h2 className="text-3xl font-bold mb-2">Welcome back</h2>
            <p className="text-gray-400">Please enter your details to sign in.</p>
          </div>

          <form onSubmit={submit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Email address</label>
              <input
                id="login-email"
                type="email"
                required
                className="w-full bg-[#13161e] border border-gray-700/50 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all shadow-inner"
                placeholder="admin@ride.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
              <input
                id="login-password"
                type="password"
                required
                className="w-full bg-[#13161e] border border-gray-700/50 rounded-xl px-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all shadow-inner"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <p className="text-sm text-red-400 text-center font-medium">{error}</p>
              </div>
            )}

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 text-gray-900 font-bold rounded-xl px-4 py-4 hover:shadow-[0_0_20px_rgba(20,210,170,0.3)] hover:scale-[1.02] transition-all disabled:opacity-50 disabled:hover:scale-100 disabled:hover:shadow-none relative"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>

            <p className="text-center text-sm text-gray-400 mt-8">
              Don't have an account?{" "}
              <Link to="/register" className="text-teal-400 font-semibold hover:text-teal-300 transition-colors">
                Create one
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
