import React from 'react';
import './InvoiceList.css';

interface Invoice {
  id: string;
  amount: number;
  date: string;
  status: string;
  details?: any;
}

interface InvoiceListProps {
  invoices: Invoice[];
}

const InvoiceList: React.FC<InvoiceListProps> = ({ invoices }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fa-IR').format(amount);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fa-IR').format(date);
  };

  return (
    <div className="invoice-list-container">
      <div className="section-header">
        <h2>فاکتورها (قدیمی‌ترین اولا - FIFO)</h2>
        <p>لیست فاکتورهای صادر شده</p>
      </div>

      {invoices.length > 0 ? (
        <div className="invoice-grid">
          {invoices.map(invoice => (
            <div key={invoice.id} className="invoice-card">
              <div className="invoice-header">
                <span className="invoice-number">#{invoice.id}</span>
                <span className={`invoice-status ${invoice.status}`}>
                  {invoice.status === 'paid' ? 'پرداخت شده' :
                   invoice.status === 'pending' ? 'در انتظار پرداخت' :
                   invoice.status === 'overdue' ? 'معوقه' : invoice.status}
                </span>
              </div>
              <div className="invoice-body">
                <div className="invoice-amount">
                  <span className="label">مبلغ:</span>
                  <span className="value">{formatCurrency(invoice.amount)} تومان</span>
                </div>
                <div className="invoice-date">
                  <span className="label">تاریخ صدور:</span>
                  <span className="value">{formatDate(invoice.date)}</span>
                </div>
              </div>
              {invoice.details && (
                <div className="invoice-details">
                  <button className="details-button">مشاهده جزئیات</button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="no-invoices">
          <p>فاکتوری برای نمایش وجود ندارد.</p>
        </div>
      )}
    </div>
  );
};

export default InvoiceList;
