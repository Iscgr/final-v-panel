import React from 'react';
import './FinancialPanel.css';

interface FinancialPanelProps {
  financial: {
    balance: number;
    debt: number;
    lastCalculation: string;
    accuracyIndex: number;
    paymentRatio: number;
  };
  recentInvoices: any[];
  recentPayments: any[];
}

const FinancialPanel: React.FC<FinancialPanelProps> = ({ 
  financial, 
  recentInvoices, 
  recentPayments 
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fa-IR').format(amount);
  };

  return (
    <div className="financial-panel-container">
      <div className="section-header">
        <h2>پنل مالی جامع</h2>
        <p>نمای کلی وضعیت مالی</p>
      </div>

      <div className="financial-overview">
        <div className="overview-card">
          <h3>خلاصه مالی</h3>
          <div className="overview-items">
            <div className="overview-item">
              <span className="label">موجودی:</span>
              <span className="value positive">{formatCurrency(financial.balance)} تومان</span>
            </div>
            <div className="overview-item">
              <span className="label">بدهی:</span>
              <span className="value negative">{formatCurrency(financial.debt)} تومان</span>
            </div>
            <div className="overview-item">
              <span className="label">نسبت پرداخت:</span>
              <span className="value">{financial.paymentRatio}%</span>
            </div>
          </div>
        </div>

        <div className="recent-section">
          <h3>آخرین فاکتورها</h3>
          <div className="recent-list">
            {recentInvoices.map(invoice => (
              <div key={invoice.id} className="recent-item">
                <span className="item-label">#{invoice.id}</span>
                <span className="item-value">{formatCurrency(invoice.amount)} تومان</span>
              </div>
            ))}
          </div>
        </div>

        <div className="recent-section">
          <h3>آخرین پرداخت‌ها</h3>
          <div className="recent-list">
            {recentPayments.map(payment => (
              <div key={payment.id} className="recent-item">
                <span className="item-label">#{payment.id}</span>
                <span className="item-value">{formatCurrency(payment.amount)} تومان</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinancialPanel;
