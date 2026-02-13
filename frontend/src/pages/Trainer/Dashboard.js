import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DashboardLayout } from '../../components/Layout/DashboardLayout';
import { trainerAPI, membershipsAPI } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../../components/ui/sheet';
import { Users, User, Phone, Mail, Calendar, Dumbbell, FileText } from 'lucide-react';
import { toast } from 'sonner';

export const TrainerDashboard = () => {
  const { user } = useAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientMembership, setClientMembership] = useState(null);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const response = await trainerAPI.getClients();
      setClients(response.data);
    } catch (error) {
      toast.error('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  const openClientDetail = async (client) => {
    setSelectedClient(client);
    try {
      const response = await membershipsAPI.getActive(client.id);
      setClientMembership(response.data);
    } catch (error) {
      setClientMembership(null);
    }
  };

  return (
    <DashboardLayout role="trainer">
      <div className="space-y-6 animate-fade-in" data-testid="trainer-dashboard">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
            Trainer Dashboard
          </h1>
          <p className="text-zinc-500">Manage your assigned clients</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="glass-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-cyan-500/20 rounded-lg">
                  <Users size={24} className="text-cyan-400" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-zinc-500">Total Clients</p>
                  <p className="text-3xl font-bold text-white">{clients.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Clients List */}
        <Card className="glass-card">
          <CardHeader className="border-b border-zinc-800">
            <CardTitle className="flex items-center gap-2 text-lg uppercase tracking-wide" style={{ fontFamily: 'Barlow Condensed' }}>
              <Users size={20} className="text-cyan-400" />
              My Clients
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {loading ? (
              <div className="animate-pulse space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-zinc-800 rounded" />
                ))}
              </div>
            ) : clients.length === 0 ? (
              <div className="text-center py-12">
                <Users size={48} className="mx-auto text-zinc-700 mb-4" />
                <p className="text-zinc-500">No clients assigned yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clients.map((client) => (
                  <div
                    key={client.id}
                    className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-800 hover:border-cyan-500/30 cursor-pointer transition-all"
                    onClick={() => openClientDetail(client)}
                    data-testid={`client-card-${client.member_id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-cyan-500/20 rounded-full flex items-center justify-center">
                        <span className="text-lg font-bold text-cyan-400">
                          {client.name.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-white">{client.name}</p>
                        <p className="text-sm text-cyan-400 font-mono">{client.member_id}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Client Detail Sheet */}
        <Sheet open={!!selectedClient} onOpenChange={() => setSelectedClient(null)}>
          <SheetContent className="bg-card border-zinc-800 w-full sm:max-w-lg overflow-y-auto">
            {selectedClient && (
              <div className="space-y-6">
                <SheetHeader>
                  <SheetTitle className="text-2xl uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
                    Client Details
                  </SheetTitle>
                </SheetHeader>

                {/* Profile */}
                <div className="flex items-center gap-4 p-4 bg-zinc-900/50 rounded-lg">
                  <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center">
                    <span className="text-2xl font-bold text-cyan-400">
                      {selectedClient.name.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{selectedClient.name}</h3>
                    <p className="text-cyan-400 font-mono">{selectedClient.member_id}</p>
                  </div>
                </div>

                {/* Contact */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Contact</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-zinc-400">
                      <Phone size={16} />
                      <span>{selectedClient.phone_number}</span>
                    </div>
                    <div className="flex items-center gap-3 text-zinc-400">
                      <Mail size={16} />
                      <span>{selectedClient.email}</span>
                    </div>
                  </div>
                </div>

                {/* Membership */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Membership</h4>
                  {clientMembership ? (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-white">{clientMembership.plan_name}</span>
                        <span className="badge-active">{clientMembership.status}</span>
                      </div>
                      <p className="text-sm text-zinc-400">
                        Expires: {formatDate(clientMembership.end_date)}
                      </p>
                    </div>
                  ) : (
                    <p className="text-zinc-500">No active membership</p>
                  )}
                </div>

                {/* Actions */}
                <div className="space-y-3">
                  <h4 className="text-xs uppercase tracking-wider text-zinc-500 font-semibold">Actions</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Button className="btn-secondary" disabled data-testid="upload-diet-btn">
                      <FileText size={16} className="mr-2" />
                      Diet Plan
                    </Button>
                    <Button className="btn-secondary" disabled data-testid="upload-workout-btn">
                      <Dumbbell size={16} className="mr-2" />
                      Workout Plan
                    </Button>
                  </div>
                  <p className="text-xs text-zinc-600 text-center">
                    Plan upload feature coming soon
                  </p>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </DashboardLayout>
  );
};

export const TrainerClients = () => <TrainerDashboard />;

export default TrainerDashboard;
