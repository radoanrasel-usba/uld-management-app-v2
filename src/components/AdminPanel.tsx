import React, { useState, useEffect } from 'react';
import { Shield, Users, History, Database, ShieldAlert, RefreshCw, Trash2, Search, Filter, AlertTriangle, Play, CheckCircle, XCircle, Download, Upload } from 'lucide-react';
import { UserProfile, ULD, ULDHistory, UserLog, DBBackup } from '../types';

interface AdminPanelProps {
  token: string;
  userEmail: string;
  userRole?: string;
  ulds: ULD[];
  onClose: () => void;
  onRefreshData: () => void;
  activeTab?: 'alerts' | 'audits' | 'tracking' | 'backups' | 'users';
  setActiveTab?: (tab: 'alerts' | 'audits' | 'tracking' | 'backups' | 'users') => void;
  showToast?: (message: string, type: 'success' | 'error' | 'info', actionName?: string) => void;
}

export default function AdminPanel({
  token,
  userEmail,
  userRole = 'user',
  ulds,
  onClose,
  onRefreshData,
  activeTab: propActiveTab,
  setActiveTab: propSetActiveTab,
  showToast
}: AdminPanelProps) {
  const [internalTab, setInternalTab] = useState<'alerts' | 'audits' | 'tracking' | 'backups' | 'users'>('alerts');
  const activeTab = propActiveTab || internalTab;
  const setActiveTab = propSetActiveTab || setInternalTab;
  
  // States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [importStatusPopup, setImportStatusPopup] = useState<{ show: boolean; success: boolean; message: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    confirmVariant?: 'danger' | 'primary';
    onConfirm: () => void;
  } | null>(null);

  // Data States
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<UserLog[]>([]);
  const [backupsList, setBackupsList] = useState<DBBackup[]>([]);
  const [alertsList, setAlertsList] = useState<any[]>([]);

  // Tracking tab states
  const [searchUldNum, setSearchUldNum] = useState('');
  const [trackingHistory, setTrackingHistory] = useState<ULDHistory[]>([]);
  const [trackingLoading, setTrackingLoading] = useState(false);

  // Search & Filter state for Audit Logs
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilterStatus, setAuditFilterStatus] = useState<string>('ALL');

  // Backup creation state
  const [newBackupName, setNewBackupName] = useState('');
  const [newBackupDesc, setNewBackupDesc] = useState('');

  // Auto-refresh interval for alerts
  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(() => {
      fetchAlerts();
    }, 4000); // Poll every 4 seconds for real-time security threats
    return () => clearInterval(interval);
  }, []);

  // Fetch data when tab changes
  useEffect(() => {
    setError(null);
    setSuccessMsg(null);
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'audits') {
      fetchAuditLogs();
    } else if (activeTab === 'backups') {
      fetchBackups();
      fetchAuditLogs();
    }
  }, [activeTab]);

  // Fetch functions
  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/admin/alerts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAlertsList(data);
      }
    } catch (err) {
      console.error('Error fetching alerts:', err);
    }
  };

  const clearAlert = async (id: string) => {
    try {
      const res = await fetch('/api/admin/alerts/clear', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        fetchAlerts();
        showSuccess('Alert resolved successfully.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsersList(data);
      } else {
        throw new Error('Failed to fetch users list.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/logs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      } else {
        throw new Error('Failed to fetch audit activity logs.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearLogs = () => {
    setConfirmModal({
      isOpen: true,
      title: 'CLEAR COMPLIANCE AUDIT LOGS',
      message: 'Are you sure you want to PERMANENTLY CLEAR all compliance audit logs? This action will purge all log history from server storage.',
      confirmLabel: 'CLEAR ALL LOGS',
      confirmVariant: 'danger',
      onConfirm: executeClearLogs
    });
  };

  const executeClearLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/logs', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        setAuditLogs([]);
        if (showToast) {
          showToast('AUDIT LOGS CLEARED: All compliance logs purged from server memory permanently.', 'success', 'LOGS_CLEARED');
        } else {
          showSuccess('All compliance audit logs cleared successfully.');
        }
        fetchAuditLogs();
      } else {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to clear compliance logs.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/backups', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBackupsList(data);
      } else {
        throw new Error('Failed to fetch backups.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetRole = async (uid: string, nextRole: 'visitor' | 'user' | 'admin') => {
    // Instant optimistic state change
    setUsersList(prev => prev.map(u => u.uid === uid ? { ...u, role: nextRole } : u));
    
    if (showToast) {
      const targetUser = usersList.find(u => u.uid === uid);
      const namePrefix = targetUser ? targetUser.email.split('@')[0].toUpperCase() : 'USER';
      showToast(`ROLE UPDATED: Operator ${namePrefix} set to ${nextRole.toUpperCase()} privilege node instantly.`, 'info', 'ROLE_UPGRADE');
    }

    try {
      const res = await fetch('/api/admin/users/role', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ uid, role: nextRole })
      });

      if (!res.ok) {
        throw new Error('Failed to modify role.');
      }
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
      fetchUsers();
    }
  };

  const handleUpdateStatus = async (uid: string, nextStatus: string) => {
    // Instant optimistic state change
    setUsersList(prev => prev.map(u => u.uid === uid ? { ...u, status: nextStatus } : u));

    if (showToast) {
      const targetUser = usersList.find(u => u.uid === uid);
      const namePrefix = targetUser ? targetUser.email.split('@')[0].toUpperCase() : 'USER';
      showToast(`CLEARANCE CHANGED: ${namePrefix} set to ${nextStatus.toUpperCase()} instantly.`, nextStatus === 'approved' ? 'success' : 'error', 'USER_STATUS');
    }

    try {
      const res = await fetch('/api/admin/users/status', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ uid, status: nextStatus })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to modify clearance status.');
      }
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
      fetchUsers();
    }
  };

  const handleDeleteUser = (uid: string, email: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'REMOVE USER ACCOUNT',
      message: `Are you sure you want to permanently REMOVE user ${email}? Account permissions will be revoked immediately.`,
      confirmLabel: 'REMOVE USER',
      confirmVariant: 'danger',
      onConfirm: () => executeDeleteUser(uid, email)
    });
  };

  const executeDeleteUser = async (uid: string, email: string) => {
    // Optimistic removal
    setUsersList(prev => prev.filter(u => u.uid !== uid));

    if (showToast) {
      showToast(`USER PURGED: Account ${email.split('@')[0].toUpperCase()} completely removed.`, 'error', 'USER_DELETE');
    }

    try {
      const res = await fetch(`/api/admin/users/${uid}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to remove user.');
      }
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
      fetchUsers();
    }
  };

  const handleCreateBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBackupName.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/backups', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newBackupName.trim(),
          description: newBackupDesc.trim()
        })
      });

      if (res.ok) {
        showSuccess('System backup archive created successfully!');
        setNewBackupName('');
        setNewBackupDesc('');
        fetchBackups();
      } else {
        throw new Error('Failed to generate backup.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreBackup = (id: number) => {
    setConfirmModal({
      isOpen: true,
      title: 'RESTORE DATABASE SNAPSHOT',
      message: 'CRITICAL WARNING: Restoring this backup will OVERWRITE the entire active database state (including all ULD stock counts, logs, and registered users) with the state saved in this snapshot. Do you want to proceed?',
      confirmLabel: 'RESTORE SNAPSHOT',
      confirmVariant: 'danger',
      onConfirm: () => executeRestoreBackup(id)
    });
  };

  const executeRestoreBackup = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/backups/restore/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        if (showToast) {
          showToast('SNAPSHOT RESTORED: Database rolled back to selected snapshot state successfully.', 'success', 'RESTORE_SNAPSHOT');
        } else {
          showSuccess('SYSTEM RESTORE COMPLETED SUCCESSFULLY. Database state rolled back.');
        }
        onRefreshData();
        fetchBackups();
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Restore failed.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportJSON = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/backup/export', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Data export failed. Server error.');
      const data = await res.json();
      
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(data, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      const dateStr = new Date().toISOString().split('T')[0];
      downloadAnchor.setAttribute('download', `us_bangla_uld_backup_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      
      if (showToast) {
        showToast('DATA EXPORTED: Full system database backup downloaded successfully as JSON.', 'success', 'DATA_EXPORT');
      } else {
        showSuccess('System backup JSON downloaded successfully!');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to download JSON backup.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const inputElem = e.target;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const jsonContent = JSON.parse(event.target?.result as string);
        setConfirmModal({
          isOpen: true,
          title: 'CONFIRM DATABASE FILE RESTORE',
          message: `CRITICAL WARNING: File "${file.name}" loaded. Importing this backup file will OVERWRITE the entire active database state (ULD fleet counts, logs, and user roles). Proceed with restore?`,
          confirmLabel: 'OVERWRITE & RESTORE',
          confirmVariant: 'danger',
          onConfirm: () => executeImportJSON(jsonContent)
        });
      } catch (parseErr: any) {
        setImportStatusPopup({
          show: true,
          success: false,
          message: `FAILURE: Selected file "${file.name}" is not a valid JSON database backup file. Error details: ${parseErr.message}`
        });
      } finally {
        inputElem.value = '';
      }
    };

    reader.onerror = () => {
      setImportStatusPopup({
        show: true,
        success: false,
        message: `FAILURE: Could not read file "${file.name}".`
      });
      inputElem.value = '';
    };

    reader.readAsText(file);
  };

  const executeImportJSON = async (json: any) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/backup/import', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(json)
      });

      if (res.ok) {
        setImportStatusPopup({
          show: true,
          success: true,
          message: 'SUCCESS: Database has been fully restored from the uploaded backup file. All active ULD counts, logs, and registered users are updated successfully.'
        });
        if (showToast) {
          showToast('DATA RESTORED: Database fully restored from uploaded JSON backup file.', 'success', 'DATA_IMPORT');
        } else {
          showSuccess('Database fully restored from uploaded JSON file!');
        }
        onRefreshData();
        fetchBackups();
      } else {
        let errMsg = `Server returned status ${res.status}`;
        try {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errData = await res.json();
            if (errData && errData.error) errMsg = errData.error;
          } else {
            const rawText = await res.text();
            if (rawText) {
              // Strip HTML tags if any
              const plain = rawText.replace(/<[^>]*>?/gm, '').trim();
              errMsg = plain.slice(0, 300) || errMsg;
            }
          }
        } catch (_) {
          // fallback to status code message
        }
        throw new Error(errMsg);
      }
    } catch (err: any) {
      const errMsg = err.message || 'Import failed.';
      setError(errMsg);
      setImportStatusPopup({
        show: true,
        success: false,
        message: `FAILURE: Failed to restore database. ${errMsg}`
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearchHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchUldNum.trim()) return;

    setTrackingLoading(true);
    setTrackingHistory([]);
    setError(null);
    try {
      const res = await fetch(`/api/ulds/history/${searchUldNum.trim().toUpperCase()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTrackingHistory(data);
      } else {
        throw new Error('Failed to find history for this ULD number.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setTrackingLoading(false);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  // Filtered audit logs
  const filteredAudits = auditLogs.filter(log => {
    const matchesSearch = log.userEmail.toLowerCase().includes(auditSearch.toLowerCase()) || 
                          (log.details && log.details.toLowerCase().includes(auditSearch.toLowerCase())) ||
                          log.action.toLowerCase().includes(auditSearch.toLowerCase());
    
    const matchesFilter = auditFilterStatus === 'ALL' || log.status === auditFilterStatus;

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 w-full max-w-7xl mx-auto">
      
      {/* Message Banner alerts */}
      {error && (
        <div className="bg-red-950/40 border border-red-900/60 text-red-200 text-sm p-4 rounded-xl flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-950/40 border border-emerald-900/60 text-emerald-200 text-sm p-4 rounded-xl flex items-start gap-2">
          <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Tab Buttons */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-xl">
        <button
          onClick={() => {
            if (userRole !== 'admin') {
              if (showToast) showToast('ACCESS DENIED: Real-Time Access Threats requires Admin clearance.', 'error', 'SHIELD_WARN');
            } else {
              setActiveTab('alerts');
            }
          }}
          className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-mono text-xs tracking-wider transition cursor-pointer ${
            activeTab === 'alerts'
              ? 'bg-sky-600 text-white shadow font-bold'
              : userRole !== 'admin'
              ? 'text-slate-600 cursor-not-allowed'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <ShieldAlert className="h-4 w-4" />
          <span>ALERTS {userRole === 'admin' && `(${alertsList.length})`}</span>
          {userRole !== 'admin' && <span className="text-[10px] text-amber-500 font-bold">(ADMIN)</span>}
        </button>

        <button
          onClick={() => {
            if (userRole !== 'admin') {
              if (showToast) showToast('ACCESS DENIED: Compliance Audit logs require Admin clearance.', 'error', 'SHIELD_WARN');
            } else {
              setActiveTab('audits');
            }
          }}
          className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-mono text-xs tracking-wider transition cursor-pointer ${
            activeTab === 'audits'
              ? 'bg-sky-600 text-white shadow font-bold'
              : userRole !== 'admin'
              ? 'text-slate-600 cursor-not-allowed'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>AUDIT TRAIL</span>
          {userRole !== 'admin' && <span className="text-[10px] text-amber-500 font-bold">(ADMIN)</span>}
        </button>

        <button
          onClick={() => setActiveTab('tracking')}
          className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-mono text-xs tracking-wider transition cursor-pointer ${
            activeTab === 'tracking'
              ? 'bg-sky-600 text-white shadow font-bold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <History className="h-4 w-4" />
          ULD TRACKING
        </button>

        <button
          onClick={() => setActiveTab('backups')}
          className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-mono text-xs tracking-wider transition cursor-pointer ${
            activeTab === 'backups'
              ? 'bg-sky-600 text-white shadow font-bold'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Database className="h-4 w-4" />
          BACKUP / RESTORE
        </button>

        <button
          onClick={() => {
            if (userRole !== 'admin') {
              if (showToast) showToast('ACCESS DENIED: Roles Manager requires Admin clearance.', 'error', 'SHIELD_WARN');
            } else {
              setActiveTab('users');
            }
          }}
          className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-mono text-xs tracking-wider transition cursor-pointer col-span-2 md:col-span-1 ${
            activeTab === 'users'
              ? 'bg-sky-600 text-white shadow font-bold'
              : userRole !== 'admin'
              ? 'text-slate-600 cursor-not-allowed'
              : 'text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>ROLES MANAGER</span>
          {userRole !== 'admin' && <span className="text-[10px] text-amber-500 font-bold">(ADMIN)</span>}
        </button>
      </div>

      {/* Tab Contents */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 min-h-[400px]">

          {/* 1. SECURITY & ACCESS ALERTS TAB */}
          {activeTab === 'alerts' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-lg font-bold text-white font-display">REAL-TIME ACCESS THREAT DETECTION</h2>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">Suspicious activities & unauthorized access attempts</p>
                </div>
                <button
                  onClick={fetchAlerts}
                  className="p-2 hover:bg-slate-850 rounded-lg border border-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>

              {alertsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-full mb-4">
                    <CheckCircle className="h-8 w-8 text-emerald-400" />
                  </div>
                  <h3 className="text-sm font-mono font-bold text-slate-300">SYSTEM SECURE</h3>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">No unauthorized intrusion attempts or unusual session anomalies detected within past log cycles.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {alertsList.map((alert) => (
                    <div
                      key={alert.id}
                      className="alert-pulse-container border border-red-500/40 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 shrink-0">
                          <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="bg-red-950/80 text-red-400 text-[10px] font-bold font-mono px-2 py-0.5 rounded border border-red-800/40">
                              {alert.severity} SEVERITY
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {new Date(alert.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-red-200">{alert.message}</p>
                          <div className="text-xs text-slate-400 font-mono">
                            User email: <span className="text-slate-300 font-bold">{alert.userEmail}</span> | IP: <span className="text-slate-300">{alert.ipAddress || 'unknown'}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => clearAlert(alert.id)}
                        className="bg-red-950/40 hover:bg-red-900/50 border border-red-900/60 text-red-200 text-xs px-3 py-1.5 rounded-lg font-mono transition text-center shrink-0 cursor-pointer"
                      >
                        DISMISS ALERT
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 2. AUDIT TRAIL LOGS TAB */}
          {activeTab === 'audits' && (
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-lg font-bold text-white font-display">SYSTEM LOGS & COMPLIANCE AUDIT</h2>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">Chronological list of actions performed across the node</p>
                </div>

                {/* Filter / Search controls & CLEAR LOG button */}
                <div className="flex flex-col sm:flex-row items-center gap-2 shrink-0">
                  <div className="relative flex items-center bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 focus-within:border-blue-500">
                    <Search className="h-4 w-4 text-slate-500 shrink-0 mr-2" />
                    <input
                      type="text"
                      placeholder="Search email, action, details..."
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                      className="bg-transparent text-xs text-white focus:outline-none w-48 font-mono placeholder:text-slate-600"
                    />
                  </div>

                  <select
                    value={auditFilterStatus}
                    onChange={(e) => setAuditFilterStatus(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-300 focus:outline-none focus:border-blue-500"
                  >
                    <option value="ALL">ALL STATUSES</option>
                    <option value="SUCCESS">SUCCESS</option>
                    <option value="FAILURE">FAILURE</option>
                    <option value="SUSPICIOUS">SUSPICIOUS</option>
                    <option value="ALERT">ALERT</option>
                  </select>

                  <button
                    onClick={handleClearLogs}
                    disabled={loading || auditLogs.length === 0}
                    className="bg-red-950 hover:bg-red-900 border border-red-800/80 text-red-200 hover:text-white text-xs font-mono font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed uppercase shadow-sm"
                    id="clear-logs-btn"
                    title="Permanently delete all audit logs"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                    <span>CLEAR LOG</span>
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-12 text-slate-400 font-mono text-xs">QUERYING AUDIT TRAILS...</div>
              ) : filteredAudits.length === 0 ? (
                <div className="text-center py-12 text-slate-500 font-mono text-xs">No matching system logs discovered in this query range.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs whitespace-nowrap">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-800 uppercase text-[10px]">
                        <th className="pb-2">TIMESTAMP</th>
                        <th className="pb-2">USER EMAIL</th>
                        <th className="pb-2">ACTION</th>
                        <th className="pb-2">STATUS</th>
                        <th className="pb-2">IP ADDRESS</th>
                        <th className="pb-2">DETAILS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/55">
                      {filteredAudits.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-850/20">
                          <td className="py-2.5 text-slate-400">{new Date(log.timestamp).toLocaleString('en-GB')}</td>
                          <td className="py-2.5 font-bold text-slate-300">{log.userEmail}</td>
                          <td className="py-2.5"><span className="text-blue-400 font-bold">{log.action}</span></td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              log.status === 'SUCCESS' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/40' :
                              log.status === 'SUSPICIOUS' ? 'bg-yellow-950 text-yellow-400 border border-yellow-900/40' :
                              log.status === 'ALERT' ? 'bg-red-950 text-red-400 border border-red-900/40 animate-pulse' :
                              'bg-slate-900 text-slate-400 border border-slate-800'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="py-2.5 text-slate-400">{log.ipAddress || '---'}</td>
                          <td className="py-2.5 text-slate-300 max-w-xs truncate">{log.details || '---'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* 3. ULD TRACKING LOGS TAB */}
          {activeTab === 'tracking' && (
            <div className="space-y-6">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-lg font-bold text-white font-display">3-MONTH COMPREHENSIVE ULD RUNTIME HISTORY</h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">Check any container/pallet tracking records for seamless operational compliance</p>
              </div>

              <form onSubmit={handleSearchHistory} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type ULD serial number manually..."
                  value={searchUldNum}
                  onChange={(e) => setSearchUldNum(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 font-mono w-full max-w-sm placeholder:text-slate-600"
                />
                
                <button
                  type="submit"
                  disabled={trackingLoading || !searchUldNum.trim()}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold px-6 py-3 rounded-xl transition disabled:opacity-55 cursor-pointer flex items-center gap-1.5"
                >
                  {trackingLoading ? 'TRACKING...' : 'RUN QUERY'}
                </button>
              </form>

              {trackingLoading ? (
                <div className="text-center py-12 text-slate-400 font-mono text-xs">QUERYING DATA CHANNELS...</div>
              ) : trackingHistory.length === 0 ? (
                <div className="text-center py-12 text-slate-500 font-mono text-xs">
                  {searchUldNum ? 'No records discovered for this unit serial.' : 'Type a ULD serial number above to track.'}
                </div>
              ) : (
                <div className="relative border-l-2 border-slate-800 ml-4 pl-6 space-y-6">
                  {trackingHistory.map((hist) => (
                    <div key={hist.id} className="relative">
                      {/* Timeline dot */}
                      <span className="absolute -left-[31px] top-1.5 flex h-4 w-4 bg-[#070b19] border-2 border-blue-500 rounded-full justify-center items-center">
                        <span className="h-1.5 w-1.5 bg-blue-500 rounded-full"></span>
                      </span>

                      <div className="bg-[#0b0f19] border border-slate-850 p-4 rounded-xl space-y-2">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                          <span className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded border ${
                            hist.action === 'CREATE' ? 'bg-emerald-950 text-emerald-400 border-emerald-900/40' :
                            hist.action === 'SEND' ? 'bg-blue-950 text-blue-400 border-blue-900/40' :
                            hist.action === 'RECEIVE' ? 'bg-violet-950 text-violet-400 border-violet-900/40' :
                            hist.action === 'STATUS_CHANGE' ? 'bg-amber-950 text-amber-400 border-amber-900/40' :
                            'bg-red-950 text-red-400 border-red-900/40'
                          }`}>
                            {hist.action}
                          </span>
                          <span className="text-xs text-slate-500 font-mono">
                            {new Date(hist.timestamp).toLocaleString('en-GB')}
                          </span>
                        </div>

                        <div className="text-sm font-semibold text-slate-200">
                          {hist.action === 'SEND' && `Sent to station ${hist.destinationStation} from Dhaka`}
                          {hist.action === 'RECEIVE' && `Received at Dhaka Stock from ${hist.originStation}`}
                          {hist.action === 'CREATE' && `Initial storage registration at Dhaka`}
                          {hist.action === 'STATUS_CHANGE' && `Operational status update`}
                          {hist.action === 'REMOVE' && `Removed from active status stock`}
                        </div>

                        <div className="text-xs text-slate-400 font-mono">
                          Operator: <span className="text-slate-300 font-bold">{hist.performedBy}</span>
                          {hist.remarks && ` | Remarks: "${hist.remarks}"`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. DATA BACKUP/RESTORE TAB */}
          {activeTab === 'backups' && (
            <div className="space-y-6">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-lg font-bold text-white font-display">DATA BACKUP/RESTORE</h2>
                <p className="text-sm text-slate-400 font-mono mt-0.5">Download a complete JSON database dump or upload a file to restore state instantly</p>
              </div>

              {/* Direct JSON Export/Import Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Export Card */}
                <div className="bg-slate-950/60 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sky-400">
                      <Download className="h-5 w-5" />
                      <h3 className="text-sm font-mono font-bold uppercase tracking-wider">Download Database (Export)</h3>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed font-sans">
                      Click the download button to generate a complete offline backup file (`.json`). This file contains all registered users, active ULD fleet units, audit logs, and status records.
                    </p>
                  </div>
                  <button
                    onClick={handleExportJSON}
                    disabled={loading}
                    className="w-full bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-mono font-bold py-2.5 px-4 rounded-xl transition cursor-pointer flex items-center justify-center gap-2 text-sm shadow-lg shadow-sky-500/10"
                  >
                    <Download className="h-4 w-4" />
                    {loading ? 'EXPORTING...' : 'DOWNLOAD FILE'}
                  </button>
                </div>

                {/* Import Card */}
                <div className="bg-slate-950/60 border border-slate-800 p-5 rounded-xl space-y-4 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-amber-500">
                      <Upload className="h-5 w-5" />
                      <h3 className="text-sm font-mono font-bold uppercase tracking-wider">Upload Database (Restore)</h3>
                    </div>
                    <p className="text-sm text-slate-400 leading-relaxed font-sans">
                      Select a previously downloaded backup JSON file to overwrite the active database state. This will immediately restore all registered accounts and operational histories.
                    </p>
                  </div>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportJSON}
                      disabled={loading}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                    />
                    <div className="w-full bg-slate-900 border-2 border-dashed border-slate-700 hover:border-amber-500/55 rounded-xl py-2.5 px-4 text-center font-mono text-sm text-slate-400 transition flex items-center justify-center gap-2">
                      <Upload className="h-4 w-4 text-amber-500" />
                      <span>{loading ? 'IMPORTING...' : 'UPLOAD & RESTORE FILE'}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* 3-MONTH BACKUP & RESTORE HISTORY BAR */}
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-mono font-bold text-sky-400 uppercase tracking-wide flex items-center gap-2">
                    <History className="h-4 w-4" />
                    <span>BACKUP & RESTORE AUDIT HISTORY (3-MONTH RECORD)</span>
                  </h3>
                  <span className="text-[11px] font-mono text-slate-500">Auto-retained 90 days</span>
                </div>

                {auditLogs.filter(log => {
                  const isBackupLog = 
                    log.action === 'DATABASE_EXPORT_JSON' || 
                    log.action === 'BACKUP_RESTORE_JSON' ||
                    log.action === 'BACKUP_RESTORE' ||
                    log.action === 'DATA_EXPORT' ||
                    log.details?.toLowerCase().includes('backup') ||
                    log.details?.toLowerCase().includes('json') ||
                    log.details?.toLowerCase().includes('export') ||
                    log.details?.toLowerCase().includes('restore');
                  
                  if (!isBackupLog) return false;
                  const logTime = new Date(log.timestamp).getTime();
                  const threeMonthsAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
                  return logTime >= threeMonthsAgo;
                }).length === 0 ? (
                  <div className="text-slate-500 font-mono text-xs text-center py-8 border border-slate-800 border-dashed rounded-xl bg-slate-950/40">
                    No backup download or upload restore records found in history within the last 3 months.
                  </div>
                ) : (
                  <div className="overflow-x-auto bg-slate-950/80 border border-slate-800 rounded-xl">
                    <table className="w-full text-left font-mono text-xs text-slate-300">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-500 text-[11px] uppercase bg-slate-900/60">
                          <th className="py-2.5 px-4">DATE & TIME</th>
                          <th className="py-2.5 px-4">OPERATOR EMAIL</th>
                          <th className="py-2.5 px-4">ACTION TYPE</th>
                          <th className="py-2.5 px-4">STATUS</th>
                          <th className="py-2.5 px-4">ACTIVITY DETAILS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {auditLogs
                          .filter(log => {
                            const isBackupLog = 
                              log.action === 'DATABASE_EXPORT_JSON' || 
                              log.action === 'BACKUP_RESTORE_JSON' ||
                              log.action === 'BACKUP_RESTORE' ||
                              log.action === 'DATA_EXPORT' ||
                              log.details?.toLowerCase().includes('backup') ||
                              log.details?.toLowerCase().includes('json') ||
                              log.details?.toLowerCase().includes('export') ||
                              log.details?.toLowerCase().includes('restore');
                            
                            if (!isBackupLog) return false;
                            const logTime = new Date(log.timestamp).getTime();
                            const threeMonthsAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
                            return logTime >= threeMonthsAgo;
                          })
                          .map((log) => (
                            <tr key={log.id} className="hover:bg-slate-900/40">
                              <td className="py-3 px-4 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                                {new Date(log.timestamp).toLocaleString('en-GB')}
                              </td>
                              <td className="py-3 px-4 font-bold text-white">{log.email}</td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  log.action.includes('EXPORT') || log.action.includes('DOWNLOAD')
                                    ? 'bg-sky-950 text-sky-400 border border-sky-900/50'
                                    : 'bg-amber-950 text-amber-400 border border-amber-900/50'
                                }`}>
                                  {log.action.includes('EXPORT') ? 'FILE DOWNLOAD (EXPORT)' : 'FILE UPLOAD (RESTORE)'}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className="text-emerald-400 font-bold text-[11px]">● SUCCESS</span>
                              </td>
                              <td className="py-3 px-4 text-slate-400 max-w-xs truncate text-[11px]">
                                {log.details}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5. USER ROLES TAB */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="border-b border-slate-800 pb-3">
                <h2 className="text-lg font-bold text-white font-display">USER MANAGEMENT & ROLE AUTHENTICATION</h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">Control access rights, approve registrations, and promote users to Admin permissions role</p>
              </div>

              {loading ? (
                <div className="text-center py-12 text-slate-400 font-mono text-xs">QUERYING ROLE DATABASES...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs whitespace-nowrap">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-800 uppercase text-[10px]">
                        <th className="pb-2">DATABASE ID</th>
                        <th className="pb-2">USER EMAIL</th>
                        <th className="pb-2">CLEARANCE STATUS</th>
                        <th className="pb-2">CURRENT ROLE</th>
                        <th className="pb-2">JOINED</th>
                        <th className="pb-2 text-right">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/55">
                      {[...usersList].sort((a, b) => {
                        if (a.status === 'rejected' && b.status !== 'rejected') return 1;
                        if (b.status === 'rejected' && a.status !== 'rejected') return -1;
                        return Number(b.id) - Number(a.id);
                      }).map((profile) => (
                        <tr key={profile.id} className="hover:bg-slate-850/20">
                          <td className="py-2.5 text-slate-500 font-bold">{profile.id}</td>
                          <td className="py-2.5 font-bold text-slate-300">
                            {profile.email} {profile.email === userEmail && <span className="text-[9px] text-blue-400 border border-blue-500/20 px-1 py-0.2 rounded font-normal ml-1">YOU</span>}
                          </td>
                          <td className="py-2.5">
                            <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                              profile.status === 'approved' ? 'bg-emerald-950/80 text-emerald-400 border-emerald-900/40' :
                              profile.status === 'rejected' ? 'bg-red-950/80 text-red-400 border-red-900/40' :
                              'bg-amber-950/80 text-amber-400 border-amber-900/40 animate-pulse'
                            }`}>
                              {profile.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-2.5">
                            <div className="flex items-center gap-1">
                              <button
                                disabled={profile.email === userEmail || loading}
                                onClick={() => handleSetRole(profile.uid, 'visitor')}
                                title="Set role to VISITOR (View Only)"
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer disabled:opacity-50 ${
                                  profile.role === 'visitor'
                                    ? 'bg-amber-950 text-amber-400 border-amber-800 shadow-sm'
                                    : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                                }`}
                              >
                                VISITOR
                              </button>
                              <button
                                disabled={profile.email === userEmail || loading}
                                onClick={() => handleSetRole(profile.uid, 'user')}
                                title="Set role to USER (Standard Clearance)"
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer disabled:opacity-50 ${
                                  profile.role === 'user'
                                    ? 'bg-sky-950 text-sky-400 border-sky-800 shadow-sm'
                                    : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                                }`}
                              >
                                USER
                              </button>
                              <button
                                disabled={profile.email === userEmail || loading}
                                onClick={() => handleSetRole(profile.uid, 'admin')}
                                title="Set role to ADMIN (Full Security Control)"
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border transition cursor-pointer disabled:opacity-50 ${
                                  profile.role === 'admin'
                                    ? 'bg-blue-950 text-blue-400 border-blue-800 shadow-sm'
                                    : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                                }`}
                              >
                                ADMIN
                              </button>
                            </div>
                          </td>
                          <td className="py-2.5 text-slate-450">{new Date(profile.createdAt).toLocaleDateString('en-GB')}</td>
                          <td className="py-2.5 text-right space-x-2">

                            {profile.status !== 'approved' && (
                              <button
                                disabled={profile.email === userEmail || loading}
                                onClick={() => handleUpdateStatus(profile.uid, 'approved')}
                                className="bg-emerald-950 hover:bg-emerald-900/40 border border-emerald-800/60 text-emerald-400 text-[11px] px-2 py-1 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                              >
                                Approve
                              </button>
                            )}

                            {profile.status !== 'rejected' && (
                              <button
                                disabled={profile.email === userEmail || loading}
                                onClick={() => handleUpdateStatus(profile.uid, 'rejected')}
                                className="bg-red-955 hover:bg-red-900/40 border border-red-800/60 text-red-450 text-[11px] px-2 py-1 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                              >
                                Reject
                              </button>
                            )}

                            <button
                              disabled={profile.email === userEmail || loading}
                              onClick={() => handleDeleteUser(profile.uid, profile.email)}
                              className="bg-rose-950/80 hover:bg-rose-900 border border-rose-800/60 text-rose-200 text-[11px] px-2 py-1 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer font-bold"
                            >
                              REMOVE
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>

        {/* UNIQUE AND MODERN RESTORE STATUS MODAL POPUP */}
        {importStatusPopup && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 relative flex flex-col items-center text-center animate-fade-in">
              <div className={`h-16 w-16 rounded-full flex items-center justify-center mb-4 ${
                importStatusPopup.success 
                  ? 'bg-emerald-950/80 border border-emerald-500/30 text-emerald-400' 
                  : 'bg-red-955/80 border border-red-500/30 text-red-400'
              }`}>
                {importStatusPopup.success ? (
                  <CheckCircle className="h-8 w-8 text-emerald-400" />
                ) : (
                  <XCircle className="h-8 w-8 text-red-400" />
                )}
              </div>

              <h3 className="text-lg font-bold text-white font-mono uppercase tracking-wider mb-2">
                {importStatusPopup.success ? 'RESTORE COMPLETED' : 'RESTORE FAILED'}
              </h3>

              <p className="text-sm font-mono text-slate-300 mb-6 leading-relaxed bg-slate-950/50 p-4 rounded-xl border border-slate-850 w-full text-left max-h-48 overflow-y-auto">
                {importStatusPopup.message}
              </p>

              <button
                onClick={() => setImportStatusPopup(null)}
                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-bold font-mono text-xs uppercase py-3 rounded-xl transition shadow-lg shadow-sky-500/10 cursor-pointer"
              >
                ACKNOWLEDGE & CLOSE
              </button>
            </div>
          </div>
        )}
        {/* CUSTOM CONFIRMATION DIALOG MODAL */}
        {confirmModal && confirmModal.isOpen && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[110] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 relative flex flex-col items-center text-center animate-fade-in">
              <div className="h-14 w-14 rounded-full bg-amber-950/80 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-4">
                <AlertTriangle className="h-7 w-7 text-amber-400" />
              </div>

              <h3 className="text-base font-bold text-white font-mono uppercase tracking-wider mb-2">
                {confirmModal.title}
              </h3>

              <p className="text-xs font-mono text-slate-300 mb-6 leading-relaxed bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80 text-left w-full">
                {confirmModal.message}
              </p>

              <div className="flex items-center gap-3 w-full">
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold font-mono text-xs uppercase py-2.5 rounded-xl transition cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const action = confirmModal.onConfirm;
                    setConfirmModal(null);
                    action();
                  }}
                  className={`flex-1 text-white font-bold font-mono text-xs uppercase py-2.5 rounded-xl transition cursor-pointer shadow-lg ${
                    confirmModal.confirmVariant === 'danger'
                      ? 'bg-red-600 hover:bg-red-500 shadow-red-600/20'
                      : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
                  }`}
                >
                  {confirmModal.confirmLabel || 'CONFIRM'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
  );
}
