import React, { useState, useEffect } from 'react';
import { invoiceAPI } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { Button } from '../../components/ui/button';
import { Download, Printer, X } from 'lucide-react';
import { toast } from 'sonner';

// F3 Fitness Logo URL
const F3_LOGO_URL = "https://customer-assets.emergentagent.com/job_f3-fitness-gym/artifacts/0x0pk4uv_Untitled%20%28500%20x%20300%20px%29%20%282%29.png";

export const InvoiceModal = ({ isOpen, onClose, paymentId }) => {
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && paymentId) {
      fetchInvoice();
    }
  }, [isOpen, paymentId]);

  const fetchInvoice = async () => {
    try {
      setLoading(true);
      const res = await invoiceAPI.get(paymentId);
      setInvoice(res.data);
    } catch (error) {
      toast.error('Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  const generatePrintableHTML = () => {
    if (!invoice) return '';
    
    const paymentDate = invoice.invoice?.payment_date 
      ? new Date(invoice.invoice.payment_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : 'N/A';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Invoice - ${invoice.invoice?.receipt_no || 'F3 Fitness'}</title>
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Poppins', Arial, sans-serif; background: #fff; padding: 20px; max-width: 800px; margin: 0 auto; }
          .invoice-container { border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
          .header { background: linear-gradient(135deg, #0ea5b7, #0b7285); padding: 30px; text-align: center; color: white; }
          .header img { max-width: 150px; margin-bottom: 10px; filter: brightness(0) invert(1); }
          .header h1 { font-size: 24px; font-weight: 700; letter-spacing: 2px; margin: 10px 0 5px 0; }
          .header p { font-size: 12px; opacity: 0.9; }
          .receipt-badge { background: rgba(255,255,255,0.2); display: inline-block; padding: 8px 20px; border-radius: 20px; margin-top: 15px; font-weight: 600; }
          .content { padding: 30px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
          .info-box { background: #f8fafc; padding: 20px; border-radius: 10px; border-left: 4px solid #0ea5b7; }
          .info-box h3 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 12px; }
          .info-box p { font-size: 14px; color: #334155; margin: 4px 0; }
          .info-box .highlight { color: #0ea5b7; font-weight: 600; }
          table { width: 100%; border-collapse: collapse; margin: 25px 0; }
          th { background: #0ea5b7; color: white; padding: 14px; text-align: left; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
          td { padding: 14px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #334155; }
          .total-row td { background: #f0f9ff; font-weight: 700; font-size: 16px; color: #0b7285; }
          .footer { background: #f8fafc; padding: 25px 30px; border-top: 1px solid #e5e7eb; text-align: center; }
          .footer-title { font-size: 14px; font-weight: 600; color: #334155; margin-bottom: 10px; }
          .footer-address { font-size: 12px; color: #64748b; line-height: 1.6; max-width: 450px; margin: 0 auto 15px auto; }
          .footer-contact { font-size: 12px; color: #64748b; }
          .footer-contact a { color: #0ea5b7; text-decoration: none; }
          .footer-hours { font-size: 11px; color: #94a3b8; margin-top: 10px; }
          .footer-social { margin-top: 15px; font-size: 12px; color: #0ea5b7; font-weight: 500; }
          .thank-you { text-align: center; padding: 20px; background: linear-gradient(135deg, #f0f9ff, #e0f2fe); margin: 20px 0; border-radius: 10px; }
          .thank-you p { color: #0b7285; font-size: 14px; }
          .thank-you .motto { font-weight: 600; margin-top: 5px; }
          @media print { 
            body { padding: 0; } 
            .invoice-container { border: none; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header">
            <img src="${F3_LOGO_URL}" alt="F3 Fitness" />
            <h1>F3 FITNESS HEALTH CLUB</h1>
            <p>Your Fitness Journey Partner</p>
            <div class="receipt-badge">Receipt: ${invoice.invoice?.receipt_no || 'N/A'}</div>
          </div>
          
          <div class="content">
            <div class="info-grid">
              <div class="info-box">
                <h3>Billed To</h3>
                <p><strong>${invoice.customer?.name || 'N/A'}</strong></p>
                <p>Member ID: <span class="highlight">${invoice.customer?.member_id || 'N/A'}</span></p>
                <p>${invoice.customer?.phone || ''}</p>
                <p>${invoice.customer?.email || ''}</p>
              </div>
              <div class="info-box">
                <h3>Invoice Details</h3>
                <p><strong>Invoice #:</strong> <span class="highlight">${invoice.invoice?.receipt_no || 'N/A'}</span></p>
                <p><strong>Date:</strong> ${paymentDate}</p>
                <p><strong>Payment Method:</strong> ${invoice.invoice?.payment_method || 'Cash'}</p>
              </div>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th style="text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${invoice.membership ? `
                  <tr>
                    <td>
                      <strong>${invoice.membership.plan_name || 'Membership Plan'}</strong><br>
                      <small style="color: #64748b;">
                        ${invoice.membership.start_date?.split('T')[0] || ''} to ${invoice.membership.end_date?.split('T')[0] || ''}
                        ${invoice.membership.duration_days ? ` (${invoice.membership.duration_days} days)` : ''}
                      </small>
                    </td>
                    <td style="text-align: right;">₹${(invoice.membership.original_price || 0).toLocaleString('en-IN')}</td>
                  </tr>
                  ${invoice.membership.discount > 0 ? `
                    <tr>
                      <td style="color: #10b981;">Discount Applied</td>
                      <td style="text-align: right; color: #10b981;">-₹${invoice.membership.discount.toLocaleString('en-IN')}</td>
                    </tr>
                  ` : ''}
                ` : `
                  <tr>
                    <td>${invoice.invoice?.notes || 'Gym Payment'}</td>
                    <td style="text-align: right;">₹${(invoice.invoice?.amount_paid || 0).toLocaleString('en-IN')}</td>
                  </tr>
                `}
                <tr class="total-row">
                  <td>Amount Paid</td>
                  <td style="text-align: right;">₹${(invoice.invoice?.amount_paid || 0).toLocaleString('en-IN')}</td>
                </tr>
              </tbody>
            </table>
            
            <div class="thank-you">
              <p>Thank you for being a valued member of F3 Fitness Health Club!</p>
              <p class="motto">Transform Your Body, Transform Your Life! 💪</p>
            </div>
          </div>
          
          <div class="footer">
            <div class="footer-title">F3 FITNESS HEALTH CLUB</div>
            <div class="footer-address">
              4th Avenue Plot No 4R-B, Mode, near Mandir Marg,<br>
              Sector 4, Vidyadhar Nagar, Jaipur, Rajasthan 302039
            </div>
            <div class="footer-contact">
              📞 <a href="tel:+917230052193">072300 52193</a> | 
              ✉️ <a href="mailto:info@f3fitness.in">info@f3fitness.in</a>
            </div>
            <div class="footer-hours">
              ⏰ Mon-Sat: 5:00 AM - 10:00 PM | Sun: 6:00 AM - 12:00 PM
            </div>
            <div class="footer-social">
              📸 Instagram: @f3fitnessclub
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(generatePrintableHTML());
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleDownload = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(generatePrintableHTML());
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  if (!isOpen) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="invoice-modal">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-auto m-4">
        {/* Modal Header */}
        <div className="sticky top-0 bg-card border-b border-border p-4 flex justify-between items-center z-10">
          <h2 className="text-lg font-semibold text-foreground">Invoice</h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint} data-testid="print-invoice-btn">
              <Printer size={16} className="mr-2" /> Print
            </Button>
            <Button variant="default" size="sm" onClick={handleDownload} data-testid="download-invoice-btn">
              <Download size={16} className="mr-2" /> Download PDF
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X size={18} />
            </Button>
          </div>
        </div>

        {/* Invoice Preview */}
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
            Loading invoice...
          </div>
        ) : invoice ? (
          <div className="p-6">
            {/* Header with Logo */}
            <div className="text-center border-b border-border pb-6 mb-6">
              <img 
                src={F3_LOGO_URL} 
                alt="F3 Fitness" 
                className="h-16 mx-auto mb-3 dark:invert"
              />
              <h1 className="text-xl font-bold text-primary">F3 FITNESS HEALTH CLUB</h1>
              <p className="text-xs text-muted-foreground mt-1">Your Fitness Journey Partner</p>
              <div className="mt-4 inline-block bg-primary/10 text-primary px-4 py-2 rounded-full font-semibold text-sm">
                Receipt: {invoice.invoice?.receipt_no || 'N/A'}
              </div>
            </div>

            {/* Customer & Invoice Info */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-muted/30 p-4 rounded-lg border-l-4 border-primary">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Billed To</h3>
                <p className="font-semibold text-foreground">{invoice.customer?.name}</p>
                <p className="text-sm text-primary font-medium">ID: {invoice.customer?.member_id}</p>
                <p className="text-sm text-muted-foreground">{invoice.customer?.phone}</p>
                <p className="text-sm text-muted-foreground">{invoice.customer?.email}</p>
              </div>
              <div className="bg-muted/30 p-4 rounded-lg border-l-4 border-primary text-right">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Invoice Details</h3>
                <p className="font-semibold text-primary">{invoice.invoice?.receipt_no}</p>
                <p className="text-sm text-muted-foreground">Date: {formatDate(invoice.invoice?.payment_date)}</p>
                <p className="text-sm text-muted-foreground capitalize">Via: {invoice.invoice?.payment_method}</p>
              </div>
            </div>

            {/* Items */}
            <div className="border border-border rounded-lg overflow-hidden mb-6">
              <table className="w-full">
                <thead>
                  <tr className="bg-primary text-primary-foreground">
                    <th className="text-left p-3 text-sm font-semibold">Description</th>
                    <th className="text-right p-3 text-sm font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.membership ? (
                    <>
                      <tr className="border-b border-border">
                        <td className="p-3">
                          <p className="font-medium text-foreground">{invoice.membership.plan_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(invoice.membership.start_date)} → {formatDate(invoice.membership.end_date)}
                            {invoice.membership.duration_days && ` (${invoice.membership.duration_days} days)`}
                          </p>
                        </td>
                        <td className="p-3 text-right text-foreground">{formatCurrency(invoice.membership.original_price)}</td>
                      </tr>
                      {invoice.membership.discount > 0 && (
                        <tr className="border-b border-border">
                          <td className="p-3 text-green-500">Discount Applied</td>
                          <td className="p-3 text-right text-green-500">-{formatCurrency(invoice.membership.discount)}</td>
                        </tr>
                      )}
                    </>
                  ) : (
                    <tr className="border-b border-border">
                      <td className="p-3 text-foreground">{invoice.invoice?.notes || 'Gym Payment'}</td>
                      <td className="p-3 text-right text-foreground">{formatCurrency(invoice.invoice?.amount_paid)}</td>
                    </tr>
                  )}
                  <tr className="bg-primary/5">
                    <td className="p-3 font-bold text-foreground">Amount Paid</td>
                    <td className="p-3 text-right font-bold text-primary text-lg">{formatCurrency(invoice.invoice?.amount_paid)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Thank You */}
            <div className="text-center p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg mb-6">
              <p className="text-muted-foreground">Thank you for being a valued member!</p>
              <p className="font-semibold text-primary mt-1">Transform Your Body, Transform Your Life! 💪</p>
            </div>

            {/* Footer */}
            <div className="text-center text-sm border-t border-border pt-4">
              <p className="font-semibold text-foreground">F3 FITNESS HEALTH CLUB</p>
              <p className="text-muted-foreground text-xs mt-1">
                4th Avenue Plot No 4R-B, Mode, near Mandir Marg, Sector 4, Vidyadhar Nagar, Jaipur, Rajasthan 302039
              </p>
              <p className="text-muted-foreground text-xs mt-1">
                📞 072300 52193 | ✉️ info@f3fitness.in | 📸 @f3fitnessclub
              </p>
              <p className="text-muted-foreground text-xs mt-1">
                ⏰ Mon-Sat: 5:00 AM - 10:00 PM | Sun: 6:00 AM - 12:00 PM
              </p>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground">Invoice not found</div>
        )}
      </div>
    </div>
  );
};

export default InvoiceModal;
