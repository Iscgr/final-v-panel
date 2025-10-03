import React, { useState } from 'react';
import './PaymentList.css';
import { Search, ChevronDown, ChevronUp, Calendar } from 'react-feather';

interface Payment {
  id: string;
  amount: number;
  date: string;
  description: string;
  status: string;
}

interface PaymentListProps {
  payments: Payment[];
}

const PaymentList: React.FC<PaymentListProps> = ({ payments }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);

  // تبدیل عدد به فرمت پول با جداکننده هزارگان
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fa-IR').format(amount);
  };

  // تبدیل تاریخ به فرمت فارسی
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fa-IR').format(date);
  };

  // مرتب‌سازی پرداخت‌ها
  const sortedPayments = [...payments].sort((a, b) => {
    if (sortBy === 'date') {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortDirection === 'asc' ? dateA - dateB : dateB - dateA;
    } else {
      return sortDirection === 'asc' ? a.amount - b.amount : b.amount - a.amount;
    }
  });

  // فیلتر پرداخت‌ها بر اساس جستجو
  const filteredPayments = sortedPayments.filter(payment => 
    payment.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // تغییر مرتب‌سازی
  const handleSortChange = (column: 'date' | 'amount') => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('desc');
    }
  };

  return (
    <div className="payment-list-container">
      <div className="section-header">
        <h2>لیست پرداخت‌ها</h2>
        <p>تاریخچه پرداخت‌های انجام شده</p>
      </div>

      <div className="payment-tools">
        <div className="search-bar">
          <Search size={18} />
          <input
            type="text"
            placeholder="جستجو در پرداخت‌ها..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <button 
          className="filter-toggle" 
          onClick={() => setShowFilters(!showFilters)}
        >
          فیلترها {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {showFilters && (
        <div className="payment-filters">
          <div className="filter-group">
            <label>مرتب‌سازی بر اساس:</label>
            <div className="filter-buttons">
              <button 
                className={sortBy === 'date' ? 'active' : ''} 
                onClick={() => handleSortChange('date')}
              >
                تاریخ {sortBy === 'date' && (sortDirection === 'asc' ? '↑' : '↓')}
              </button>
              <button 
                className={sortBy === 'amount' ? 'active' : ''} 
                onClick={() => handleSortChange('amount')}
              >
                مبلغ {sortBy === 'amount' && (sortDirection === 'asc' ? '↑' : '↓')}
              </button>
            </div>
          </div>
        </div>
      )}

      {filteredPayments.length > 0 ? (
        <div className="payment-table-container">
          <table className="payment-table">
            <thead>
              <tr>
                <th>شناسه پرداخت</th>
                <th className="sort-column" onClick={() => handleSortChange('amount')}>
                  مبلغ (تومان)
                  {sortBy === 'amount' && (
                    <span className="sort-indicator">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                  )}
                </th>
                <th className="sort-column" onClick={() => handleSortChange('date')}>
                  تاریخ پرداخت
                  {sortBy === 'date' && (
                    <span className="sort-indicator">{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                  )}
                </th>
                <th>توضیحات</th>
                <th>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map(payment => (
                <tr key={payment.id}>
                  <td className="payment-id">{payment.id}</td>
                  <td className="payment-amount">{formatCurrency(payment.amount)}</td>
                  <td className="payment-date">
                    <Calendar size={14} />
                    {formatDate(payment.date)}
                  </td>
                  <td className="payment-description">{payment.description}</td>
                  <td className="payment-status">
                    <span className={`status-badge ${payment.status}`}>
                      {payment.status === 'completed' ? 'تکمیل شده' : 
                       payment.status === 'pending' ? 'در انتظار تایید' : 
                       payment.status === 'failed' ? 'ناموفق' : payment.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="no-results">
          <p>هیچ پرداختی یافت نشد.</p>
          {searchTerm && (
            <button onClick={() => setSearchTerm('')}>پاک کردن جستجو</button>
          )}
        </div>
      )}

      <div className="payment-summary">
        <p>تعداد کل پرداخت‌ها: <strong>{filteredPayments.length}</strong></p>
        <p>مجموع پرداختی‌ها: <strong>{formatCurrency(filteredPayments.reduce((sum, payment) => sum + payment.amount, 0))} تومان</strong></p>
      </div>
    </div>
  );
};

export default PaymentList;
