import React, { useState } from 'react';
import { STATIONS, ULD } from '../types';
import { PlaneTakeoff, PlaneLanding, Plus, ShieldAlert, ArrowLeftRight, Trash2, Calendar } from 'lucide-react';

interface UldFormsProps {
  currentForm: 'add' | 'status' | 'send' | 'receive' | 'remove' | null;
  ulds: ULD[];
  onClose: () => void;
  onSuccess: () => void;
  token: string;
  showToast?: (message: string, type: 'success' | 'error' | 'info', actionName?: string) => void;
}

export default function UldForms({ currentForm, ulds, onClose, onSuccess, token, showToast }: UldFormsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [uldType, setUldType] = useState<'AKE' | 'PMC'>('AKE');
  const [uldNumber, setUldNumber] = useState('');
  
  // Status State
  const [selectedUldId, setSelectedUldId] = useState<number | ''>('');
  const [newStatus, setNewStatus] = useState<'ACTIVE' | 'DAMAGED'>('ACTIVE');

  // Send State
  const [selectedSendIds, setSelectedSendIds] = useState<number[]>([]);
  const [sendDestination, setSendDestination] = useState<string>('');
  const [sendRemarks, setSendRemarks] = useState('');
  const [sendSearch, setSendSearch] = useState('');

  // Receive State
  const [receiveOrigin, setReceiveOrigin] = useState<string>('');
  const [selectedReceiveIds, setSelectedReceiveIds] = useState<number[]>([]);
  const [receiveSearch, setReceiveSearch] = useState('');

  // Remove State
  const [selectedRemoveIds, setSelectedRemoveIds] = useState<number[]>([]);
  const [removeSearch, setRemoveSearch] = useState('');
  const [removeStation, setRemoveStation] = useState<string>('ALL');

  // Filter outstations (all stations except Dhaka)
  const outstations = STATIONS.filter(s => s !== 'DAC');

  // Dhaka stock
  const dhakaStock = ulds.filter(u => u.currentStation === 'DAC');

  // Dhaka stock filtered
  const dhakaStockFiltered = ulds.filter(
    u => u.currentStation === 'DAC' &&
    (sendSearch === '' || u.number.toLowerCase().includes(sendSearch.toLowerCase()))
  );

  // Remove ULDs filtered
  const uldsForRemove = ulds.filter(
    u => (removeStation === 'ALL' || u.currentStation === removeStation) &&
    (removeSearch === '' || u.number.toLowerCase().includes(removeSearch.toLowerCase()))
  );

  // Handler for Add New
  const handleAddNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uldNumber.trim()) {
      setError('Please enter a valid ULD number.');
      return;
    }
    const formattedNum = `${uldType}-${uldNumber.trim().toUpperCase()}`;
    
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ulds', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          number: formattedNum,
          type: uldType,
          currentStation: 'DAC',
          status: 'ACTIVE',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create ULD.');
      }

      if (showToast) {
        showToast(`ULD REGISTERED: Unit ${formattedNum} registered under active fleet at Dhaka.`, 'success', 'ULD_REGISTER');
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handler for Status Change
  const handleStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUldId) {
      setError('Please select a ULD to modify.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ulds/status', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: selectedUldId,
          status: newStatus,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update status.');
      }

      if (showToast) {
        const targetUld = ulds.find(u => u.id === selectedUldId);
        showToast(`STATUS CHANGED: Unit ${targetUld?.number || ''} status set to ${newStatus}.`, 'info', 'STATUS_UPDATE');
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handler for Send
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSendIds.length === 0) {
      setError('Please select at least one ULD to send.');
      return;
    }
    if (!sendDestination) {
      setError('Please select a destination outstation.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ulds/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ids: selectedSendIds,
          destination: sendDestination,
          origin: 'DAC',
          remarks: sendRemarks,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send ULD(s).');
      }

      if (showToast) {
        showToast(`ULD(s) DEPARTED: Sent ${selectedSendIds.length} unit(s) from Dhaka (DAC) to ${sendDestination}.`, 'success', 'TRANSACTION_SEND');
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handler for Receive
  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveOrigin) {
      setError('Please select an origin station.');
      return;
    }
    if (selectedReceiveIds.length === 0) {
      setError('Please select at least one ULD to receive.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ulds/receive', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ids: selectedReceiveIds,
          origin: receiveOrigin,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to receive ULD(s).');
      }

      if (showToast) {
        showToast(`ULD(s) ARRIVED: Received ${selectedReceiveIds.length} unit(s) at Dhaka (DAC) from ${receiveOrigin}.`, 'success', 'TRANSACTION_RECEIVE');
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Handler for Batch Remove (Delete)
  const handleRemove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRemoveIds.length === 0) {
      setError('Please mark at least one ULD to remove.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ulds/batch-delete', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ids: selectedRemoveIds,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete marked ULD(s).');
      }

      if (showToast) {
        showToast(`ULD(s) REMOVED: Decommissioned ${selectedRemoveIds.length} unit(s) from fleet logs.`, 'error', 'ULD_PURGE');
      }
      setSelectedRemoveIds([]);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Filter ULDs at selected receive origin
  const uldsAtOrigin = ulds.filter(
    u => u.currentStation === receiveOrigin && 
    (receiveSearch === '' || u.number.toLowerCase().includes(receiveSearch.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 md:p-8 my-8 relative">
        
        {/* Error display */}
        {error && (
          <div className="mb-6 bg-red-950/30 border border-red-900/40 text-red-200 text-xs p-4 rounded-lg flex items-start gap-2">
            <ShieldAlert className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. ADD NEW ULD FORM */}
        {currentForm === 'add' && (
          <form onSubmit={handleAddNew} className="space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-lg font-bold font-mono text-white tracking-wide flex items-center gap-2">
                <Plus className="h-5 w-5 text-sky-500" />
                ADD NEW AKE/PMC TO DHAKA STOCK
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-1">LOGISTICS BASE: DHAKA (DAC)</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-2">Select ULD Type</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setUldType('AKE')}
                    className={`py-3 px-4 rounded-xl font-bold transition-all border cursor-pointer ${
                      uldType === 'AKE'
                        ? 'bg-sky-500/10 border-sky-500 text-sky-400'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    AKE (Container)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUldType('PMC')}
                    className={`py-3 px-4 rounded-xl font-bold transition-all border cursor-pointer ${
                      uldType === 'PMC'
                        ? 'bg-sky-500/10 border-sky-500 text-sky-400'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    PMC (Pallet)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-2">ULD Serial Number</label>
                <div className="flex rounded-xl bg-slate-950 border border-slate-800 focus-within:border-sky-500 overflow-hidden">
                  <span className="bg-slate-900 px-4 py-3 text-slate-300 font-bold font-mono border-r border-slate-800">
                    {uldType} -
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 12345-BG"
                    value={uldNumber}
                    onChange={(e) => setUldNumber(e.target.value)}
                    className="w-full bg-transparent px-4 py-3 text-white focus:outline-none font-mono placeholder:text-slate-600 uppercase"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-4 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-1/2 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-355 font-semibold py-3 px-4 rounded-xl transition cursor-pointer"
              >
                CLOSE
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-1/2 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-semibold py-3 px-4 rounded-xl transition disabled:opacity-50 cursor-pointer shadow-lg shadow-sky-500/10"
              >
                {loading ? 'SAVING...' : 'SAVE'}
              </button>
            </div>
          </form>
        )}

        {/* 2. CHANGE STATUS FORM */}
        {currentForm === 'status' && (
          <form onSubmit={handleStatusChange} className="space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-lg font-bold font-mono text-white tracking-wide flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5 text-amber-500" />
                CHANGE ULD OPERATIONAL STATUS
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-1">TOGGLE SERVICE LEVEL (ACTIVE / DAMAGED)</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-2">Select ULD</label>
                <select
                  required
                  value={selectedUldId}
                  onChange={(e) => setSelectedUldId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-sky-500 font-mono text-xs cursor-pointer"
                >
                  <option value="">-- SELECT TYPE / NUMBER --</option>
                  {ulds.map((uld) => (
                    <option key={uld.id} value={uld.id}>
                      [{uld.currentStation}] {uld.number} ({uld.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-2">New Operational Status</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setNewStatus('ACTIVE')}
                    className={`py-3 px-4 rounded-xl font-bold transition-all border cursor-pointer ${
                      newStatus === 'ACTIVE'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    ● ACTIVE
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewStatus('DAMAGED')}
                    className={`py-3 px-4 rounded-xl font-bold transition-all border cursor-pointer ${
                      newStatus === 'DAMAGED'
                        ? 'bg-red-500/10 border-red-500 text-red-400'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    ▲ DAMAGED
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-4 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-1/2 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-355 font-semibold py-3 px-4 rounded-xl transition cursor-pointer"
              >
                CLOSE
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-1/2 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-semibold py-3 px-4 rounded-xl transition disabled:opacity-50 cursor-pointer shadow-lg shadow-sky-500/10"
              >
                {loading ? 'UPDATING...' : 'SAVE UPDATE'}
              </button>
            </div>
          </form>
        )}

        {/* 3. SEND ULD FORM */}
        {currentForm === 'send' && (
          <form onSubmit={handleSend} className="space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-lg font-bold font-mono text-white tracking-wide flex items-center gap-2">
                <PlaneTakeoff className="h-5 w-5 text-sky-500" />
                SEND ULD FROM DAC STOCK
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-1">DISPATCH TO OUTSTATION HUB</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-2">Select Target Destination</label>
                  <select
                    required
                    value={sendDestination}
                    onChange={(e) => setSendDestination(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-sky-500 font-mono text-xs cursor-pointer"
                  >
                    <option value="">-- SELECT OUTSTATION --</option>
                    {outstations.map((station) => (
                      <option key={station} value={station}>
                        {station} (Outstation Stock Hub)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-2">Search ULD Number</label>
                  <input
                    type="text"
                    placeholder="Search serial number..."
                    value={sendSearch}
                    onChange={(e) => setSendSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-sky-500 font-mono text-xs placeholder:text-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-2">
                  Select ULDs to Send (Dhaka Stock: {dhakaStock.length} items)
                </label>
                
                {/* Two-table Columns design for sending */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* AKE Table */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-3 border-b border-slate-800 pb-2">
                      <span className="font-bold text-white text-sm font-mono">
                        AKE SELECTED: {selectedSendIds.filter(id => ulds.find(u => u.id === id)?.type === 'AKE').length}
                      </span>
                    </div>
                    
                    <div className="max-h-96 overflow-y-auto space-y-1">
                      <table className="w-full text-left font-mono text-sm">
                        <thead>
                          <tr className="text-slate-500 border-b border-slate-800 text-xs">
                            <th className="pb-1 w-8">MARK</th>
                            <th className="pb-1 w-8">S/L</th>
                            <th className="pb-1">AKE NO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dhakaStockFiltered.filter(u => u.type === 'AKE').length === 0 ? (
                            <tr>
                              <td colSpan={3} className="text-center text-slate-600 py-4">No AKEs found</td>
                            </tr>
                          ) : (
                            dhakaStockFiltered.filter(u => u.type === 'AKE').map((uld, i) => (
                              <tr key={uld.id} className="hover:bg-slate-900/50">
                                <td className="py-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedSendIds.includes(uld.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedSendIds([...selectedSendIds, uld.id]);
                                      } else {
                                        setSelectedSendIds(selectedSendIds.filter(id => id !== uld.id));
                                      }
                                    }}
                                    className="rounded text-sky-500 h-4 w-4 bg-slate-900 border-slate-750 focus:ring-sky-500 cursor-pointer"
                                  />
                                </td>
                                <td className="py-2 text-slate-500">{i + 1}</td>
                                <td className="py-2 font-bold text-slate-300">{uld.number}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* PMC Table */}
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-3 border-b border-slate-800 pb-2">
                      <span className="font-bold text-white text-sm font-mono">
                        PMC SELECTED: {selectedSendIds.filter(id => ulds.find(u => u.id === id)?.type === 'PMC').length}
                      </span>
                    </div>
                    
                    <div className="max-h-96 overflow-y-auto space-y-1">
                      <table className="w-full text-left font-mono text-sm">
                        <thead>
                          <tr className="text-slate-500 border-b border-slate-800 text-xs">
                            <th className="pb-1 w-8">MARK</th>
                            <th className="pb-1 w-8">S/L</th>
                            <th className="pb-1">PMC NO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dhakaStockFiltered.filter(u => u.type === 'PMC').length === 0 ? (
                            <tr>
                              <td colSpan={3} className="text-center text-slate-600 py-4">No PMCs found</td>
                            </tr>
                          ) : (
                            dhakaStockFiltered.filter(u => u.type === 'PMC').map((uld, i) => (
                              <tr key={uld.id} className="hover:bg-slate-900/50">
                                <td className="py-2">
                                  <input
                                    type="checkbox"
                                    checked={selectedSendIds.includes(uld.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedSendIds([...selectedSendIds, uld.id]);
                                      } else {
                                        setSelectedSendIds(selectedSendIds.filter(id => id !== uld.id));
                                      }
                                    }}
                                    className="rounded text-sky-500 h-4 w-4 bg-slate-900 border-slate-750 focus:ring-sky-500 cursor-pointer"
                                  />
                                </td>
                                <td className="py-2 text-slate-500">{i + 1}</td>
                                <td className="py-2 font-bold text-slate-300">{uld.number}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
                <div className="text-[10px] text-slate-500 font-mono mt-1 text-right">
                  Selected: {selectedSendIds.length} ULDs
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-slate-400 mb-2">Flight / Routing remarks</label>
                <input
                  type="text"
                  placeholder="e.g. BS-201 Gate G12"
                  value={sendRemarks}
                  onChange={(e) => setSendRemarks(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-sky-500 font-mono text-xs placeholder:text-slate-700"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-4 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-1/2 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-355 font-semibold py-3 px-4 rounded-xl transition cursor-pointer"
              >
                CLOSE
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:w-1/2 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-semibold py-3 px-4 rounded-xl transition disabled:opacity-50 cursor-pointer shadow-lg shadow-sky-500/10"
              >
                {loading ? 'SENDING...' : 'SEND'}
              </button>
            </div>
          </form>
        )}

        {/* 4. RECEIVE ULD FORM (Adding at DAC Stock from Outstation) */}
        {currentForm === 'receive' && (
          <form onSubmit={handleReceive} className="space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-lg font-bold font-mono text-white tracking-wide flex items-center gap-2">
                <PlaneLanding className="h-5 w-5 text-emerald-500" />
                ADDING AT DAC STOCK FROM OUTSTATION
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-1">RECEIVE INCOMING CARGO STORAGE UNITS</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-2">Select Origin Station</label>
                  <select
                    required
                    value={receiveOrigin}
                    onChange={(e) => {
                      setReceiveOrigin(e.target.value);
                      setSelectedReceiveIds([]);
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-sky-500 font-mono text-xs cursor-pointer"
                  >
                    <option value="">-- SELECT STATION --</option>
                    {outstations.map((station) => (
                      <option key={station} value={station}>
                        {station}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-2">Search ULD Number</label>
                  <input
                    type="text"
                    disabled={!receiveOrigin}
                    placeholder="Search serial number..."
                    value={receiveSearch}
                    onChange={(e) => setReceiveSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-sky-500 font-mono text-xs placeholder:text-slate-700 disabled:opacity-50"
                  />
                </div>
              </div>

              {receiveOrigin && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-slate-950 border border-slate-800/80 px-4 py-3 rounded-lg text-xs font-mono text-slate-300">
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Date: {new Date().toLocaleDateString('en-GB')}</span>
                    <span>Origin: {receiveOrigin}</span>
                  </div>

                  {/* Two-table Columns design */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* AKE Table */}
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                      <div className="flex justify-between items-center mb-3 border-b border-slate-800 pb-2">
                        <span className="font-bold text-white text-sm font-mono">AKE SELECTED: {selectedReceiveIds.filter(id => ulds.find(u => u.id === id)?.type === 'AKE').length}</span>
                      </div>
                      
                      <div className="max-h-96 overflow-y-auto space-y-1">
                        <table className="w-full text-left font-mono text-sm">
                          <thead>
                            <tr className="text-slate-500 border-b border-slate-800 text-xs">
                              <th className="pb-1 w-8">MARK</th>
                              <th className="pb-1 w-8">S/L</th>
                              <th className="pb-1">AKE NO</th>
                            </tr>
                          </thead>
                          <tbody>
                            {uldsAtOrigin.filter(u => u.type === 'AKE').length === 0 ? (
                              <tr>
                                <td colSpan={3} className="text-center text-slate-650 py-4">No AKEs found</td>
                              </tr>
                            ) : (
                              uldsAtOrigin.filter(u => u.type === 'AKE').map((uld, i) => (
                                <tr key={uld.id} className="hover:bg-slate-900/50">
                                  <td className="py-2">
                                    <input
                                      type="checkbox"
                                      checked={selectedReceiveIds.includes(uld.id)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedReceiveIds([...selectedReceiveIds, uld.id]);
                                        } else {
                                          setSelectedReceiveIds(selectedReceiveIds.filter(id => id !== uld.id));
                                        }
                                      }}
                                      className="rounded text-sky-500 h-4 w-4 bg-slate-900 border-slate-750 focus:ring-sky-500 cursor-pointer"
                                    />
                                  </td>
                                  <td className="py-2 text-slate-500">{i + 1}</td>
                                  <td className="py-2 font-bold text-slate-300">{uld.number}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* PMC Table */}
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                      <div className="flex justify-between items-center mb-3 border-b border-slate-800 pb-2">
                        <span className="font-bold text-white text-sm font-mono">PMC SELECTED: {selectedReceiveIds.filter(id => ulds.find(u => u.id === id)?.type === 'PMC').length}</span>
                      </div>
                      
                      <div className="max-h-96 overflow-y-auto space-y-1">
                        <table className="w-full text-left font-mono text-sm">
                          <thead>
                            <tr className="text-slate-500 border-b border-slate-800 text-xs">
                              <th className="pb-1 w-8">MARK</th>
                              <th className="pb-1 w-8">S/L</th>
                              <th className="pb-1">PMC NO</th>
                            </tr>
                          </thead>
                          <tbody>
                            {uldsAtOrigin.filter(u => u.type === 'PMC').length === 0 ? (
                              <tr>
                                <td colSpan={3} className="text-center text-slate-655 py-4">No PMCs found</td>
                              </tr>
                            ) : (
                              uldsAtOrigin.filter(u => u.type === 'PMC').map((uld, i) => (
                                <tr key={uld.id} className="hover:bg-slate-900/50">
                                  <td className="py-2">
                                    <input
                                      type="checkbox"
                                      checked={selectedReceiveIds.includes(uld.id)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setSelectedReceiveIds([...selectedReceiveIds, uld.id]);
                                        } else {
                                          setSelectedReceiveIds(selectedReceiveIds.filter(id => id !== uld.id));
                                        }
                                      }}
                                      className="rounded text-sky-500 h-4 w-4 bg-slate-900 border-slate-750 focus:ring-sky-500 cursor-pointer"
                                    />
                                  </td>
                                  <td className="py-2 text-slate-500">{i + 1}</td>
                                  <td className="py-2 font-bold text-slate-300">{uld.number}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-4 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-1/2 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-355 font-semibold py-3 px-4 rounded-xl transition cursor-pointer"
              >
                CLOSE
              </button>
              <button
                type="submit"
                disabled={loading || selectedReceiveIds.length === 0}
                className="w-full sm:w-1/2 bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-semibold py-3 px-4 rounded-xl transition disabled:opacity-50 cursor-pointer shadow-lg shadow-sky-500/10"
              >
                {loading ? 'RECEIVING...' : 'ADD'}
              </button>
            </div>
          </form>
        )}

        {/* 5. REMOVE ULD FORM (Multi-selection markable list) */}
        {currentForm === 'remove' && (
          <form onSubmit={handleRemove} className="space-y-6">
            <div className="border-b border-slate-800 pb-4">
              <h2 className="text-lg font-bold font-mono text-red-500 tracking-wide flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-red-500" />
                REMOVE AKE/PMC FROM SYSTEM
              </h2>
              <p className="text-xs text-slate-400 font-mono mt-1">PERMANENTLY DECOMMISSION ULD UNITS (MULTI-SELECT LIST)</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-2">Filter Station</label>
                  <select
                    value={removeStation}
                    onChange={(e) => setRemoveStation(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 font-mono text-xs cursor-pointer"
                  >
                    <option value="ALL">ALL STATIONS ({ulds.length})</option>
                    {STATIONS.map((st) => (
                      <option key={st} value={st}>
                        {st} ({ulds.filter(u => u.currentStation === st).length})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-2">Search ULD Number</label>
                  <input
                    type="text"
                    placeholder="Search ULD serial number..."
                    value={removeSearch}
                    onChange={(e) => setRemoveSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-500 font-mono text-xs placeholder:text-slate-700"
                  />
                </div>
              </div>

              {/* Selection Summary bar */}
              <div className="flex justify-between items-center bg-slate-950 border border-slate-800 px-4 py-2.5 rounded-lg text-xs font-mono text-slate-300">
                <span>TOTAL FOUND: <strong className="text-white">{uldsForRemove.length}</strong></span>
                <span className="text-red-400 font-bold">MARKED TO REMOVE: {selectedRemoveIds.length} UNITS</span>
              </div>

              {/* Two Column Grid for AKE and PMC lists */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* AKE List */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-3 border-b border-slate-800 pb-2">
                    <span className="font-bold text-white text-sm font-mono flex items-center gap-2">
                      <span>AKE SELECTED:</span>
                      <span className="text-red-400">{selectedRemoveIds.filter(id => ulds.find(u => u.id === id)?.type === 'AKE').length}</span>
                    </span>
                    {uldsForRemove.filter(u => u.type === 'AKE').length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const akeIds = uldsForRemove.filter(u => u.type === 'AKE').map(u => u.id);
                          const allMarked = akeIds.every(id => selectedRemoveIds.includes(id));
                          if (allMarked) {
                            setSelectedRemoveIds(selectedRemoveIds.filter(id => !akeIds.includes(id)));
                          } else {
                            const combined = Array.from(new Set([...selectedRemoveIds, ...akeIds]));
                            setSelectedRemoveIds(combined);
                          }
                        }}
                        className="text-[10px] font-mono text-sky-400 hover:underline cursor-pointer"
                      >
                        {uldsForRemove.filter(u => u.type === 'AKE').length > 0 && uldsForRemove.filter(u => u.type === 'AKE').every(u => selectedRemoveIds.includes(u.id)) ? 'DESELECT ALL' : 'SELECT ALL'}
                      </button>
                    )}
                  </div>
                  
                  <div className="max-h-80 overflow-y-auto space-y-1">
                    <table className="w-full text-left font-mono text-sm">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-800 text-xs">
                          <th className="pb-1 w-8">MARK</th>
                          <th className="pb-1 w-8">S/L</th>
                          <th className="pb-1">AKE NO</th>
                          <th className="pb-1 text-right">STATION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uldsForRemove.filter(u => u.type === 'AKE').length === 0 ? (
                          <tr>
                            <td colSpan={4} className="text-center text-slate-600 py-4 text-xs">No matching AKE units found</td>
                          </tr>
                        ) : (
                          uldsForRemove.filter(u => u.type === 'AKE').map((uld, i) => (
                            <tr key={uld.id} className="hover:bg-slate-900/50">
                              <td className="py-2">
                                <input
                                  type="checkbox"
                                  checked={selectedRemoveIds.includes(uld.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedRemoveIds([...selectedRemoveIds, uld.id]);
                                    } else {
                                      setSelectedRemoveIds(selectedRemoveIds.filter(id => id !== uld.id));
                                    }
                                  }}
                                  className="rounded text-red-500 h-4 w-4 bg-slate-900 border-slate-750 focus:ring-red-500 cursor-pointer"
                                />
                              </td>
                              <td className="py-2 text-slate-500 text-xs">{i + 1}</td>
                              <td className="py-2 font-bold text-slate-200">{uld.number}</td>
                              <td className="py-2 text-right text-xs text-sky-400">{uld.currentStation}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* PMC List */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-3 border-b border-slate-800 pb-2">
                    <span className="font-bold text-white text-sm font-mono flex items-center gap-2">
                      <span>PMC SELECTED:</span>
                      <span className="text-red-400">{selectedRemoveIds.filter(id => ulds.find(u => u.id === id)?.type === 'PMC').length}</span>
                    </span>
                    {uldsForRemove.filter(u => u.type === 'PMC').length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const pmcIds = uldsForRemove.filter(u => u.type === 'PMC').map(u => u.id);
                          const allMarked = pmcIds.every(id => selectedRemoveIds.includes(id));
                          if (allMarked) {
                            setSelectedRemoveIds(selectedRemoveIds.filter(id => !pmcIds.includes(id)));
                          } else {
                            const combined = Array.from(new Set([...selectedRemoveIds, ...pmcIds]));
                            setSelectedRemoveIds(combined);
                          }
                        }}
                        className="text-[10px] font-mono text-sky-400 hover:underline cursor-pointer"
                      >
                        {uldsForRemove.filter(u => u.type === 'PMC').length > 0 && uldsForRemove.filter(u => u.type === 'PMC').every(u => selectedRemoveIds.includes(u.id)) ? 'DESELECT ALL' : 'SELECT ALL'}
                      </button>
                    )}
                  </div>
                  
                  <div className="max-h-80 overflow-y-auto space-y-1">
                    <table className="w-full text-left font-mono text-sm">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-800 text-xs">
                          <th className="pb-1 w-8">MARK</th>
                          <th className="pb-1 w-8">S/L</th>
                          <th className="pb-1">PMC NO</th>
                          <th className="pb-1 text-right">STATION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uldsForRemove.filter(u => u.type === 'PMC').length === 0 ? (
                          <tr>
                            <td colSpan={4} className="text-center text-slate-600 py-4 text-xs">No matching PMC units found</td>
                          </tr>
                        ) : (
                          uldsForRemove.filter(u => u.type === 'PMC').map((uld, i) => (
                            <tr key={uld.id} className="hover:bg-slate-900/50">
                              <td className="py-2">
                                <input
                                  type="checkbox"
                                  checked={selectedRemoveIds.includes(uld.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedRemoveIds([...selectedRemoveIds, uld.id]);
                                    } else {
                                      setSelectedRemoveIds(selectedRemoveIds.filter(id => id !== uld.id));
                                    }
                                  }}
                                  className="rounded text-red-500 h-4 w-4 bg-slate-900 border-slate-750 focus:ring-red-500 cursor-pointer"
                                />
                              </td>
                              <td className="py-2 text-slate-500 text-xs">{i + 1}</td>
                              <td className="py-2 font-bold text-slate-200">{uld.number}</td>
                              <td className="py-2 text-right text-xs text-sky-400">{uld.currentStation}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-4 text-xs leading-relaxed text-red-300 flex items-start gap-2.5">
                <ShieldAlert className="h-5 w-5 text-red-400 shrink-0 mt-0.5 animate-pulse" />
                <div>
                  <p className="font-bold uppercase text-red-200 font-mono">Warning: Irreversible Action</p>
                  <p className="mt-1 font-sans text-[11px] text-slate-400">Removing ULDs permanently purges active registry records. A "REMOVE" action log is saved in tracking history with the operator email for audit compliance trails.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-4 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-1/2 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-355 font-semibold py-3 px-4 rounded-xl transition cursor-pointer"
              >
                CLOSE
              </button>
              <button
                type="submit"
                disabled={loading || selectedRemoveIds.length === 0}
                className="w-full sm:w-1/2 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-semibold py-3 px-4 rounded-xl transition disabled:opacity-50 cursor-pointer shadow-lg shadow-red-500/10 font-mono text-xs"
              >
                {loading ? 'REMOVING...' : `REMOVE (${selectedRemoveIds.length}) MARKED ULD(s)`}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
