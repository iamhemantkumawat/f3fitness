import React, { useState } from 'react';
import { DashboardLayout } from '../../components/Layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Textarea } from '../../components/ui/textarea';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { broadcastAPI } from '../../lib/api';
import { MessageSquare, Send, Users, UserCheck, UserX, Info } from 'lucide-react';
import { toast } from 'sonner';

export const WhatsAppBroadcast = () => {
  const [message, setMessage] = useState('');
  const [targetAudience, setTargetAudience] = useState('all');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setLoading(true);
    try {
      const response = await broadcastAPI.sendWhatsApp({
        message,
        target_audience: targetAudience
      });
      toast.success(response.data.message);
      setMessage('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send broadcast');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 animate-fade-in max-w-3xl" data-testid="whatsapp-broadcast">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
            WhatsApp Broadcast
          </h1>
          <p className="text-muted-foreground">Send a message to all members via WhatsApp</p>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="text-green-500" size={20} />
              Compose Message
            </CardTitle>
            <CardDescription>
              Use {"{{name}}"} and {"{{member_id}}"} to personalize messages
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Target Audience</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant={targetAudience === 'all' ? 'default' : 'outline'}
                  onClick={() => setTargetAudience('all')}
                  className={targetAudience === 'all' ? 'bg-primary' : ''}
                >
                  <Users size={16} className="mr-2" />
                  All Members
                </Button>
                <Button
                  type="button"
                  variant={targetAudience === 'active' ? 'default' : 'outline'}
                  onClick={() => setTargetAudience('active')}
                  className={targetAudience === 'active' ? 'bg-primary' : ''}
                >
                  <UserCheck size={16} className="mr-2" />
                  Active Only
                </Button>
                <Button
                  type="button"
                  variant={targetAudience === 'inactive' ? 'default' : 'outline'}
                  onClick={() => setTargetAudience('inactive')}
                  className={targetAudience === 'inactive' ? 'bg-primary' : ''}
                >
                  <UserX size={16} className="mr-2" />
                  Inactive Only
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Message</Label>
              <Textarea
                className="mt-2 min-h-[200px] bg-muted/50 border-border"
                placeholder={`Hi {{name}}!\n\nWe have exciting news to share with you...\n\nSee you at the gym!\n- F3 Fitness Team`}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                data-testid="whatsapp-message-input"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Characters: {message.length} | Recommended: Keep under 1000 characters
              </p>
            </div>

            <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-start gap-3">
              <Info size={18} className="text-green-500 mt-0.5" />
              <div className="text-sm text-green-400">
                <strong>Note:</strong> Messages will be sent via your configured Twilio WhatsApp number. 
                If using sandbox, ensure recipients have opted in by sending "join [your-code]" to the sandbox number.
              </div>
            </div>

            <Button 
              className="btn-primary w-full" 
              onClick={handleSend} 
              disabled={loading || !message.trim()}
              data-testid="send-whatsapp-btn"
            >
              {loading ? (
                <>Sending...</>
              ) : (
                <>
                  <Send size={18} className="mr-2" />
                  Send WhatsApp Broadcast
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export const EmailBroadcast = () => {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [targetAudience, setTargetAudience] = useState('all');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!subject.trim()) {
      toast.error('Please enter a subject');
      return;
    }
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    setLoading(true);
    try {
      const response = await broadcastAPI.sendEmail({
        message,
        target_audience: targetAudience,
        subject
      });
      toast.success(response.data.message);
      setSubject('');
      setMessage('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send broadcast');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6 animate-fade-in max-w-3xl" data-testid="email-broadcast">
        <div>
          <h1 className="text-3xl font-bold uppercase tracking-tight" style={{ fontFamily: 'Barlow Condensed' }}>
            Email Broadcast
          </h1>
          <p className="text-muted-foreground">Send a professional email to all members</p>
        </div>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="text-primary" size={20} />
              Compose Email
            </CardTitle>
            <CardDescription>
              Use {"{{name}}"} and {"{{member_id}}"} to personalize emails. Emails are sent with a professional light-themed template.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Target Audience</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant={targetAudience === 'all' ? 'default' : 'outline'}
                  onClick={() => setTargetAudience('all')}
                  className={targetAudience === 'all' ? 'bg-primary' : ''}
                >
                  <Users size={16} className="mr-2" />
                  All Members
                </Button>
                <Button
                  type="button"
                  variant={targetAudience === 'active' ? 'default' : 'outline'}
                  onClick={() => setTargetAudience('active')}
                  className={targetAudience === 'active' ? 'bg-primary' : ''}
                >
                  <UserCheck size={16} className="mr-2" />
                  Active Only
                </Button>
                <Button
                  type="button"
                  variant={targetAudience === 'inactive' ? 'default' : 'outline'}
                  onClick={() => setTargetAudience('inactive')}
                  className={targetAudience === 'inactive' ? 'bg-primary' : ''}
                >
                  <UserX size={16} className="mr-2" />
                  Inactive Only
                </Button>
              </div>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Email Subject</Label>
              <Input
                className="mt-2 bg-muted/50 border-border"
                placeholder="e.g., Special Offer for F3 Fitness Members!"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                data-testid="email-subject-input"
              />
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Message Body</Label>
              <Textarea
                className="mt-2 min-h-[200px] bg-muted/50 border-border"
                placeholder={`We have some exciting news to share with you!\n\nAs a valued member, you get exclusive access to...\n\nDon't miss out on this limited-time offer!\n\nSee you at the gym!`}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                data-testid="email-message-input"
              />
            </div>

            <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg flex items-start gap-3">
              <Info size={18} className="text-primary mt-0.5" />
              <div className="text-sm text-primary">
                <strong>Note:</strong> Emails will be sent using your configured SMTP settings with a professional 
                white/light themed template. Make sure SMTP is configured in Settings.
              </div>
            </div>

            <Button 
              className="btn-primary w-full" 
              onClick={handleSend} 
              disabled={loading || !message.trim() || !subject.trim()}
              data-testid="send-email-btn"
            >
              {loading ? (
                <>Sending...</>
              ) : (
                <>
                  <Send size={18} className="mr-2" />
                  Send Email Broadcast
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default WhatsAppBroadcast;
