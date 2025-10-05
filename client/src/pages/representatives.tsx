/**
 * Representatives Page - Refactored & Modular
 * 
 * ویژگی‌ها:
 * - جستجوی real-time
 * - مرتب‌سازی برای فروش و بدهی
 * - نمایش تنها ستون‌های ضروری
 * - دکمه ورود به پروفایل
 */

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { representativesColumns, RepresentativeRow } from "./representatives/table-columns";

interface RepresentativesResponse {
  representatives: RepresentativeRow[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 200;
const MAX_PAGES = 25; // سقف محافظتی برای جلوگیری از حلقه بی‌نهایت (۵۰۰۰ رکورد)

// API fetch function (جمع‌آوری همه صفحات بدون سقف ۱۰۰ تایی)
const fetchRepresentatives = async (
  search: string = "",
  sortBy: string = "name",
  sortOrder: string = "asc"
): Promise<RepresentativesResponse> => {
  let currentPage = 1;
  let accumulated: RepresentativeRow[] = [];
  let reportedTotal = 0;

  while (currentPage <= MAX_PAGES) {
    const params = new URLSearchParams({
      search,
      sortBy,
      sortOrder,
      page: currentPage.toString(),
      pageSize: PAGE_SIZE.toString()
    });

    const response = await fetch(`/api/representatives?${params}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('خطا در دریافت اطلاعات نمایندگان');
    }

    const payload: RepresentativesResponse = await response.json();

    if (currentPage === 1) {
      reportedTotal = payload.total;
    }

    accumulated = accumulated.concat(payload.representatives);

    const fetchedAll = accumulated.length >= reportedTotal || payload.representatives.length < PAGE_SIZE;

    if (fetchedAll) {
      break;
    }

    currentPage += 1;
  }

  return {
    representatives: accumulated,
    total: reportedTotal || accumulated.length,
    page: 1,
    pageSize: accumulated.length,
  };
};

export default function RepresentativesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["representatives", searchTerm, sortBy, sortOrder],
    queryFn: () => fetchRepresentatives(searchTerm, sortBy, sortOrder),
    staleTime: 60000, // 1 minute
  });

  // Handle search with debounce
  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">خطا در بارگذاری</CardTitle>
            <CardDescription className="text-red-600">
              {error instanceof Error ? error.message : 'خطای نامشخص'}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">مدیریت نمایندگان</CardTitle>
          <CardDescription>
            مشاهده و مدیریت اطلاعات فروشگاه‌ها و نمایندگان
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search Bar */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="جستجو در نمایندگان..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pr-10"
              />
            </div>
            
            {isLoading && (
              <div className="flex items-center text-sm text-gray-500">
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                در حال بارگذاری...
              </div>
            )}
            
            {!isLoading && data && (
              <div className="text-sm text-gray-600">
                {data.total} نماینده یافت شد
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <DataTable
              columns={representativesColumns}
              data={data?.representatives || []}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}