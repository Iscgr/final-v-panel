import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  FileText, 
  Search, 
        <CardContent className="p-0">
          <div className="table-scroll-wrapper">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">انتخاب</TableHead>
                  <TableHead>شماره فاکتور</TableHead>
                  <TableHead>نماینده</TableHead>
                  <TableHead>مبلغ</TableHead>
                  <TableHead>تاریخ صدور</TableHead>
                  <TableHead>سررسید</TableHead>
                  <TableHead>وضعیت</TableHead>
                  <TableHead>تلگرام</TableHead>
                  <TableHead>عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                      {searchTerm || statusFilter !== 'all' || telegramFilter !== 'all' 
                        ? 'هیچ فاکتوری با این فیلترها یافت نشد' 
                        : 'هیچ فاکتوری یافت نشد'
                      }
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedInvoices.map((invoice: Invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedInvoices.includes(invoice.id)}
                          onCheckedChange={(checked) => 
                            handleInvoiceSelect(invoice.id, checked as boolean)
                          }
                        />
                      </TableCell>

                      <TableCell className="font-medium whitespace-nowrap">
                        {invoice.invoiceNumber}
                      </TableCell>

                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {invoice.representativeName || 'نامشخص'}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {invoice.representativeCode}
                          </div>
                          {invoice.panelUsername && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                              {invoice.panelUsername}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="font-medium whitespace-nowrap">
                        {formatCurrency(invoice.amount)} تومان
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center text-sm whitespace-nowrap">
                          <Calendar className="w-4 h-4 ml-1 text-gray-400" />
                          {invoice.issueDate}
                        </div>
                      </TableCell>

                      <TableCell>
                        {invoice.dueDate ? (
                          <div className={`text-sm ${
                            isOverdue(invoice.dueDate) 
                              ? 'text-red-600 dark:text-red-400 font-medium' 
                              : 'text-gray-900 dark:text-white'
                          }`}>
                            {invoice.dueDate}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>

                      <TableCell>
                        {getInvoiceStatusBadge(invoice)}
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col space-y-1">
                          <Badge variant={invoice.sentToTelegram ? "default" : "secondary"}>
                            {invoice.sentToTelegram 
                              ? `ارسال شده ${invoice.telegramSendCount ? `(${toPersianDigits(invoice.telegramSendCount.toString())} بار)` : ''}`
                              : "ارسال نشده"
                            }
                          </Badge>
                          {invoice.telegramSentAt && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap">
                              آخرین ارسال: {new Date(invoice.telegramSentAt).toLocaleString('fa-IR')}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button size="sm" variant="ghost">
                            <Eye className="w-4 h-4" />
                          </Button>

                          <Button
                            size="sm"
                            variant={invoice.sentToTelegram ? "secondary" : "outline"}
                            onClick={() => handleSingleInvoiceSend(invoice.id)}
                            disabled={sendToTelegramMutation.isPending}
                            className={`flex items-center gap-1 ${invoice.sentToTelegram ? 
                              'border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-300 dark:hover:bg-orange-950' : 
                              ''
                            }`}
                          >
                            <Send className="w-4 h-4" />
                            {invoice.sentToTelegram ? "ارسال مجدد" : "ارسال"}
                          </Button>

                          <Button size="sm" variant="ghost">
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
  // SHERLOCK v12.2: Use total statistics for widgets, not just current page  
  const stats = totalStats ? {
    total: totalStats?.totalInvoices ?? 0,
    unpaid: totalStats?.unpaidCount ?? 0,
    paid: totalStats?.paidCount ?? 0,
    partial: totalStats?.partialCount ?? 0,
    overdue: totalStats?.overdueCount ?? 0,
    totalAmount: totalStats?.totalAmount ?? 0,
    sentToTelegram: totalStats?.sentToTelegramCount ?? 0,
    unsentToTelegram: totalStats?.unsentToTelegramCount ?? 0
  } : {
    total: filteredInvoices.length,
    unpaid: filteredInvoices.filter((inv: Invoice) => inv.status === 'unpaid').length,
    paid: filteredInvoices.filter((inv: Invoice) => inv.status === 'paid').length,
    partial: filteredInvoices.filter((inv: Invoice) => inv.status === 'partial').length,
    overdue: filteredInvoices.filter((inv: Invoice) => inv.status === 'overdue').length,
    totalAmount: filteredInvoices.reduce((sum: number, inv: Invoice) => sum + parseFloat(inv.amount), 0),
    sentToTelegram: filteredInvoices.filter((inv: Invoice) => inv.sentToTelegram).length,
    unsentToTelegram: filteredInvoices.filter((inv: Invoice) => !inv.sentToTelegram).length
  };



  // SHERLOCK v12.1: Remove debug block and proceed with normal display logic
  console.log('SHERLOCK v12.1 FINAL: Proceeding with display, invoice count:', invoices.length);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-4 space-x-reverse">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="stack-responsive">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">فاکتورها</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm sm:text-base">
            مدیریت فاکتورها (نمایش: جدیدترین ابتدا، پرداخت: FIFO) و ارسال به تلگرام
          </p>
        </div>

        <div className="action-group justify-end">
          <Button 
            onClick={handleSendToTelegram}
            disabled={selectedInvoices.length === 0 || sendToTelegramMutation.isPending}
            className="bg-primary text-white hover:bg-primary/90 w-full sm:w-auto"
          >
            <Send className="w-4 h-4 ml-2" />
            ارسال {toPersianDigits(selectedInvoices.length.toString())} فاکتور به تلگرام
          </Button>
        </div>
      </div>

      {/* Stats Cards - SHERLOCK v11.5: Enhanced with partial payment tracking */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">کل فاکتورها</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  {toPersianDigits(stats.total.toString())}
                </p>
              </div>
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">پرداخت شده</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400 mt-2">
                  {toPersianDigits(stats.paid.toString())}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">پرداخت نشده</p>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400 mt-2">
                  {toPersianDigits(stats.unpaid.toString())}
                </p>
              </div>
              <Clock className="w-8 h-8 text-orange-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">تسویه جزئی</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">
                  {toPersianDigits(stats.partial.toString())}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">سررسید گذشته</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-2">
                  {toPersianDigits(stats.overdue.toString())}
                </p>
              </div>
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">ارسال نشده</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-2">
                  {toPersianDigits(stats.unsentToTelegram.toString())}
                </p>
              </div>
              <Send className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="filters-responsive">
            <div className="relative flex-1 w-full">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="جستجو بر اساس شماره فاکتور، نماینده..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pr-10"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Select value={statusFilter} onValueChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="وضعیت فاکتور" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه وضعیت‌ها</SelectItem>
                  <SelectItem value="unpaid">پرداخت نشده</SelectItem>
                  <SelectItem value="paid">پرداخت شده</SelectItem>
                  <SelectItem value="partial">تسویه جزئی</SelectItem>
                  <SelectItem value="overdue">سررسید گذشته</SelectItem>
                </SelectContent>
              </Select>

              <Select value={telegramFilter} onValueChange={(value) => {
                setTelegramFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="وضعیت تلگرام" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">همه</SelectItem>
                  <SelectItem value="sent">ارسال شده</SelectItem>
                  <SelectItem value="unsent">ارسال نشده</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardHeader>
          <div className="stack-responsive">
            <CardTitle className="flex items-center">
              <FileText className="w-5 h-5 ml-2" />
              فاکتورها ({toPersianDigits(filteredInvoices.length.toString())} - صفحه {toPersianDigits(currentPage.toString())} از {toPersianDigits(totalPages.toString())})
            </CardTitle>
            <div className="action-group">
              <div className="flex items-center gap-2 justify-between sm:justify-start">
                <Checkbox
                  checked={
                    filteredInvoices.length > 0 &&
                    selectedInvoices.length === filteredInvoices.length
                  }
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  انتخاب همه ({toPersianDigits(paginatedInvoices.length.toString())})
                </span>
              </div>

              {selectedInvoices.length > 0 && (
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <Button
                    size="sm"
                    onClick={() => setIsSendDialogOpen(true)}
                    disabled={sendToTelegramMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Send className="w-4 h-4 ml-1" />
                    ارسال {toPersianDigits(selectedInvoices.length.toString())} فاکتور به تلگرام
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSendAllUnsent}
                    disabled={sendToTelegramMutation.isPending}
                  >
                    <Send className="w-4 h-4 ml-1" />
                    ارسال تمام فاکتورهای ارسال نشده
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="table-scroll-wrapper">
            <Table>
              <TableHeader>
              <TableRow>
                <TableHead className="w-12">انتخاب</TableHead>
                <TableHead>شماره فاکتور</TableHead>
                <TableHead>نماینده</TableHead>
                <TableHead>مبلغ</TableHead>
                <TableHead>تاریخ صدور</TableHead>
                <TableHead>سررسید</TableHead>
                <TableHead>وضعیت</TableHead>
                <TableHead>تلگرام</TableHead>
                <TableHead>عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedInvoices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    {searchTerm || statusFilter !== 'all' || telegramFilter !== 'all' 
                      ? 'هیچ فاکتوری با این فیلترها یافت نشد' 
                      : 'هیچ فاکتوری یافت نشد'
                    }
                  </TableCell>
                </TableRow>
              ) : (
                paginatedInvoices.map((invoice: Invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedInvoices.includes(invoice.id)}
                      onCheckedChange={(checked) => 
                        handleInvoiceSelect(invoice.id, checked as boolean)
                      }
                    />
                  </TableCell>

                  <TableCell className="font-medium">
                    {invoice.invoiceNumber}
                  </TableCell>

                  <TableCell>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {invoice.representativeName || 'نامشخص'}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {invoice.representativeCode}
                      </div>
                      {invoice.panelUsername && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                          {invoice.panelUsername}
                        </div>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="font-medium">
                    {formatCurrency(invoice.amount)} تومان
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center text-sm">
                      <Calendar className="w-4 h-4 ml-1 text-gray-400" />
                      {invoice.issueDate}
                    </div>
                  </TableCell>

                  <TableCell>
                    {invoice.dueDate ? (
                      <div className={`text-sm ${
                        isOverdue(invoice.dueDate) 
                          ? 'text-red-600 dark:text-red-400 font-medium' 
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {invoice.dueDate}
                      </div>
                    ) : (
                      "-"
                    )}
                  </TableCell>

                  <TableCell>
                    {getInvoiceStatusBadge(invoice)}
                  </TableCell>

                  <TableCell>
                    <div className="flex flex-col space-y-1">
                      <Badge variant={invoice.sentToTelegram ? "default" : "secondary"}>
                        {invoice.sentToTelegram 
                          ? `ارسال شده ${invoice.telegramSendCount ? `(${toPersianDigits(invoice.telegramSendCount.toString())} بار)` : ''}`
                          : "ارسال نشده"
                        }
                      </Badge>
                      {invoice.telegramSentAt && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          آخرین ارسال: {new Date(invoice.telegramSentAt).toLocaleString('fa-IR')}
                        </span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center space-x-2 space-x-reverse">
                      <Button size="sm" variant="ghost">
                        <Eye className="w-4 h-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant={invoice.sentToTelegram ? "secondary" : "outline"}
                        onClick={() => handleSingleInvoiceSend(invoice.id)}
                        disabled={sendToTelegramMutation.isPending}
                        className={invoice.sentToTelegram ? 
                          "border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-300 dark:hover:bg-orange-950" : 
                          ""
                        }
                      >
                        <Send className="w-4 h-4 ml-1" />
                        {invoice.sentToTelegram ? "ارسال مجدد" : "ارسال"}
                      </Button>

                      <Button size="sm" variant="ghost">
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                ))
              )}
              </TableHeader>
              <TableBody>
                {paginatedInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                      {searchTerm || statusFilter !== 'all' || telegramFilter !== 'all' 
                        ? 'هیچ فاکتوری با این فیلترها یافت نشد' 
                        : 'هیچ فاکتوری یافت نشد'
                      }
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedInvoices.map((invoice: Invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedInvoices.includes(invoice.id)}
                        onCheckedChange={(checked) => 
                          handleInvoiceSelect(invoice.id, checked as boolean)
                        }
                      />
                    </TableCell>

                    <TableCell className="font-medium">
                      {invoice.invoiceNumber}
                    </TableCell>

                    <TableCell>
                      <div className="space-y-0.5">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {invoice.representativeName || 'نامشخص'}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {invoice.representativeCode}
                        </div>
                        {invoice.panelUsername && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                            {invoice.panelUsername}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="font-medium whitespace-nowrap">
                      {formatCurrency(invoice.amount)} تومان
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center text-sm whitespace-nowrap">
                        <Calendar className="w-4 h-4 ml-1 text-gray-400" />
                        {invoice.issueDate}
                      </div>
                    </TableCell>

                    <TableCell>
                      {invoice.dueDate ? (
                        <div className={`text-sm ${
                          isOverdue(invoice.dueDate) 
                            ? 'text-red-600 dark:text-red-400 font-medium' 
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          {invoice.dueDate}
                        </div>
                      ) : (
                        "-"
                      )}
                    </TableCell>

                    <TableCell>
                      {getInvoiceStatusBadge(invoice)}
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col space-y-1">
                        <Badge variant={invoice.sentToTelegram ? "default" : "secondary"}>
                          {invoice.sentToTelegram 
                            ? `ارسال شده ${invoice.telegramSendCount ? `(${toPersianDigits(invoice.telegramSendCount.toString())} بار)` : ''}`
                            : "ارسال نشده"
                          }
                        </Badge>
                        {invoice.telegramSentAt && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap">
                            آخرین ارسال: {new Date(invoice.telegramSentAt).toLocaleString('fa-IR')}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" variant="ghost">
                          <Eye className="w-4 h-4" />
                        </Button>

                        <Button
                          size="sm"
                          variant={invoice.sentToTelegram ? "secondary" : "outline"}
                          onClick={() => handleSingleInvoiceSend(invoice.id)}
                          disabled={sendToTelegramMutation.isPending}
                          className={`flex items-center gap-1 ${invoice.sentToTelegram ? 
                            "border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-800 dark:text-orange-300 dark:hover:bg-orange-950" : 
                            ''
                          }`}
                        >
                          <Send className="w-4 h-4" />
                          {invoice.sentToTelegram ? "ارسال مجدد" : "ارسال"}
                        </Button>

                        <Button size="sm" variant="ghost">
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination Controls with Statistics */}
          {totalPages > 1 && (
            <div className="mt-6 pt-4 border-t bg-gray-50 dark:bg-gray-800/50 rounded-b-lg">
              <div className="flex justify-between items-center mb-4 px-4">
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  نمایش {toPersianDigits(((currentPage - 1) * pageSize + 1).toString())} تا {toPersianDigits(Math.min(currentPage * pageSize, totalCount).toString())} از {toPersianDigits(totalCount.toString())} فاکتور
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  صفحه {toPersianDigits(currentPage.toString())} از {toPersianDigits(totalPages.toString())}
                </div>
              </div>

              <div className="flex justify-center items-center gap-2 px-4 pb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="min-w-[40px]"
                >
                  <ChevronsRight className="w-4 h-4" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="min-w-[60px]"
                >
                  <ChevronRight className="w-4 h-4 ml-1" />
                  قبلی
                </Button>

                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let page;
                    if (totalPages <= 5) {
                      page = i + 1;
                    } else if (currentPage <= 3) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      page = totalPages - 4 + i;
                    } else {
                      page = currentPage - 2 + i;
                    }

                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="min-w-[35px]"
                      >
                        {toPersianDigits(page.toString())}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="min-w-[60px]"
                >
                  بعدی
                  <ChevronLeft className="w-4 h-4 mr-1" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="min-w-[40px]"
                >
                  <ChevronsLeft className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send Confirmation Dialog */}
      <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
        <DialogContent className="rtl max-w-md">
          <DialogHeader>
            <DialogTitle>تأیید ارسال به تلگرام</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {(() => {
              const selectedInvoiceData = filteredInvoices.filter((inv: Invoice) => selectedInvoices.includes(inv.id));
              const newSends = selectedInvoiceData.filter((inv: Invoice) => !inv.sentToTelegram);
              const resends = selectedInvoiceData.filter((inv: Invoice) => inv.sentToTelegram);

              return (
                <>
                  <div className="text-gray-600 dark:text-gray-400">
                    {newSends.length > 0 && resends.length > 0 ? (
                      <p>
                        آیا مطمئن هستید که می‌خواهید {toPersianDigits(newSends.length.toString())} فاکتور جدید و {toPersianDigits(resends.length.toString())} فاکتور مجددا به تلگرام ارسال کنید؟
                      </p>
                    ) : resends.length > 0 ? (
                      <p>
                        آیا مطمئن هستید که می‌خواهید {toPersianDigits(resends.length.toString())} فاکتور را مجددا به تلگرام ارسال کنید؟
                      </p>
                    ) : (
                      <p>
                        آیا مطمئن هستید که می‌خواهید {toPersianDigits(newSends.length.toString())} فاکتور را به تلگرام ارسال کنید؟
                      </p>
                    )}
                  </div>

                  {newSends.length > 0 && (
                    <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                      <h4 className="font-medium text-green-900 dark:text-green-200 mb-2">
                        فاکتورهای جدید ({toPersianDigits(newSends.length.toString())}):
                      </h4>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {newSends.map((inv: Invoice) => (
                          <div key={inv.id} className="text-sm text-green-800 dark:text-green-300">
                            • {inv.invoiceNumber} - {inv.representativeName} ({formatCurrency(inv.amount)} ت)
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {resends.length > 0 && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                      <h4 className="font-medium text-orange-900 dark:text-orange-200 mb-2">
                        فاکتورهای ارسال مجدد ({toPersianDigits(resends.length.toString())}):
                      </h4>
                      <div className="space-y-1 max-h-24 overflow-y-auto">
                        {resends.map((inv: Invoice) => (
                          <div key={inv.id} className="text-sm text-orange-800 dark:text-orange-300">
                            • {inv.invoiceNumber} - {inv.representativeName} (ارسال #{toPersianDigits((inv.telegramSendCount || 0) + 1)})
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}

            <div className="flex justify-end space-x-2 space-x-reverse">
              <Button 
                variant="outline" 
                onClick={() => setIsSendDialogOpen(false)}
              >
                انصراف
              </Button>
              <Button 
                onClick={() => sendToTelegramMutation.mutate(selectedInvoices)}
                disabled={sendToTelegramMutation.isPending}
              >
                {sendToTelegramMutation.isPending ? "در حال ارسال..." : "ارسال"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}