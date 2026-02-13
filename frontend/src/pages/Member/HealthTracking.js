import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/Layout/DashboardLayout';
import { healthLogsAPI } from '../../lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { 
  Scale, TrendingDown, TrendingUp, Activity, Plus, History, Target
} from 'lucide-react';
import { toast } from 'sonner';

export const HealthTracking = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    weight: '',
    body_fat: '',
    height: '',
    notes: ''
  });

  useEffect(() => {
    if (user) {
      fetchLogs();
    }
  }, [user]);

  const fetchLogs = async () => {
    try {
      const response = await healthLogsAPI.getAll(user.id);
      setLogs(response.data);
    } catch (error) {
      toast.error('Failed to load health logs');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.weight && !formData.body_fat && !formData.height) {
      toast.error('Please enter at least one measurement');
      return;
    }

    setSubmitting(true);
    try {
      const data = {
        weight: formData.weight ? parseFloat(formData.weight) : null,
        body_fat: formData.body_fat ? parseFloat(formData.body_fat) : null,
        height: formData.height ? parseFloat(formData.height) : null,
        notes: formData.notes || null
      };

      await healthLogsAPI.create(data);
      toast.success('Health log added successfully!');
      setFormData({ weight: '', body_fat: '', height: '', notes: '' });
      setShowForm(false);
      fetchLogs();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add log');
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate stats
  const latestLog = logs[0];
  const previousLog = logs[1];
  
  const weightChange = latestLog && previousLog && latestLog.weight && previousLog.weight
    ? (latestLog.weight - previousLog.weight).toFixed(1)
    : null;

  const bmiCategory = (bmi) => {
    if (!bmi) return { label: 'N/A', color: 'text-zinc-500' };
    if (bmi < 18.5) return { label: 'Underweight', color: 'text-yellow-400' };
    if (bmi < 25) return { label: 'Normal', color: 'text-green-400' };
    if (bmi < 30) return { label: 'Overweight', color: 'text-orange-400' };
    return { label: 'Obese', color: 'text-red-400' };
  };

  if (loading) {
    return (
      <DashboardLayout role="member">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-zinc-800 rounded" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-zinc-800 rounded-xl" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="member">
      <div className="space-y-6 animate-fade-in" data-testid="health-tracking-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
              Health Tracking
            </h1>
            <p className="text-zinc-500">Monitor your fitness progress</p>
          </div>
          <Button 
            onClick={() => setShowForm(!showForm)} 
            className="btn-primary"
            data-testid="add-log-btn"
          >
            <Plus size={18} className="mr-2" />
            Add Log
          </Button>
        </div>

        {/* Add Log Form */}
        {showForm && (
          <Card className="glass-card border-cyan-500/30">
            <CardHeader className="border-b border-zinc-800">
              <CardTitle className="flex items-center gap-2 text-lg uppercase tracking-wide" style={{ fontFamily: 'Barlow Condensed' }}>
                <Plus size={20} className="text-cyan-400" />
                New Health Log
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">Weight (kg)</Label>
                  <Input
                    data-testid="weight-input"
                    type="number"
                    step="0.1"
                    className="input-dark mt-2"
                    placeholder="75.5"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">Body Fat (%)</Label>
                  <Input
                    data-testid="body-fat-input"
                    type="number"
                    step="0.1"
                    className="input-dark mt-2"
                    placeholder="20.0"
                    value={formData.body_fat}
                    onChange={(e) => setFormData({ ...formData, body_fat: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">Height (cm)</Label>
                  <Input
                    data-testid="height-input"
                    type="number"
                    step="0.1"
                    className="input-dark mt-2"
                    placeholder="175"
                    value={formData.height}
                    onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-zinc-500">Notes</Label>
                  <Input
                    data-testid="notes-input"
                    type="text"
                    className="input-dark mt-2"
                    placeholder="Optional notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
                <div className="md:col-span-4 flex gap-2 mt-2">
                  <Button 
                    type="submit" 
                    className="btn-primary"
                    disabled={submitting}
                    data-testid="submit-log-btn"
                  >
                    {submitting ? 'Saving...' : 'Save Log'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline"
                    className="border-zinc-700"
                    onClick={() => setShowForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Current Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Current Weight</p>
                  <p className="text-3xl font-bold text-white" style={{ fontFamily: 'Manrope' }}>
                    {latestLog?.weight ? `${latestLog.weight} kg` : '--'}
                  </p>
                  {weightChange && (
                    <p className={`text-sm mt-1 flex items-center gap-1 ${parseFloat(weightChange) > 0 ? 'text-orange-400' : 'text-green-400'}`}>
                      {parseFloat(weightChange) > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                      {weightChange > 0 ? '+' : ''}{weightChange} kg
                    </p>
                  )}
                </div>
                <div className="p-3 rounded-lg bg-cyan-500/20 text-cyan-400">
                  <Scale size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">BMI</p>
                  <p className="text-3xl font-bold text-white" style={{ fontFamily: 'Manrope' }}>
                    {latestLog?.bmi ? latestLog.bmi.toFixed(1) : '--'}
                  </p>
                  {latestLog?.bmi && (
                    <p className={`text-sm mt-1 ${bmiCategory(latestLog.bmi).color}`}>
                      {bmiCategory(latestLog.bmi).label}
                    </p>
                  )}
                </div>
                <div className="p-3 rounded-lg bg-purple-500/20 text-purple-400">
                  <Target size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500 mb-2">Body Fat</p>
                  <p className="text-3xl font-bold text-white" style={{ fontFamily: 'Manrope' }}>
                    {latestLog?.body_fat ? `${latestLog.body_fat}%` : '--'}
                  </p>
                  <p className="text-sm text-zinc-500 mt-1">
                    {latestLog?.height ? `Height: ${latestLog.height} cm` : ''}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-orange-500/20 text-orange-400">
                  <Activity size={24} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* History */}
        <Card className="glass-card">
          <CardHeader className="border-b border-zinc-800">
            <CardTitle className="flex items-center gap-2 text-lg uppercase tracking-wide" style={{ fontFamily: 'Barlow Condensed' }}>
              <History size={20} className="text-cyan-400" />
              Progress History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {logs.length === 0 ? (
              <p className="text-zinc-500 text-center py-8">No logs yet. Start tracking your progress!</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-zinc-500">Date</th>
                      <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-zinc-500">Weight</th>
                      <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-zinc-500">BMI</th>
                      <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-zinc-500">Body Fat</th>
                      <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-zinc-500">Height</th>
                      <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-zinc-500">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log, idx) => (
                      <tr key={log.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                        <td className="py-3 px-4 text-sm text-zinc-300">
                          {new Date(log.logged_at).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {log.weight ? (
                            <span className="text-white font-medium">{log.weight} kg</span>
                          ) : (
                            <span className="text-zinc-600">--</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {log.bmi ? (
                            <span className={`font-medium ${bmiCategory(log.bmi).color}`}>
                              {log.bmi.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-zinc-600">--</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {log.body_fat ? (
                            <span className="text-white">{log.body_fat}%</span>
                          ) : (
                            <span className="text-zinc-600">--</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {log.height ? (
                            <span className="text-white">{log.height} cm</span>
                          ) : (
                            <span className="text-zinc-600">--</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-zinc-400">
                          {log.notes || '--'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default HealthTracking;
