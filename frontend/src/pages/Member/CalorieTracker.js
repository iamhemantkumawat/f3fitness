import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/Layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { 
  Flame, Plus, Target, TrendingUp, TrendingDown, Utensils, Trash2, Settings
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const CalorieTracker = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [formData, setFormData] = useState({
    calories: '',
    protein: '',
    carbs: '',
    fats: '',
    meal_type: 'snack',
    food_items: '',
    notes: ''
  });
  const [goalData, setGoalData] = useState({
    target_calories: 2000,
    goal_type: 'maintenance'
  });

  useEffect(() => {
    fetchData();
  }, []);

  const getToken = () => localStorage.getItem('token');

  const fetchData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const [logsRes, summaryRes] = await Promise.all([
        fetch(`${API_URL}/api/calorie-logs?date=${today}`, {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        }),
        fetch(`${API_URL}/api/calorie-summary?date=${today}`, {
          headers: { 'Authorization': `Bearer ${getToken()}` }
        })
      ]);

      const logsData = await logsRes.json();
      const summaryData = await summaryRes.json();

      setLogs(logsData);
      setSummary(summaryData);
      setGoalData({
        target_calories: summaryData.target_calories || 2000,
        goal_type: summaryData.goal_type || 'maintenance'
      });
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddLog = async (e) => {
    e.preventDefault();
    if (!formData.calories) {
      toast.error('Please enter calories');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/calorie-logs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          ...formData,
          calories: parseInt(formData.calories),
          protein: formData.protein ? parseInt(formData.protein) : null,
          carbs: formData.carbs ? parseInt(formData.carbs) : null,
          fats: formData.fats ? parseInt(formData.fats) : null
        })
      });

      if (!response.ok) throw new Error('Failed to add log');

      toast.success('Meal logged!');
      setFormData({
        calories: '', protein: '', carbs: '', fats: '',
        meal_type: 'snack', food_items: '', notes: ''
      });
      setShowForm(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to add log');
    }
  };

  const handleDeleteLog = async (logId) => {
    try {
      await fetch(`${API_URL}/api/calorie-logs/${logId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      toast.success('Log deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const handleUpdateGoal = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${API_URL}/api/calorie-goal`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify(goalData)
      });
      toast.success('Goal updated!');
      setShowGoalForm(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to update goal');
    }
  };

  const getProgressColor = () => {
    if (!summary) return 'bg-zinc-600';
    const percent = (summary.total_calories / summary.target_calories) * 100;
    if (percent < 80) return 'bg-green-500';
    if (percent < 100) return 'bg-yellow-500';
    if (percent < 120) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const mealTypes = [
    { value: 'breakfast', label: '🌅 Breakfast' },
    { value: 'lunch', label: '☀️ Lunch' },
    { value: 'dinner', label: '🌙 Dinner' },
    { value: 'snack', label: '🍎 Snack' }
  ];

  if (loading) {
    return (
      <DashboardLayout role="member">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-muted rounded" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded-xl" />
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="member">
      <div className="space-y-6 animate-fade-in" data-testid="calorie-tracker-page">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
              Calorie Tracker
            </h1>
            <p className="text-muted-foreground">Track your daily nutrition</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowGoalForm(!showGoalForm)}
              variant="outline"
              className="border-zinc-700"
              data-testid="set-goal-btn"
            >
              <Settings size={18} className="mr-2" />
              Set Goal
            </Button>
            <Button
              onClick={() => setShowForm(!showForm)}
              className="btn-primary"
              data-testid="add-meal-btn"
            >
              <Plus size={18} className="mr-2" />
              Add Meal
            </Button>
          </div>
        </div>

        {/* Goal Form */}
        {showGoalForm && (
          <Card className="glass-card border-purple-500/30">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target size={20} className="text-purple-400" />
                Set Calorie Goal
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleUpdateGoal} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Daily Target (kcal)</Label>
                  <Input
                    type="number"
                    className="input-dark mt-2"
                    value={goalData.target_calories}
                    onChange={(e) => setGoalData({ ...goalData, target_calories: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Goal Type</Label>
                  <select
                    className="input-dark mt-2 w-full h-10 px-3 rounded-md bg-muted/50 border border-border"
                    value={goalData.goal_type}
                    onChange={(e) => setGoalData({ ...goalData, goal_type: e.target.value })}
                  >
                    <option value="deficit">🔥 Deficit (Weight Loss)</option>
                    <option value="maintenance">⚖️ Maintenance</option>
                    <option value="surplus">💪 Surplus (Muscle Gain)</option>
                  </select>
                </div>
                <div className="flex items-end gap-2">
                  <Button type="submit" className="btn-primary">Save Goal</Button>
                  <Button type="button" variant="outline" className="border-zinc-700" onClick={() => setShowGoalForm(false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Add Meal Form */}
        {showForm && (
          <Card className="glass-card border-cyan-500/30">
            <CardHeader className="border-b border-border">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Utensils size={20} className="text-cyan-400" />
                Log Meal
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleAddLog} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Meal Type</Label>
                  <select
                    className="input-dark mt-2 w-full h-10 px-3 rounded-md bg-muted/50 border border-border"
                    value={formData.meal_type}
                    onChange={(e) => setFormData({ ...formData, meal_type: e.target.value })}
                  >
                    {mealTypes.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Calories *</Label>
                  <Input
                    type="number"
                    className="input-dark mt-2"
                    placeholder="500"
                    value={formData.calories}
                    onChange={(e) => setFormData({ ...formData, calories: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Protein (g)</Label>
                  <Input
                    type="number"
                    className="input-dark mt-2"
                    placeholder="25"
                    value={formData.protein}
                    onChange={(e) => setFormData({ ...formData, protein: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Carbs (g)</Label>
                  <Input
                    type="number"
                    className="input-dark mt-2"
                    placeholder="50"
                    value={formData.carbs}
                    onChange={(e) => setFormData({ ...formData, carbs: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Fats (g)</Label>
                  <Input
                    type="number"
                    className="input-dark mt-2"
                    placeholder="15"
                    value={formData.fats}
                    onChange={(e) => setFormData({ ...formData, fats: e.target.value })}
                  />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Food Items</Label>
                  <Input
                    type="text"
                    className="input-dark mt-2"
                    placeholder="Rice, dal, sabzi..."
                    value={formData.food_items}
                    onChange={(e) => setFormData({ ...formData, food_items: e.target.value })}
                  />
                </div>
                <div className="col-span-2 md:col-span-4 flex gap-2">
                  <Button type="submit" className="btn-primary">Log Meal</Button>
                  <Button type="button" variant="outline" className="border-zinc-700" onClick={() => setShowForm(false)}>Cancel</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="glass-card col-span-2">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">Today's Calories</p>
                    <p className="text-4xl font-bold text-foreground" style={{ fontFamily: 'Manrope' }}>
                      {summary.total_calories}
                      <span className="text-lg text-muted-foreground"> / {summary.target_calories}</span>
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${
                    summary.difference > 0 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                  }`}>
                    {summary.difference > 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all ${getProgressColor()}`}
                    style={{ width: `${Math.min((summary.total_calories / summary.target_calories) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  {summary.difference > 0 
                    ? `${summary.difference} kcal over target`
                    : `${Math.abs(summary.difference)} kcal remaining`
                  }
                </p>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-6">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Protein</p>
                <p className="text-3xl font-bold text-cyan-400">{summary.total_protein || 0}g</p>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardContent className="p-6">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Carbs / Fats</p>
                <p className="text-3xl font-bold">
                  <span className="text-yellow-400">{summary.total_carbs || 0}g</span>
                  <span className="text-muted-foreground"> / </span>
                  <span className="text-orange-400">{summary.total_fats || 0}g</span>
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Today's Meals */}
        <Card className="glass-card">
          <CardHeader className="border-b border-border">
            <CardTitle className="flex items-center gap-2 text-lg uppercase tracking-wide" style={{ fontFamily: 'Barlow Condensed' }}>
              <Flame size={20} className="text-orange-400" />
              Today's Meals
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {logs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No meals logged today. Start tracking!</p>
            ) : (
              <div className="space-y-3">
                {logs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border border-border">
                    <div className="flex items-center gap-4">
                      <div className="text-2xl">
                        {log.meal_type === 'breakfast' ? '🌅' : 
                         log.meal_type === 'lunch' ? '☀️' : 
                         log.meal_type === 'dinner' ? '🌙' : '🍎'}
                      </div>
                      <div>
                        <p className="font-medium text-foreground capitalize">{log.meal_type}</p>
                        {log.food_items && <p className="text-xs text-muted-foreground">{log.food_items}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-lg font-bold text-orange-400">{log.calories} kcal</p>
                        <p className="text-xs text-muted-foreground">
                          P: {log.protein || 0}g | C: {log.carbs || 0}g | F: {log.fats || 0}g
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteLog(log.id)}
                        className="text-muted-foreground hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default CalorieTracker;
