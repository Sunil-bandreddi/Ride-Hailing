import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { getAdminStats, getAdminActiveRides, getAdminDrivers, updateAdminDriverStatus } from "../api/admin";
import { clearUser } from "../store/slices/userSlice";
import { useSocket } from "../hooks/useSocket";

export const AdminDashboard = () => {
  const dispatch = useDispatch();
  const socket = useSocket();
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, drivers, rides
  
  const [stats, setStats] = useState({ totalDrivers: 0, totalRiders: 0, activeRides: 0 });
  const [activeRides, setActiveRides] = useState([]);
  const [drivers, setDrivers] = useState([]);
  
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [statsData, ridesData, driversData] = await Promise.all([
        getAdminStats(),
        getAdminActiveRides(),
        getAdminDrivers()
      ]);
      setStats(statsData);
      setActiveRides(ridesData.rides);
      setDrivers(driversData.drivers);
    } catch (err) {
      console.error("Failed to fetch admin data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => fetchData();
    socket.on("ride_status_update", handleUpdate);
    socket.on("ride_accepted", handleUpdate);
    socket.on("location_update", handleUpdate);

    return () => {
      socket.off("ride_status_update", handleUpdate);
      socket.off("ride_accepted", handleUpdate);
      socket.off("location_update", handleUpdate);
    };
  }, [socket]);

  const handleLogout = () => dispatch(clearUser());

  const handleForceStatus = async (driverId, currentStatus) => {
    try {
      await updateAdminDriverStatus(driverId, { isOnline: !currentStatus });
      fetchData();
    } catch (err) {
      console.error("Failed to update driver status", err);
    }
  };

  const handleClearStuckRide = async (driverId) => {
    try {
      await updateAdminDriverStatus(driverId, { clearStuckRide: true });
      fetchData();
    } catch (err) {
      console.error("Failed to clear stuck ride", err);
    }
  };

  // SVGs for Icons
  const DashboardIcon = () => (
    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
  );
  const UsersIcon = () => (
    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
  );
  const MapIcon = () => (
    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
  );
  const LogoutIcon = () => (
    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
  );

  const getStatusBadge = (status) => {
    switch (status) {
      case "SEARCHING":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mr-1.5"></span>Searching</span>;
      case "ACCEPTED":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5"></span>Accepted</span>;
      case "ARRIVING":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"><span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mr-1.5"></span>Arriving</span>;
      case "ONGOING":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-500/10 text-teal-400 border border-teal-500/20"><span className="w-1.5 h-1.5 rounded-full bg-teal-500 mr-1.5"></span>Ongoing</span>;
      case "COMPLETED":
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Completed</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20"><span className="w-1.5 h-1.5 rounded-full bg-gray-500 mr-1.5"></span>{status}</span>;
    }
  };

  const renderDashboard = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h2 className="text-2xl font-bold text-white mb-6 tracking-tight">Platform Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#11131a] rounded-2xl p-6 border border-gray-800 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">Total Drivers</p>
              <h3 className="text-4xl font-bold text-white">{stats.totalDrivers}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-teal-500/20 flex items-center justify-center text-teal-400 border border-teal-500/30">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            </div>
          </div>
        </div>
        
        <div className="bg-[#11131a] rounded-2xl p-6 border border-gray-800 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">Total Riders</p>
              <h3 className="text-4xl font-bold text-white">{stats.totalRiders}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 border border-blue-500/30">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
            </div>
          </div>
        </div>

        <div className="bg-[#11131a] rounded-2xl p-6 border border-gray-800 shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-sm font-medium uppercase tracking-wider mb-1">Active Rides</p>
              <h3 className="text-4xl font-bold text-white">{stats.activeRides}</h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 border border-purple-500/30">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderRides = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end mb-6">
        <h2 className="text-2xl font-bold text-white tracking-tight">Active Rides</h2>
      </div>
      <div className="bg-[#11131a] rounded-2xl border border-gray-800 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#181a24] border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider font-semibold">
                <th className="p-5 pl-6">Ride ID</th>
                <th className="p-5">Rider</th>
                <th className="p-5">Driver</th>
                <th className="p-5">Status</th>
                <th className="p-5 pr-6 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50 text-sm">
              {activeRides.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-500">No active rides at the moment.</td>
                </tr>
              ) : (
                activeRides.map((ride) => (
                  <tr key={ride._id} className="hover:bg-gray-800/20 transition-colors">
                    <td className="p-5 pl-6 font-mono text-gray-400">#{ride._id.slice(-6)}</td>
                    <td className="p-5 text-white font-medium">{ride.riderId?.name || "Unknown"}</td>
                    <td className="p-5 text-gray-300">
                      {ride.driverId?.name || <span className="inline-flex items-center text-gray-500 italic"><span className="w-1.5 h-1.5 rounded-full bg-gray-600 mr-2"></span>Unassigned</span>}
                    </td>
                    <td className="p-5">{getStatusBadge(ride.status)}</td>
                    <td className="p-5 pr-6 text-right text-gray-500">{new Date(ride.createdAt).toLocaleTimeString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderDrivers = () => (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-end mb-6">
        <h2 className="text-2xl font-bold text-white tracking-tight">Driver Management</h2>
      </div>
      <div className="bg-[#11131a] rounded-2xl border border-gray-800 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#181a24] border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wider font-semibold">
                <th className="p-5 pl-6">Driver Info</th>
                <th className="p-5">Status</th>
                <th className="p-5">Active Ride</th>
                <th className="p-5 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50 text-sm">
              {drivers.length === 0 ? (
                <tr>
                  <td colSpan="4" className="p-8 text-center text-gray-500">No drivers registered.</td>
                </tr>
              ) : (
                drivers.map((driver) => (
                  <tr key={driver._id} className="hover:bg-gray-800/20 transition-colors">
                    <td className="p-5 pl-6">
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center text-gray-300 font-bold mr-3 border border-gray-600">
                          {driver.userId?.name?.charAt(0) || "D"}
                        </div>
                        <div>
                          <p className="text-white font-medium">{driver.userId?.name || "Unknown"}</p>
                          <p className="text-gray-500 text-xs mt-0.5">{driver.userId?.phone || "No Phone"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-5">
                      {driver.isOnline ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>Online</span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20"><span className="w-1.5 h-1.5 rounded-full bg-gray-500 mr-1.5"></span>Offline</span>
                      )}
                    </td>
                    <td className="p-5">
                      {driver.activeRide ? (
                        <div className="flex items-center text-teal-400 font-mono text-xs bg-teal-500/10 px-2.5 py-1 rounded-md border border-teal-500/20 w-max">
                          #{driver.activeRide._id.slice(-6)}
                        </div>
                      ) : (
                        <span className="text-gray-500 italic text-xs">None</span>
                      )}
                    </td>
                    <td className="p-5 pr-6">
                      <div className="flex items-center justify-end space-x-2">
                        {driver.activeRide && (
                          <button
                            onClick={() => handleClearStuckRide(driver._id)}
                            className="text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg hover:bg-red-500/20 transition-colors shadow-sm"
                          >
                            Clear Ride
                          </button>
                        )}
                        <button
                          onClick={() => handleForceStatus(driver._id, driver.isOnline)}
                          className={`text-xs font-medium border px-3 py-1.5 rounded-lg transition-colors shadow-sm ${
                            driver.isOnline
                              ? "bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white"
                              : "bg-teal-500/10 text-teal-400 border-teal-500/20 hover:bg-teal-500/20"
                          }`}
                        >
                          {driver.isOnline ? "Force Offline" : "Force Online"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0c10] text-gray-200 font-sans selection:bg-teal-500/30 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-[#11131a] border-r border-gray-800 flex flex-col fixed inset-y-0 z-20">
        <div className="h-20 flex items-center px-8 border-b border-gray-800/50">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center font-bold text-gray-900 mr-3 shadow-lg shadow-teal-500/20">
            A
          </div>
          <span className="text-lg font-bold text-white tracking-tight">AdminPortal</span>
        </div>
        
        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all relative ${
              activeTab === "dashboard"
                ? "bg-teal-500/10 text-teal-400 shadow-sm"
                : "text-gray-400 hover:bg-gray-800/50 hover:text-white"
            }`}
          >
            {activeTab === "dashboard" && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-teal-400 rounded-r-full"></div>}
            <DashboardIcon />
            Overview
          </button>
          
          <button
            onClick={() => setActiveTab("rides")}
            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all relative ${
              activeTab === "rides"
                ? "bg-teal-500/10 text-teal-400 shadow-sm"
                : "text-gray-400 hover:bg-gray-800/50 hover:text-white"
            }`}
          >
            {activeTab === "rides" && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-teal-400 rounded-r-full"></div>}
            <MapIcon />
            Active Rides
          </button>
          
          <button
            onClick={() => setActiveTab("drivers")}
            className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all relative ${
              activeTab === "drivers"
                ? "bg-teal-500/10 text-teal-400 shadow-sm"
                : "text-gray-400 hover:bg-gray-800/50 hover:text-white"
            }`}
          >
            {activeTab === "drivers" && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-teal-400 rounded-r-full"></div>}
            <UsersIcon />
            Driver Management
          </button>
        </nav>
        
        <div className="p-4 border-t border-gray-800/50">
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-3 text-sm font-medium text-red-400 rounded-xl hover:bg-red-500/10 hover:text-red-300 transition-colors group"
          >
            <LogoutIcon />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="h-20 bg-[#0a0c10]/80 backdrop-blur-xl border-b border-gray-800/50 flex items-center justify-between px-8 sticky top-0 z-10">
          <div className="text-gray-400 text-sm">
            Welcome back, <span className="text-white font-semibold">Administrator</span>
          </div>
          <div className="flex items-center space-x-4">
            <div className="h-8 w-8 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
            </div>
          </div>
        </header>

        {/* Dynamic Content Area */}
        <div className="p-8 max-w-7xl mx-auto w-full">
          {loading ? (
            <div className="flex items-center justify-center h-[60vh]">
              <div className="w-10 h-10 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {activeTab === "dashboard" && renderDashboard()}
              {activeTab === "rides" && renderRides()}
              {activeTab === "drivers" && renderDrivers()}
            </>
          )}
        </div>
      </main>
    </div>
  );
};

