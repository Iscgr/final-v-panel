import React from 'react';
import './Dashboard.css';

interface DashboardProps {
  financialData: {
    balance: number;
    debt: number;
    lastCalculation: string;
    accuracyIndex: number;
    paymentRatio: number;
  };
}

const Dashboard: React.FC<DashboardProps> = ({ financialData }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fa-IR').format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fa-IR').format(date);
  };

  return (
    <div className="dashboard-container">
      <h2 className="dashboard-title">موجودی مالی و وضعیت حساب</h2>
      
      <div className="financial-cards">
        <div className="financial-card balance">
          <div className="card-icon">💰</div>
          <div className="card-content">
            <h3>موجودی کل</h3>
            <p className="amount">{formatCurrency(financialData.balance)} تومان</p>
          </div>
        </div>

        <div className="financial-card debt">
          <div className="card-icon">💳</div>
          <div className="card-content">
            <h3>بدهی کل</h3>
            <p className="amount">{formatCurrency(financialData.debt)} تومان</p>
          </div>
        </div>

        <div className="financial-card payment-ratio">
          <div className="card-icon">📊</div>
          <div className="card-content">
            <h3>نسبت پرداخت</h3>
            <p className="amount">{financialData.paymentRatio}%</p>
          </div>
        </div>

        <div className="financial-card accuracy">
          <div className="card-icon">🎯</div>
          <div className="card-content">
            <h3>شاخص دقت</h3>
            <p className="amount">{financialData.accuracyIndex}%</p>
          </div>
        </div>
      </div>

      <div className="last-calculation">
        <p>آخرین محاسبه: {formatDate(financialData.lastCalculation)}</p>
      </div>
    </div>
  );
};

export default Dashboard;
